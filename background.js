// Initialize debug logger
if (window.debugLogger) {
    window.debugLogger.init();
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const PROVIDERS = {
    GEMINI: 'gemini',
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
    GROQ: 'groq',
    MISTRAL: 'mistral',
    OLLAMA: 'ollama',
    OPENAI_COMPATIBLE: 'openai-compatible'
};

// Listen for messages from the options page
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "applyLabels") {
        applyLabelsToMessages(message.messages, message.label)
            .then(() => sendResponse({ ok: true }))
            .catch(err => sendResponse({ ok: false, error: err.message }));
        return true; // Required for async response
    } else if (message.action === "analyzeEmail") {
        analyzeEmailContent(message.emailContent).then(label => {
            sendResponse({ label: label });
        });
        return true; // Required for async response
    } else if (message.action === 'startOllamaPull') {
        (async () => {
            try {
                const { ollamaUrl, model, headers } = message;
                const { response } = await callOllamaViaTab(ollamaUrl, {
                    action: 'ollamaFetch',
                    fetchAction: 'pull',
                    model,
                    headers
                });
                sendResponse(response || { ok: true });
            } catch (e) {
                sendResponse({ ok: false, error: e.message });
            }
        })();
        return true;
    } else if (message.action === 'batchControl') {
        // Pause / Resume / Cancel from the options page UI
        if (message.command === 'pause') {
            _batchState.paused = true;
        } else if (message.command === 'resume') {
            _batchState.paused = false;
        } else if (message.command === 'cancel') {
            _batchState.cancelled = true;
            _batchState.paused = false;
        }
        sendResponse({ ok: true });
    }
});

// Click handler for browser action icon - opens settings
browser.browserAction.onClicked.addListener(() => {
    browser.runtime.openOptionsPage();
});

// Register auto-sort listener for new emails
registerAutoSortListener();

// ─────────────────────────────────────────────────────────────────────────────
// LEVENSHTEIN FUZZY MATCHING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate Levenshtein edit distance between two strings.
 */
function levenshteinDistance(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;

    const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j - 1], dp[i][j - 1], dp[i - 1][j]);
        }
    }
    return dp[m][n];
}

/**
 * Find the best fuzzy-matching label using Levenshtein distance.
 * Returns the matched label if edit distance ratio <= threshold, else null.
 */
function findBestFuzzyMatch(input, candidates, threshold = 0.3) {
    const lower = input.toLowerCase();
    let bestMatch = null;
    let bestRatio = Infinity;

    for (const candidate of candidates) {
        const candidateLower = candidate.toLowerCase();
        const dist = levenshteinDistance(lower, candidateLower);
        const maxLen = Math.max(lower.length, candidateLower.length);
        const ratio = maxLen === 0 ? 0 : dist / maxLen;

        if (ratio <= threshold && ratio < bestRatio) {
            bestRatio = ratio;
            bestMatch = candidate;
        }
    }
    return bestMatch;
}

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL CONTEXT EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract comprehensive email context from a Thunderbird message structure.
 * Returns subject, author, attachments, and body text.
 */
async function extractEmailContext(fullMessage, messageHeader) {
    const subject = (fullMessage.headers?.Subject?.[0]) || (messageHeader?.subject) || '';

    const author = (fullMessage.headers?.From?.[0]) || (messageHeader?.author) || '';

    // Collect attachment info from parts (name indicates it's a file attachment)
    const attachments = [];
    async function collectAttachments(parts) {
        if (!parts) return;
        for (const part of parts) {
            if (part.parts) await collectAttachments(part.parts);
            // part.name means this is an attachment/file part
            if (part.name) {
                // Skip inline text parts that are the email body
                const isInlineText = (part.contentType === 'text/plain' || part.contentType === 'text/html') && !part.contentDisposition;
                if (!isInlineText) {
                    attachments.push({
                        name: part.name,
                        contentType: part.contentType || 'unknown',
                        size: part.size || 0
                    });
                }
            }
        }
    }
    if (fullMessage.parts) await collectAttachments(fullMessage.parts);

    async function decodeBody(body, encoding) {
        if (!body) return '';
        try {
            if (encoding === 'base64') return atob(body);
            if (encoding === 'quoted-printable') return browser.messengerUtilities.decodeQP(body);
        } catch (e) {
            console.warn('[MIME] decodeBody failed:', e.message);
        }
        return body;
    }

    function stripHtmlTags(html) {
        let text = html.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, '');
        text = text.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/div>/gi, '\n');
        text = text.replace(/<[^>]+>/g, '');
        text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        const signatureMarkers = ['-- \n', 'Sent from my iPhone', 'Get Outlook for', '________________________________', 'Sent from my Samsung device', 'Envoyé depuis mon appareil'];
        for (const marker of signatureMarkers) {
            const idx = text.indexOf(marker);
            if (idx > 50 && idx < Math.floor(text.length * 0.6)) text = text.substring(0, idx);
        }
        return text.trim().substring(0, 1500);
    }

    async function extractBodyText(parts) {
        if (!parts) return '';
        let plainText = '';
        let htmlText = '';
        for (const part of parts) {
            if (part.parts) {
                const subResult = await extractBodyText(part.parts);
                if (subResult.isPlain) plainText += subResult.text;
                else if (subResult.isHtml) htmlText += subResult.text;
                else plainText += subResult.text;
            } else if (part.contentType === 'text/plain' && part.body) {
                plainText += decodeBody(part.body, part.encoding) + '\n';
            } else if (part.contentType === 'text/html' && part.body && !plainText) {
                htmlText = stripHtmlTags(decodeBody(part.body, part.encoding));
            } else if (part.contentType === 'message/rfc822' && part.body) {
                plainText += part.body + '\n';
            }
        }
        const text = plainText || htmlText;
        return { text: text.substring(0, 1500), isPlain: !!plainText, isHtml: !!htmlText && !plainText };
    }

    const bodyResult = fullMessage.parts ? await extractBodyText(fullMessage.parts) : { text: fullMessage.body || '', isPlain: true, isHtml: false };
    const body = typeof bodyResult === 'string' ? bodyResult : bodyResult.text;

    return {
        subject,
        author,
        attachments,
        body
    };
}

// Legacy wrapper for backward compatibility
async function extractTextFromParts(fullMessage) {
    const context = await extractEmailContext(fullMessage, null);
    return context.body;
}

// Default prompt template for email classification
const DEFAULT_PROMPT = `You are an email classification assistant. Analyze this email and choose the most appropriate label from: {labels}.

**Email Metadata:**
- Subject: {subject}
- From: {author}
- Attachments: {attachments}

**Email Body:**
{body}

Consider the subject line, sender context, attachment filenames, and body content to determine the most appropriate category. Respond with only the exact label name, or "null" if no label fits well.`;

/** Select the appropriate API key for the given provider. */
function resolveApiKey(settings, provider, keyIndex) {
    if (provider === 'gemini') {
        if (settings.geminiApiKeys?.length > 0) {
            const idx = keyIndex ?? settings.currentGeminiKeyIndex ?? 0;
            if (window.debugLogger) window.debugLogger.info('[Gemini]', `Using API Key #${idx + 1} of ${settings.geminiApiKeys.length}`);
            return settings.geminiApiKeys[idx];
        }
        return settings.apiKey; // legacy fallback
    }
    if (provider === 'ollama' || provider === 'openai-compatible') return null;
    return settings.apiKey;
}

/** Build a prompt from template with placeholder injection. */
function buildPrompt(template, settings, emailContent, emailContext) {
    let prompt = template;
    const labelsStr = settings.labels.join(', ');
    const subject = emailContext?.subject || '';
    const author = emailContext?.author || '';
    const attachmentsStr = emailContext?.attachments?.length > 0 ? emailContext.attachments.map(a => a.name).join(', ') : '(none)';
    const body = emailContent;

    function injectPlaceholder(placeholder, value, fallbackPrefix, fallbackPosition = 'start') {
        if (!prompt.includes(placeholder)) {
            if (window.debugLogger) window.debugLogger.warn('[AutoSort]', `Custom prompt missing ${placeholder} placeholder - injecting`);
            prompt = fallbackPosition === 'start'
                ? `${fallbackPrefix}${value}\n\n${prompt}`
                : `${prompt}\n\n${fallbackPrefix}${value}`;
        } else {
            prompt = prompt.replace(placeholder, value);
        }
    }

    injectPlaceholder('{labels}', labelsStr, 'Labels: ', 'start');
    injectPlaceholder('{subject}', subject, 'Subject: ', 'start');
    injectPlaceholder('{author}', author, 'From: ', 'start');
    injectPlaceholder('{attachments}', attachmentsStr, 'Attachments: ', 'start');

    if (prompt.includes('{body}')) {
        prompt = prompt.replace('{body}', body);
    } else if (prompt.includes('{email}')) {
        prompt = prompt.replace('{email}', body);
    } else {
        if (window.debugLogger) window.debugLogger.warn('[AutoSort]', 'Custom prompt missing {body} placeholder - appending');
        prompt = `${prompt}\n\nEmail content:\n${body}`;
    }
    return prompt;
}

/** Extract text from provider response. Maps provider name → parser function. */
const PROVIDER_PARSERS = {
    gemini: data => data.candidates?.[0]?.content?.parts?.[0]?.text,
    openai: data => data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? data.choices?.[0]?.delta?.content,
    groq: data => data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? data.choices?.[0]?.delta?.content,
    mistral: data => data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? data.choices?.[0]?.delta?.content,
    anthropic: data => data.content?.[0]?.text,
    ollama: null, // handled separately
    'openai-compatible': data => data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text
};

const PROVIDER_NAMES = { GEMINI: 'gemini', OPENAI: 'openai', ANTHROPIC: 'anthropic', GROQ: 'groq', MISTRAL: 'mistral', OLLAMA: 'ollama', OPENAI_COMPATIBLE: 'openai-compatible' };

/** Generic tab-based fetch: injects script, polls for result, closes tab. */
async function fetchViaTab(tabUrl, scriptCode, resultVar, timeoutMs = 10000) {
    const tab = await browser.tabs.create({ url: tabUrl, active: false });
    try {
        await new Promise(resolve => setTimeout(resolve, 500));
        await browser.tabs.executeScript(tab.id, { code: scriptCode });

        let result = null;
        const pollInterval = 250;
        const maxPolls = Math.ceil(timeoutMs / pollInterval);
        for (let i = 0; i < maxPolls; i++) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            try {
                const results = await browser.tabs.executeScript(tab.id, {
                    code: `window.${resultVar} || null`
                });
                if (results && results[0]) { result = results[0]; break; }
            } catch (e) {
                break; // tab closing
            }
        }

        if (!result) throw new Error(`Request timed out (${timeoutMs}ms) - no response from API`);
        if (!result.ok) throw new Error(result.error || 'API error');
        return result.data;
    } finally {
        try { await browser.tabs.remove(tab.id); } catch (e) {
            console.warn('[AutoSort+] Failed to close tab after fetch:', e.message);
        }
    }
}

async function ollamaChatViaTab(ollamaUrl, model, prompt, authToken, numCtx = 0) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const optionsObj = numCtx > 0 ? { options: { num_ctx: parseInt(numCtx) } } : {};
    const scriptCode = `
        (async () => {
            try {
                const response = await fetch(window.location.origin + '/api/chat', {
                    method: 'POST',
                    headers: ${JSON.stringify(headers)},
                    body: JSON.stringify({
                        model: ${JSON.stringify(model)},
                        messages: [{ role: 'user', content: ${JSON.stringify(prompt)} }],
                        stream: false,
                        ...${JSON.stringify(optionsObj)}
                    })
                });
                if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                window.__ollama_result = { ok: true, data: await response.json() };
            } catch (error) {
                window.__ollama_result = { ok: false, error: error.message };
            }
        })();`;
    return fetchViaTab(ollamaUrl, scriptCode, '__ollama_result');
}

async function openaiCompatibleChatViaTab(baseUrl, model, prompt, apiKey) {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const scriptCode = `
        (async () => {
            try {
                const response = await fetch(window.location.origin + '/v1/chat/completions', {
                    method: 'POST',
                    headers: ${JSON.stringify(headers)},
                    body: JSON.stringify({
                        model: ${JSON.stringify(model)},
                        messages: [{ role: 'user', content: ${JSON.stringify(prompt)} }],
                        max_tokens: 8192, temperature: 0.6, top_p: 0.95, stream: false
                    })
                });
                if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                window.__openai_compat_result = { ok: true, data: await response.json() };
            } catch (error) {
                window.__openai_compat_result = { ok: false, error: error.message };
            }
        })();`;
    return fetchViaTab(baseUrl, scriptCode, '__openai_compat_result');
}

async function callOllamaViaTab(ollamaUrl, payload) {
    // Deprecated function kept for backward compatibility
    // Now routes to direct API call via fetch
    const { fetchAction, model, prompt, headers } = payload;
    
    if (fetchAction === 'chat') {
        // For direct chat, we make a simple fetch call
        const ollamaHeaders = Object.assign({}, headers, { 'Content-Type': 'application/json' });
        
        try {
            const res = await fetch(`${ollamaUrl}/api/chat`, {
                method: 'POST',
                headers: ollamaHeaders,
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    stream: false
                })
            });

            if (!res.ok) {
                return { 
                    correlationId: '', 
                    response: { ok: false, error: `HTTP ${res.status}: ${res.statusText}` } 
                };
            }

            const data = await res.json();
            return { correlationId: '', response: { ok: true, data } };
        } catch (err) {
            return { 
                correlationId: '', 
                response: { ok: false, error: err.message } 
            };
        }
    } else if (fetchAction === 'pull') {
        // For pull operations
        const ollamaHeaders = Object.assign({}, headers, { 'Content-Type': 'application/json' });
        
        try {
            const res = await fetch(`${ollamaUrl}/api/pull`, {
                method: 'POST',
                headers: ollamaHeaders,
                body: JSON.stringify({ name: model, stream: true })
            });

            const text = await res.text();
            return { correlationId: '', response: { ok: true, data: text } };
        } catch (err) {
            return { correlationId: '', response: { ok: false, error: err.message } };
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH PROCESSING ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-provider batch configuration.
 *   concurrency  – max simultaneous in-flight AI requests
 *   delayMs      – minimum milliseconds to wait between launching each request
 *
 * Note: Gemini free-tier concurrency=1 and delayMs are managed by the existing
 * checkAndTrackGeminiRateLimit() helper and preserved here.
 */
const PROVIDER_BATCH_CONFIG = {
    gemini:              { concurrency: 1, delayMs: 0     }, // delay handled by rate-limit helper
    openai:              { concurrency: 3, delayMs: 500   },
    anthropic:           { concurrency: 2, delayMs: 500   },
    groq:                { concurrency: 5, delayMs: 200   },
    mistral:             { concurrency: 2, delayMs: 500   },
    ollama:              { concurrency: 1, delayMs: 0     }, // local, sequential is fine
    'openai-compatible': { concurrency: 2, delayMs: 500   }
};

/** In-memory batch state (reset for each new batch run). */
let _batchState = {
    running:   false,
    cancelled: false,
    paused:    false,
    total:     0,
    completed: 0,
    failed:    0,
    skipped:   0,
    provider:  '',
    chunkIndex: 0,
    totalChunks: 0
};

// Auto-sort pending queue: messages that failed due to rate limiting, awaiting retry
let _autoSortPending = [];

/** Reset batch state to defaults. */
function _resetBatchState(total, provider) {
    _lastBroadcast = null;
    _batchState = {
        running:   true,
        cancelled: false,
        paused:    false,
        total,
        completed: 0,
        failed:    0,
        skipped:   0,
        provider,
        chunkIndex: 0,
        totalChunks: 0
    };
}

/** Atomically acquire the batch lock. Returns true if acquired, false if already running. */
function _acquireBatchLock() {
    if (_batchState.running) return false;
    _batchState.running = true;
    return true;
}

/** Release the batch lock when an early-exit path aborts before batchAnalyzeEmails runs. */
function _releaseBatchLock() {
    _batchState.running = false;
}

/** Return the next UTC midnight as a millisecond timestamp. Used for daily rate-limit resets. */
function _nextUtcMidnight() {
    const d = new Date(Date.now());
    d.setUTCHours(24, 0, 0, 0);
    return d.getTime();
}

/** Broadcast current batch progress to any open options pages. */
let _lastBroadcast = null;
async function _broadcastBatchProgress(status = 'running') {
    const payload = {
        action:    'batchProgress',
        status,
        total:     _batchState.total,
        completed: _batchState.completed,
        failed:    _batchState.failed,
        skipped:   _batchState.skipped,
        provider:  _batchState.provider,
        chunkIndex: _batchState.chunkIndex,
        totalChunks: _batchState.totalChunks
    };
    const stateKey = `${payload.completed}:${payload.failed}:${payload.skipped}:${payload.status}`;
    // Skip redundant storage writes if state hasn't changed
    if (stateKey !== _lastBroadcast) {
        _lastBroadcast = stateKey;
        await browser.storage.local.set({ currentBatch: { ...payload, startTime: Date.now() } });
    }
    await browser.runtime.sendMessage(payload).catch(() => {});
}

/**
 * Wait while the batch is paused. Returns true when resumed, false if cancelled
 * while waiting.
 */
async function _waitWhilePaused() {
    while (_batchState.paused && !_batchState.cancelled) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    return !_batchState.cancelled;
}

/**
 * Core batch engine. Processes an array of Thunderbird message objects using
 * the currently configured AI provider with chunk-based processing.
 *
 * @param {Array} messages  – Array of Thunderbird message objects (from mailTabs API)
 */
async function batchAnalyzeEmails(messages) {
    const settingsData = await browser.storage.local.get(['aiProvider', 'batchChunkSize']);
    const provider = settingsData.aiProvider || 'gemini';
    const chunkSize = settingsData.batchChunkSize || 5;

    _resetBatchState(messages.length, provider);
    await _broadcastBatchProgress('running');

    if (window.debugLogger) {
        window.debugLogger.info('[Batch]', `Starting batch: ${messages.length} emails, provider=${provider}, chunkSize=${chunkSize}`);
    }

    // Process a single message with exponential-backoff retry on failure
    async function executeWithRetry(fn, maxRetries = 3, baseDelay = 2000) {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                const isRateLimit = error.message.includes('429') ||
                    error.message.includes('RATE_LIMIT') ||
                    error.message.includes('quota');
                if (!isRateLimit) throw error; // non-429 errors fail fast

                if (attempt === maxRetries) throw error; // exhausted retries

                const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
                if (window.debugLogger) {
                    window.debugLogger.warn('[Batch]', `Rate limited. Retry in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`);
                }
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    async function processOne(message) {
        // Respect pause / cancel before starting
        if (_batchState.cancelled) return;
        if (_batchState.paused) {
            const resumed = await _waitWhilePaused();
            if (!resumed) return;
        }

        try {
            await executeWithRetry(async () => {
                const fullMessage = await browser.messages.getFull(message.id);
                if (!fullMessage) {
                    _batchState.skipped++;
                    return;
                }

                const emailContext = await extractEmailContext(fullMessage, message);
                const emailContent = emailContext.body;
                if (!emailContent || !emailContent.trim()) {
                    _batchState.skipped++;
                    return;
                }

                const label = await analyzeEmailContent(emailContent, emailContext);

                if (!label || String(label).trim().toLowerCase() === 'null') {
                    _batchState.skipped++;
                    return;
                }

                await applyLabelsToMessages([message], label);
                _batchState.completed++;
            });
        } catch (err) {
            _batchState.failed++;
            if (window.debugLogger) {
                window.debugLogger.warn('[Batch]', `Message ${message.id} failed: ${err.message}`);
            }
        }
    }

    // Chunk-based processing: process N emails, await all, continue
    const totalChunks = Math.ceil(messages.length / chunkSize);
    _batchState.totalChunks = totalChunks;

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        // Check cancellation before starting chunk
        if (_batchState.cancelled) break;

        // Wait while paused before starting chunk
        while (_batchState.paused && !_batchState.cancelled) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        if (_batchState.cancelled) break;

        // Get current chunk of messages
        const chunkStart = chunkIndex * chunkSize;
        const chunkEnd = Math.min(chunkStart + chunkSize, messages.length);
        const chunkMessages = messages.slice(chunkStart, chunkEnd);

        if (window.debugLogger) {
            window.debugLogger.info('[Batch]', `Processing chunk ${chunkIndex + 1}/${totalChunks} (emails ${chunkStart + 1}-${chunkEnd} of ${messages.length})`);
        }

        // Launch all chunk tasks concurrently
        const chunkPromises = chunkMessages.map(msg => processOne(msg));

        // Await all responses before continuing to next chunk
        await Promise.allSettled(chunkPromises);

        // Update chunk index and broadcast progress after each chunk
        _batchState.chunkIndex = chunkIndex + 1;
        await _broadcastBatchProgress('running');
    }

    const finalStatus = _batchState.cancelled ? 'cancelled' : 'done';
    _batchState.running = false;
    await _broadcastBatchProgress(finalStatus);

    // Clear persisted batch state after a short delay so the UI can show "done"
    setTimeout(async () => {
        await browser.storage.local.remove('currentBatch').catch(() => {});
    }, 6000);

    if (window.debugLogger) {
        window.debugLogger.info('[Batch]', `Batch ${finalStatus}: completed=${_batchState.completed}, failed=${_batchState.failed}, skipped=${_batchState.skipped}`);
    }

    // Final summary notification
    const { completed, failed, skipped, total } = _batchState;
    if (finalStatus === 'cancelled') {
        await showNotification('AutoSort+ Batch Cancelled',
            `Stopped after ${completed + failed + skipped}/${total} emails. Sorted: ${completed}, failed: ${failed}.`);
    } else if (failed === 0 && skipped === 0) {
        await showNotification('AutoSort+ Batch Complete',
            `Successfully sorted all ${completed} emails.`);
    } else {
        await showNotification('AutoSort+ Batch Complete',
            `Processed ${total} emails — sorted: ${completed}, skipped: ${skipped}, failed: ${failed}.`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini rate limiting (free tier: 5/min, 20/day per key)
// Combined check+track function to avoid redundant storage reads

// Mutex for atomic rate limit operations
let geminiRateLimitMutex = Promise.resolve();

/** Record a Gemini request in rate-limit tracking and persist to storage. */
async function _trackGeminiRequest(storageObj, rateLimit, waitTime, keyIndex) {
    await browser.storage.local.set(storageObj);
    if (window.debugLogger) {
        const label = keyIndex !== null ? `Key #${keyIndex + 1}` : 'Single';
        window.debugLogger.info('[RateLimit]', `Gemini ${label}: ${rateLimit.dailyCount}/20 today, ${rateLimit.requests.length} in last minute`);
    }
    return { allowed: true, waitTime, keyIndex };
}

async function checkAndTrackGeminiRateLimit(keyIndex = null) {
    // Chain onto mutex for atomic operation; .catch() prevents permanent lockup
    return geminiRateLimitMutex = geminiRateLimitMutex.then(async () => {
        const now = Date.now();
    const data = await browser.storage.local.get([
        'geminiApiKeys',
        'geminiRateLimits',
        'currentGeminiKeyIndex',
        'geminiPaidPlan',
        'geminiRateLimit' // Legacy single-key
    ]);

    // Skip for paid plan
    if (data.geminiPaidPlan) {
        return { allowed: true, waitTime: 0, keyIndex: keyIndex ?? 0 };
    }

    // Multi-key mode
    if (data.geminiApiKeys?.length > 0) {
        const keys = data.geminiApiKeys;
        const rateLimits = data.geminiRateLimits || keys.map(() => ({
            requests: [],
            dailyCount: 0,
            dailyResetTime: _nextUtcMidnight()
        }));
        let currentIndex = keyIndex ?? (data.currentGeminiKeyIndex || 0);

        let attempts = 0;

        while (attempts < keys.length) {
            const rl = rateLimits[currentIndex];

            if (now > rl.dailyResetTime) {
                rl.dailyCount = 0;
                rl.dailyResetTime = _nextUtcMidnight();
                rl.requests = [];
            }

            const oneMinuteAgo = now - 60000;
            rl.requests = rl.requests.filter(t => t > oneMinuteAgo);

            if (rl.dailyCount < 20) {
                let waitTime = 0;
                if (rl.requests.length > 0) {
                    const lastRequest = Math.max(...rl.requests);
                    const gap = now - lastRequest;
                    if (gap < 12000) waitTime = Math.ceil((12000 - gap) / 1000);
                }

                rl.requests.push(now);
                rl.dailyCount += 1;
                return _trackGeminiRequest({ currentGeminiKeyIndex: currentIndex, geminiRateLimits: rateLimits }, rateLimits[currentIndex], waitTime, currentIndex);
            }

            currentIndex = (currentIndex + 1) % keys.length;
            attempts++;
        }

        return {
            allowed: false,
            message: `All ${keys.length} Gemini API keys have reached their daily limit (20/day each). Please wait for reset or add more API keys in settings.`
        };
    }

    // Legacy single-key mode
    const utcReset = _nextUtcMidnight();
    const rl = data.geminiRateLimit || { requests: [], dailyCount: 0, dailyResetTime: utcReset };

    if (now > rl.dailyResetTime) {
        rl.dailyCount = 0;
        rl.dailyResetTime = utcReset;
        rl.requests = [];
    }

    if (rl.dailyCount >= 20) {
        const hoursUntilReset = Math.ceil((rl.dailyResetTime - now) / (1000 * 60 * 60));
        return {
            allowed: false,
            message: `Gemini free tier daily limit reached (20/day). Resets in ${hoursUntilReset} hours. Upgrade to paid plan or add multiple API keys in settings to remove limits.`
        };
    }

    const oneMinuteAgo = now - 60000;
    rl.requests = rl.requests.filter(t => t > oneMinuteAgo);

    let waitTime = 0;
    if (rl.requests.length > 0 && (now - Math.max(...rl.requests)) < 12000) {
        waitTime = Math.ceil((12000 - (now - Math.max(...rl.requests))) / 1000);
    }

    rl.requests.push(now);
    rl.dailyCount += 1;
    return _trackGeminiRequest({ geminiRateLimit: rl }, rl, waitTime, null);
    }).catch(err => {
        console.error('[RateLimit] Mutex error, resetting lock:', err.message);
        geminiRateLimitMutex = Promise.resolve();
        throw err;
    });
}

// Deprecated: Use checkAndTrackGeminiRateLimit instead
async function checkGeminiRateLimit() {
    console.warn('[Deprecated] checkGeminiRateLimit: Use checkAndTrackGeminiRateLimit instead');
    const result = await checkAndTrackGeminiRateLimit();
    // Note: This deprecated wrapper already tracked the request, so callers
    // using this will need to NOT call trackGeminiRequest separately
    return result;
}

// Deprecated: No longer needed - tracking is done in checkAndTrackGeminiRateLimit
async function trackGeminiRequest(keyIndex) {
    console.warn('[Deprecated] trackGeminiRequest: No longer needed - tracking is done in checkAndTrackGeminiRateLimit');
}

// Function to show notification
async function showNotification(title, message, type = "basic") {
    // Log to console (Thunderbird doesn't support browser.notifications)
    if (window.debugLogger) {
        window.debugLogger.info('[AutoSort+]', `${title}: ${message}`);
    }

    // Try to show notification if API is available
    try {
        if (browser.notifications && browser.notifications.create) {
            const id = `autosort-${Date.now()}`;
            await browser.notifications.create(id, {
                type: type,
                iconUrl: browser.runtime.getURL("icons/icon-48.png"),
                title: title,
                message: message,
                eventTime: Date.now(),
                priority: 2,
                requireInteraction: true
            });
            return id;
        }
    } catch (error) {
        // Silently fail - notifications not supported
    }
    return null;
}

// Function to update existing notification
async function updateNotification(id, title, message) {
    // Log to console
    if (window.debugLogger) {
        window.debugLogger.info('[AutoSort+]', `${title}: ${message}`);
    }

    // Try to update notification if API is available
    try {
        if (browser.notifications && browser.notifications.clear && id) {
            await browser.notifications.clear(id);
        }
    } catch (error) {
        // Silently fail - notifications not supported
    }
    return await showNotification(title, message);
}

// Function to analyze email content using AI
async function analyzeEmailContent(emailContent, emailContext = null) {
    try {
        const notificationId = await showNotification(
            "AutoSort+ AI Analysis",
            "Starting email analysis..."
        );

        const settings = await browser.storage.local.get([
            'apiKey',
            'geminiApiKeys',
            'currentGeminiKeyIndex',
            'aiProvider',
            'labels',
            'enableAi',
            'geminiPaidPlan',
            'geminiRateLimit',
            'geminiRateLimits',
            'ollamaUrl',
            'ollamaModel',
            'ollamaCustomModel',
            'ollamaAuthToken',
            'ollamaCpuOnly',
            'ollamaNumCtx',
            'customBaseUrl',
            'customModel',
            'customPrompt'
        ]);
        const provider = settings.aiProvider || 'gemini';
        
        // Check and track Gemini rate limits (free tier only) - single storage read
        let keyIndexToUse = null;
        if (provider === 'gemini' && !settings.geminiPaidPlan) {
            const rateLimit = await checkAndTrackGeminiRateLimit();
            if (!rateLimit.allowed) {
                // Show persistent notification for limit reached
                const isSingleKey = !settings.geminiApiKeys || settings.geminiApiKeys.length <= 1;
                const notifTitle = isSingleKey ? "⛔ Gemini API Limit Reached" : "⛔ All Gemini Keys at Limit";

                const notifId = await showNotification(
                    notifTitle,
                    rateLimit.message,
                    "list"
                );

                // Also try to update the current notification
                await updateNotification(
                    notificationId,
                    "AutoSort+ Rate Limit",
                    rateLimit.message
                );
                throw new Error(rateLimit.message);
            }

            if (rateLimit.waitTime > 0) {
                await updateNotification(
                    notificationId,
                    "AutoSort+ Rate Limit",
                    `Rate limit reached. Waiting ${rateLimit.waitTime} seconds...`
                );
                await new Promise(resolve => setTimeout(resolve, rateLimit.waitTime * 1000));
            }

            keyIndexToUse = rateLimit.keyIndex;
        }

        if (window.debugLogger) {
            window.debugLogger.info('[AutoSort+]', 'Settings retrieved', {
                hasApiKey: !!(settings.apiKey || (settings.geminiApiKeys && settings.geminiApiKeys.length > 0)),
                provider: provider,
                labels: settings.labels,
                enableAi: settings.enableAi !== false
            });
        }

        if (settings.enableAi === false) {
            console.error("AI is disabled");
            await updateNotification(
                notificationId,
                "AutoSort+ Error",
                "AI analysis is disabled in settings."
            );
            return null;
        }
        
        // Check API key availability based on provider
        let apiKeyToUse = null;
        if (provider === 'gemini') {
            if (settings.geminiApiKeys && settings.geminiApiKeys.length > 0) {
                const keyIndex = keyIndexToUse !== null ? keyIndexToUse : (settings.currentGeminiKeyIndex || 0);
                apiKeyToUse = settings.geminiApiKeys[keyIndex];
                if (window.debugLogger) {
                    window.debugLogger.info('[Gemini]', `Using API Key #${keyIndex + 1} of ${settings.geminiApiKeys.length}`);
                }
            } else if (settings.apiKey) {
                // Legacy single key
                apiKeyToUse = settings.apiKey;
            }
        } else if (provider !== 'ollama' && provider !== 'openai-compatible') {
            // Ollama and OpenAI-compatible don't need API key; other providers do
            apiKeyToUse = settings.apiKey;
        }

        if (!apiKeyToUse && provider !== 'ollama' && provider !== 'openai-compatible') {
            console.error("Missing API key");
            await updateNotification(
                notificationId,
                "AutoSort+ Error",
                `${provider.charAt(0).toUpperCase() + provider.slice(1)} API key not configured. Please add your API key in settings.`
            );
            return null;
        }

        // Validate OpenAI-compatible endpoint has baseUrl and model
        if (provider === 'openai-compatible') {
            const baseUrl = settings.customBaseUrl || '';
            const model = settings.customModel || '';
            if (!baseUrl || !model) {
                console.error("OpenAI-compatible endpoint not configured");
                await updateNotification(
                    notificationId,
                    "AutoSort+ Error",
                    "OpenAI-compatible endpoint not configured. Please set base URL and model in settings."
                );
                return null;
            }
        }
        
        if (!settings.labels || settings.labels.length === 0) {
            console.error("No labels configured");
            await updateNotification(
                notificationId,
                "AutoSort+ Error",
                "No folders/labels configured. Please go to settings and either load folders from your mail account or add custom labels."
            );
            return null;
        }

        // Select prompt template (custom or default)
        const promptTemplate = (settings.customPrompt && settings.customPrompt.trim())
            ? settings.customPrompt.trim()
            : DEFAULT_PROMPT;

        // Inject placeholders
        let prompt = promptTemplate;
        const labelsStr = settings.labels.join(', ');

        // Build context values for placeholders
        const subject = emailContext?.subject || '';
        const author = emailContext?.author || '';
        const attachmentsStr = emailContext?.attachments?.length > 0
            ? emailContext.attachments.map(a => a.name).join(', ')
            : '(none)';
        const body = emailContent; // body is the main email text

        // Helper to inject placeholder with fallback injection if missing
        function injectPlaceholder(placeholder, value, fallbackPrefix, fallbackPosition = 'start') {
            if (!prompt.includes(placeholder)) {
                if (window.debugLogger) {
                    window.debugLogger.warn('[AutoSort]', `Custom prompt missing ${placeholder} placeholder - injecting`);
                }
                if (fallbackPosition === 'start') {
                    prompt = `${fallbackPrefix}${value}\n\n${prompt}`;
                } else {
                    prompt = `${prompt}\n\n${fallbackPrefix}${value}`;
                }
            } else {
                prompt = prompt.replace(placeholder, value);
            }
        }

        // Inject all placeholders (order matters for fallback injection)
        injectPlaceholder('{labels}', labelsStr, 'Labels: ', 'start');
        injectPlaceholder('{subject}', subject, 'Subject: ', 'start');
        injectPlaceholder('{author}', author, 'From: ', 'start');
        injectPlaceholder('{attachments}', attachmentsStr, 'Attachments: ', 'start');

        // Handle {body} and legacy {email} placeholders
        if (prompt.includes('{body}')) {
            prompt = prompt.replace('{body}', body);
        } else if (prompt.includes('{email}')) {
            // Legacy placeholder support
            prompt = prompt.replace('{email}', body);
        } else {
            // Default: append body at end if no body/email placeholder found
            if (window.debugLogger) {
                window.debugLogger.warn('[AutoSort]', 'Custom prompt missing {body} placeholder - appending');
            }
            prompt = `${prompt}\n\nEmail content:\n${body}`;
        }

        await updateNotification(
            notificationId,
            "AutoSort+ AI Analysis",
            `Sending request to ${provider.charAt(0).toUpperCase() + provider.slice(1)} AI...`
        );

        let response;
        let data;

        if (provider === 'gemini') {
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKeyToUse}`;

            // Rate limiting already tracked in checkAndTrackGeminiRateLimit above

            await updateNotification(
                notificationId,
                "AutoSort+ AI Analysis",
                "Analyzing email content with Gemini AI..."
            );

            const requestBody = {
                contents: [{
                    role: "user",
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.6,
                    topK: 20,
                    topP: 0.95,
                    maxOutputTokens: 50,
                    responseMimeType: "text/plain",
                    thinkingConfig: {
                        thinkingBudget: 0
                    }
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_NONE"
                    }
                ]
            };

            if (window.debugLogger) {
                const sanitizedUrl = apiUrl.replace(/key=[^&]+/, 'key=***REDACTED***');
                window.debugLogger.apiRequest('Gemini', sanitizedUrl, requestBody);
            }

            response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

        } else if (provider === 'openai') {
            await updateNotification(
                notificationId,
                "AutoSort+ AI Analysis",
                "Analyzing email content with OpenAI..."
            );

            const requestBody = {
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 50,
                temperature: 0.6,
                top_p: 0.95
            };

            if (window.debugLogger) {
                window.debugLogger.apiRequest('OpenAI', 'https://api.openai.com/v1/chat/completions', requestBody);
            }

            response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKeyToUse}`
                },
                body: JSON.stringify(requestBody)
            });

        } else if (provider === 'anthropic') {
            await updateNotification(
                notificationId,
                "AutoSort+ AI Analysis",
                "Analyzing email content with Claude..."
            );

            const requestBody = {
                model: 'claude-3-haiku-20240307',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 50
            };

            if (window.debugLogger) {
                window.debugLogger.apiRequest('Claude', 'https://api.anthropic.com/v1/messages', requestBody);
            }

            response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKeyToUse,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(requestBody)
            });

        } else if (provider === 'groq') {
            await updateNotification(
                notificationId,
                "AutoSort+ AI Analysis",
                "Analyzing email content with Groq..."
            );

            const requestBody = {
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 50,
                temperature: 0.6,
                top_p: 0.95
            };

            if (window.debugLogger) {
                window.debugLogger.apiRequest('Groq', 'https://api.groq.com/openai/v1/chat/completions', requestBody);
            }

            response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKeyToUse}`
                },
                body: JSON.stringify(requestBody)
            });

        } else if (provider === 'mistral') {
            await updateNotification(
                notificationId,
                "AutoSort+ AI Analysis",
                "Analyzing email content with Mistral..."
            );

            const requestBody = {
                model: 'mistral-small-latest',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 50,
                temperature: 0.6,
                top_p: 0.95
            };

            if (window.debugLogger) {
                window.debugLogger.apiRequest('Mistral', 'https://api.mistral.ai/v1/chat/completions', requestBody);
            }

            response = await fetch('https://api.mistral.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKeyToUse}`
                },
                body: JSON.stringify(requestBody)
            });

        } else if (provider === 'ollama') {
            await updateNotification(
                notificationId,
                "AutoSort+ AI Analysis",
                "Analyzing email content with local Ollama..."
            );

            // Get Ollama settings
            const ollamaSettings = await browser.storage.local.get(['ollamaUrl', 'ollamaModel', 'ollamaCustomModel', 'ollamaCpuOnly', 'ollamaAuthToken', 'ollamaNumCtx']);
            const ollamaUrl = ollamaSettings.ollamaUrl || 'http://localhost:11434';
            let ollamaModel = ollamaSettings.ollamaModel || 'llama3.2';
            const ollamaNumCtx = ollamaSettings.ollamaNumCtx || 0;
            const cpuOnly = ollamaSettings.ollamaCpuOnly === true;
            const ollamaAuthToken = ollamaSettings.ollamaAuthToken || '';

            // Use custom model if selected
            if (ollamaModel === 'custom' && ollamaSettings.ollamaCustomModel) {
                ollamaModel = ollamaSettings.ollamaCustomModel;
            }

            const requestBody = {
                model: ollamaModel,
                messages: [{ role: 'user', content: prompt }],
                stream: false
            };

            if (window.debugLogger) {
                window.debugLogger.apiRequest('Ollama', `${ollamaUrl}/api/chat`, requestBody);
            }

            // Use tab injection to make the fetch (browser context, no restrictions)
            try {
                const ollamaResponse = await ollamaChatViaTab(ollamaUrl, ollamaModel, prompt, ollamaAuthToken, ollamaNumCtx);

                if (!ollamaResponse.message || !ollamaResponse.message.content) {
                    throw new Error('Invalid Ollama response format');
                }

                data = ollamaResponse;
                response = null; // Mark as handled

            } catch (ollamaError) {
                console.error('[Ollama] Tab injection chat failed:', ollamaError.message);
                throw ollamaError;
            }

        } else if (provider === 'openai-compatible') {
            // Get custom endpoint settings
            const customSettings = await browser.storage.local.get(['customBaseUrl', 'customModel', 'apiKey']);
            const baseUrl = (customSettings.customBaseUrl || '').replace(/\/$/, '');
            const model = customSettings.customModel || '';
            const apiKey = customSettings.apiKey || '';

            if (!baseUrl || !model) {
                throw new Error('OpenAI-compatible endpoint not configured. Please set base URL and model in settings.');
            }

            await updateNotification(
                notificationId,
                "AutoSort+ AI Analysis",
                `Analyzing email content with ${model}...`
            );

            const requestBody = {
                model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 8192,
                temperature: 0.6,
                top_p: 0.95
            };

            // Build headers
            const headers = {
                'Content-Type': 'application/json'
            };
            if (apiKey) {
                headers['Authorization'] = `Bearer ${apiKey}`;
            }

            // Check if this is a localhost endpoint - Thunderbird background scripts can't directly fetch localhost
            const isLocalhost = baseUrl.startsWith('http://localhost') || baseUrl.startsWith('http://127.0.0.1');

            if (window.debugLogger) {
                window.debugLogger.apiRequest('OpenAI-Compatible', `${baseUrl}/chat/completions`, requestBody);
            }

            if (isLocalhost) {
                // Use tab injection for localhost (similar to Ollama handling)
                try {
                    const customResponse = await openaiCompatibleChatViaTab(baseUrl, model, prompt, apiKey);

                    if (!customResponse.choices || customResponse.choices.length === 0 || !customResponse.choices[0].message) {
                        throw new Error('Invalid OpenAI-compatible response format');
                    }

                    data = customResponse;
                    response = null; // Mark as handled

                } catch (customError) {
                    console.error('[OpenAI-Compatible] Tab injection failed:', customError.message);
                    throw customError;
                }
            } else {
                // Direct fetch for non-localhost endpoints
                response = await fetch(baseUrl + '/chat/completions', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(requestBody)
                });
            }

        } else {
            throw new Error(`Unknown provider: ${provider}`);
        }

        if (response) {
            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                
                // Try to parse error response body
                try {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const error = await response.json();
                        errorMessage = error.error?.message || error.message || errorMessage;
                    } else {
                        const text = await response.text();
                        if (text) errorMessage = text.substring(0, 200);
                    }
                } catch (parseErr) {
                    console.warn('Could not parse error response:', parseErr.message);
                }
                
                console.error("API Error details:", errorMessage);
                
                // Handle quota errors specifically
                if (response.status === 429 || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
                    errorMessage = "API quota exceeded. Please wait a while before trying again, or upgrade to a paid API key.";
                }
                
                // Handle Ollama auth errors
                if (response.status === 403) {
                    errorMessage = "Ollama authentication failed (403). Check your API key/token if Ollama requires authentication.";
                }
                
                await updateNotification(
                    notificationId,
                    "AutoSort+ Error",
                    `API Error: ${errorMessage}`
                );
                return null;
            }

            await updateNotification(
                notificationId,
                "AutoSort+ AI Analysis",
                "Processing AI response..."
            );

            data = await response.json();
            if (window.debugLogger) {
                window.debugLogger.apiResponse(provider, response.status, data);
            }
        } else if (data) {
            await updateNotification(
                notificationId,
                "AutoSort+ AI Analysis",
                "Processing AI response..."
            );
            if (window.debugLogger) {
                window.debugLogger.apiResponse(provider, 200, data);
            }
        } else {
            await updateNotification(
                notificationId,
                "AutoSort+ Error",
                "No response received from provider."
            );
            return null;
        }
        
        // Parse the response based on provider
        let label = null;

        const tryTrim = v => { try { return (v || '').toString().trim() || null; } catch (e) { return null; } };

        // Gemini: check for MAX_TOKENS truncation
        if (provider === 'gemini' && data.candidates?.[0]?.finishReason === "MAX_TOKENS") {
            console.error("Response truncated");
            await updateNotification(notificationId, "AutoSort+ Error", "AI response was cut off");
            return null;
        }

        // Use provider parser mapping (ollama handled separately)
        const parser = PROVIDER_PARSERS[provider];
        if (parser) {
            label = tryTrim(parser(data));
            // Some OpenAI-compatible models return reasoning in separate field
            if (!label && (provider === 'openai' || provider === 'groq' || provider === 'mistral' || provider === 'openai-compatible')) {
                label = tryTrim(data.choices?.[0]?.message?.reasoning_content);
            }
            if (window.debugLogger) {
                window.debugLogger.info('[API]', 'Choice structure:', data.choices?.[0]);
            }
        } else if (provider === 'ollama') {
            // Recursively extract text from arbitrary Ollama response structures
            function extractText(obj) {
                if (obj == null) return null;
                if (typeof obj === 'string') return obj.trim() || null;
                if (Array.isArray(obj)) {
                    for (const item of obj) { const found = extractText(item); if (found) return found; }
                    return null;
                }
                if (typeof obj !== 'object') return null;
                return extractText(obj.text) || extractText(obj.content) || extractText(obj.response) || extractText(obj.result) || extractText(obj.parts);
            }
            label = extractText(data.message) || extractText(data);
        }

        if (!label) {
            console.error("No label extracted from response:", data);
            await updateNotification(notificationId, "AutoSort+ Error", "No response from AI");
            return null;
        }

        if (window.debugLogger) {
            window.debugLogger.info('[AutoSort+]', `Raw generated label: ${label}`);
        }

        // Normalize and try to match configured labels more forgivingly
        const normalize = s => s.toString().trim().replace(/^['"`]+|['"`]+$/g, '');
        const lower = normalize(label).toLowerCase();

        // Exact match first
        if (settings.labels.includes(label)) {
            await updateNotification(notificationId, "AutoSort+ Success", `AI analysis complete. Selected label: ${label}`);
            return label;
        }

        // Try to find a label that matches case-insensitively or is contained within the AI output
        let matched = settings.labels.find(l => l.toLowerCase() === lower);
        if (!matched) {
            matched = settings.labels.find(l => lower.includes(l.toLowerCase()) || l.toLowerCase().includes(lower));
        }

        // Fallback: fuzzy match using Levenshtein distance
        if (!matched) {
            matched = findBestFuzzyMatch(label, settings.labels);
            if (matched && window.debugLogger) {
                window.debugLogger.info('[AutoSort+]', `Fuzzy matched "${label}" to "${matched}" via Levenshtein`);
            }
        }

        if (matched) {
            if (window.debugLogger) {
                window.debugLogger.info('[AutoSort+]', `Mapped AI output to configured label: ${matched}`);
            }
            await updateNotification(notificationId, "AutoSort+ Success", `AI analysis complete. Selected label: ${matched}`);
            return matched;
        }

        if (window.debugLogger) {
            window.debugLogger.warn('[AutoSort+]', `Label not found in configured labels. Generated: ${label}`);
        }
        await updateNotification(notificationId, "AutoSort+ Warning", `AI suggested: "${label}" but it's not in your configured labels.`);
        return null;
    } catch (error) {
        console.error("Error analyzing email:", error);
        await showNotification(
            "AutoSort+ Error",
            `Error analyzing email: ${error.message}`
        );
        return null;
    }
}

// Function to store move history
async function storeMoveHistory(result) {
    try {
        const data = await browser.storage.local.get('moveHistory');
        const history = data.moveHistory || [];
        history.unshift({
            timestamp: new Date().toISOString(),
            subject: (result.subject || '').substring(0, 200),   // truncate to 200 chars
            status: result.status || 'unknown',
            destination: (result.destination || '').substring(0, 200)
        });
        // Keep only the last 100 entries
        if (history.length > 100) {
            history.pop();
        }
        await browser.storage.local.set({ moveHistory: history });
    } catch (error) {
        console.error("Error storing move history:", error);
    }
}

// Function to apply labels to selected messages
async function applyLabelsToMessages(messages, label) {
    try {
        const messageCount = messages.length;
        const notificationId = await showNotification(
            "AutoSort+ Processing",
            `Starting to process ${messageCount} message(s)...`
        );

        let successCount = 0;
        let errorCount = 0;
        const moveResults = [];

        // Build folder lookup Map once to avoid N+1 pattern
        // Key format: "accountId:folderName" to handle multiple accounts with same folder names
        const folderCache = new Map();

        // Cache accounts to avoid N+1 pattern
        const accountCache = new Map();

        async function getAccount(accountId) {
            if (!accountCache.has(accountId)) {
                const account = await browser.accounts.get(accountId);
                accountCache.set(accountId, account);
            }
            return accountCache.get(accountId);
        }

        function buildFolderMap(folders, prefix = '', accountId) {
            if (!folders) return;
            for (const folder of folders) {
                const fullName = prefix ? `${prefix}/${folder.name}` : folder.name;
                folderCache.set(`${accountId}:${fullName}`, folder);
                folderCache.set(`${accountId}:${folder.name}`, folder); // Also cache by short name
                if (folder.subFolders) {
                    buildFolderMap(folder.subFolders, fullName, accountId);
                }
            }
        }

        // Pre-build folder cache for all accounts involved
        const uniqueAccountIds = [...new Set(
            messages.map(m => m.folder?.accountId).filter(id => id)
        )];
        for (const accountId of uniqueAccountIds) {
            const account = await getAccount(accountId);
            buildFolderMap(account.folders, '', accountId);
        }

        if (window.debugLogger) {
            window.debugLogger.info('[Folder]', `Built folder cache: ${folderCache.size} entries`);
        }

        for (const message of messages) {
            if (window.debugLogger) {
                window.debugLogger.info('[Folder]', `Processing message: ${message.id}`);
            }
            if (window.debugLogger) {
                window.debugLogger.info('[Folder]', `Target label/folder: ${label}`);
            }

            const account = await getAccount(message.folder.accountId);

            await updateNotification(
                notificationId,
                "AutoSort+ Processing",
                `Finding destination folder for message ${successCount + errorCount + 1}/${messageCount}...`
            );

            // Use cached folder lookup instead of recursive search
            let targetFolder = folderCache.get(`${message.folder.accountId}:${label}`);

            // Handle subfolder paths - full path already cached above
            if (!targetFolder && label.includes('/')) {
                targetFolder = folderCache.get(`${message.folder.accountId}:${label}`);
            }

            // Auto-create missing folder when it's a custom label (skip imported/structured labels)
            if (!targetFolder) {
                const looksImported = label.includes('/') || label.includes('\\');
                if (looksImported) {
                    if (window.debugLogger) {
                        window.debugLogger.warn('[Folder]', `Folder "${label}" looks imported/structured; skipping auto-create`);
                    }
                } else {
                    try {
                        const parentFolder = account.folders && account.folders.length > 0 ? account.folders[0] : null;
                        if (parentFolder && browser.folders && browser.folders.create) {
                            if (window.debugLogger) {
                                window.debugLogger.info('[Folder]', `Creating missing folder "${label}" under ${parentFolder.name || 'root'}`);
                            }
                            const created = await browser.folders.create(parentFolder, label);
                            if (created) {
                                targetFolder = created;
                                folderCache.set(`${message.folder.accountId}:${label}`, created);
                                if (window.debugLogger) {
                                    window.debugLogger.info('[Folder]', `Created folder: ${created.name}`);
                                }
                            }
                        }
                    } catch (createError) {
                        console.error(`Failed to create folder "${label}":`, createError);
                    }
                }
            }

            if (window.debugLogger) {
                window.debugLogger.info('[Folder]', `Moving message to folder: ${targetFolder ? targetFolder.name : 'not found'}`);
            }

            try {
                if (!targetFolder) {
                    console.error(`Folder "${label}" not found in account ${account.name}`);
                    await updateNotification(
                        notificationId,
                        "AutoSort+ Error",
                        `Folder "${label}" not found. Please create it first in Thunderbird.`
                    );
                    errorCount++;
                    const result = {
                        subject: message.subject || "(No subject)",
                        status: "Error",
                        destination: "Folder not found",
                        timestamp: new Date().toISOString()
                    };
                    moveResults.push(result);
                    await storeMoveHistory(result);
                    continue;
                }

                await updateNotification(
                    notificationId,
                    "AutoSort+ Processing",
                    `Moving message ${successCount + errorCount + 1}/${messageCount} to ${targetFolder.name}...`
                );

                // Move the message using the folder ID
                await browser.messages.move(
                    [message.id], 
                    targetFolder.id
                );
                
                successCount++;
                const result = {
                    subject: message.subject || "(No subject)",
                    status: "Success",
                    destination: targetFolder.name,
                    timestamp: new Date().toISOString()
                };
                moveResults.push(result);
                await storeMoveHistory(result);
            } catch (moveError) {
                console.error("Error moving message:", moveError);
                errorCount++;
                const result = {
                    subject: message.subject || "(No subject)",
                    status: "Error",
                    destination: moveError.message,
                    timestamp: new Date().toISOString()
                };
                moveResults.push(result);
                await storeMoveHistory(result);
                await updateNotification(
                    notificationId,
                    "AutoSort+ Error",
                    `Error moving message: ${moveError.message}`
                );
            }
        }

        // Show final status
        if (errorCount === 0) {
            await updateNotification(
                notificationId,
                "AutoSort+ Success",
                `Successfully moved ${successCount} message(s) to ${label}`
            );
        } else {
            await updateNotification(
                notificationId,
                "AutoSort+ Completed with Errors",
                `Processed ${messageCount} message(s): ${successCount} successful, ${errorCount} failed`
            );
        }

        // Create and show the results popup
        await showMoveResultsPopup(moveResults);
    } catch (error) {
        console.error("Error applying labels:", error);
        await showNotification(
            "AutoSort+ Error",
            `Error processing messages: ${error.message}`
        );
    }
}

// Function to create and show the move results popup
async function showMoveResultsPopup(results) {
    try {
        const successCount = results.filter(r => r.status === "Success").length;
        const errorCount = results.filter(r => r.status === "Error").length;
        
        // Create a detailed message
        let message = `Processed ${results.length} messages:\n`;
        message += `✅ Successfully moved: ${successCount}\n`;
        message += `❌ Failed to move: ${errorCount}\n\n`;
        
        // Add details for each message
        results.forEach((result, index) => {
            message += `${index + 1}. ${result.subject}\n`;
            message += `   Status: ${result.status}\n`;
            message += `   Destination: ${result.destination}\n`;
            message += `   Timestamp: ${result.timestamp}\n\n`;
        });

        // Show the notification with higher priority and require interaction
        await showNotification(
            "AutoSort+ Results",
            message,
            "basic"
        );

        // Also log to console for debugging
        if (window.debugLogger) {
            window.debugLogger.info('[AutoSort+]', 'Results popup displayed');
        }
    } catch (error) {
        console.error("Error showing results:", error);
        await showNotification(
            "AutoSort+ Error",
            "Failed to show detailed results. Check console for more information."
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-SORT: Handle new emails arriving in Inbox
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Concurrency-limited parallel processor.
 * Processes items concurrently with a maximum number of simultaneous operations.
 *
 * @param {Array} items - Array of items to process
 * @param {Function} processor - Async function to process each item
 * @param {number} limit - Maximum concurrent operations (default: 3)
 * @returns {Promise<Array>} - Promise.allSettled results
 */
async function processWithConcurrency(items, processor, limit = 3) {
    const results = [];
    const executing = new Set();

    for (const item of items) {
        const promise = processor(item).finally(() => {
            executing.delete(promise);
        });
        executing.add(promise);
        results.push(promise);

        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }

    return Promise.allSettled(results);
}

/** Check if an error is a rate limit / quota error. */
function isRateLimitError(err) {
    if (!err) return false;
    const msg = String(err.message || '');
    return msg.includes('429') || msg.includes('quota') || msg.includes('RATE_LIMIT') || msg.includes('rate limit');
}

/** Core classification logic for a single message (no retry, no rate-limit handling). */
async function classifyAndMoveOnce(message) {
    const fullMessage = await browser.messages.getFull(message.id);
    if (!fullMessage) return { status: 'failed', reason: 'no_full_message' };

    const emailContext = await extractEmailContext(fullMessage, message);
    const emailContent = emailContext.body;
    if (!emailContent?.trim()) return { status: 'failed', reason: 'empty_body' };

    const label = await analyzeEmailContent(emailContent, emailContext);
    if (!label || String(label).trim().toLowerCase() === 'null') return { status: 'failed', reason: 'no_label' };

    await applyLabelsToMessages([message], label);

    if (window.debugLogger) {
        window.debugLogger.info('[AutoSort]', `Auto-sorted message ${message.id} to ${label}`);
    }
    return { status: 'success' };
}

/**
 * Classify a single message and move it to the appropriate folder.
 * Retries up to 2 times for non-rate-limit errors with exponential backoff (2s → 4s).
 * Rate limit errors queue the message for later retry.
 * Returns { status: 'success' | 'failed' | 'pending', reason? }
 */
async function classifyAndMove(message) {
    try {
        let lastError = null;

        // Try up to 3 times total (1 original + 2 retries)
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                return await classifyAndMoveOnce(message);
            } catch (err) {
                lastError = err;

                // Rate limit: don't retry, queue instead
                if (isRateLimitError(err)) {
                    _autoSortPending.push(message);
                    if (window.debugLogger) {
                        window.debugLogger.warn('[AutoSort]', `Rate limited: message ${message.id} queued for retry`);
                    }
                    return { status: 'pending', reason: 'rate_limited' };
                }

                // Non-rate-limit error: retry with exponential backoff
                if (attempt < 2) {
                    const delay = 2000 * Math.pow(2, attempt); // 2s, 4s
                    if (window.debugLogger) {
                        window.debugLogger.warn('[AutoSort]', `Attempt ${attempt + 1} failed for message ${message.id}, retrying in ${delay}ms: ${err.message}`);
                    }
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // All retries exhausted
        if (window.debugLogger) {
            window.debugLogger.warn('[AutoSort]', `Message ${message.id} failed after 3 attempts: ${lastError.message}`);
        }
        return { status: 'failed', reason: lastError.message };

    } catch (err) {
        // Unexpected errors (not from classifyAndMoveOnce)
        if (isRateLimitError(err)) {
            _autoSortPending.push(message);
            return { status: 'pending', reason: 'rate_limited' };
        }
        if (window.debugLogger) {
            window.debugLogger.warn('[AutoSort]', `Unexpected error for message ${message.id}: ${err.message}`);
        }
        return { status: 'failed', reason: err.message };
    }
}

/**
 * Handle new mail received event. Processes messages in Inbox folder.
 * Supports MessageList pagination via continueList.
 */
async function handleNewMail(folder, messageList) {
    // Guard: don't auto-sort if a manual batch is already running
    if (_batchState.running) return;

    const settings = await browser.storage.local.get(['autoSortEnabled', 'enableAi', 'aiProvider', 'autoSortNotifyOnComplete']);

    const autoSortEnabled = settings.autoSortEnabled !== false;
    if (!autoSortEnabled) return;
    if (settings.enableAi === false) return;

    if (!folder.specialUse?.includes("inbox")) return;

    const provider = settings.aiProvider || 'gemini';
    const limit = PROVIDER_BATCH_CONFIG[provider]?.concurrency || 3;

    // Statistics counters
    let stats = { success: 0, failed: 0, pending: 0, total: 0 };

    // Wrapper that updates stats for each message
    async function classifyAndTrack(message) {
        stats.total++;
        const result = await classifyAndMove(message);
        if (result.status === 'success') stats.success++;
        else if (result.status === 'pending') stats.pending++;
        else stats.failed++;
    }

    if (window.debugLogger) {
        window.debugLogger.info('[AutoSort]', `Processing new mail with concurrency=${limit} for provider=${provider}`);
    }

    // Process all pages of messages
    let page = messageList;
    while (true) {
        await processWithConcurrency(page.messages, classifyAndTrack, limit);
        if (!page.id) break;
        page = await browser.messages.continueList(page.id);
    }

    // Process pending queue (from previous rate-limited batches)
    if (_autoSortPending.length > 0) {
        if (window.debugLogger) {
            window.debugLogger.info('[AutoSort]', `Retrying ${_autoSortPending.length} pending messages`);
        }
        const pendingCopy = [..._autoSortPending];
        _autoSortPending = [];
        for (const msg of pendingCopy) {
            const result = await classifyAndMove(msg);
            if (result.status !== 'pending') {
                if (result.status === 'success') stats.success++;
                else stats.failed++;
            } else {
                stats.pending++;
                _autoSortPending.push(msg);
            }
        }
    }

    // Optional notification on completion
    if (settings.autoSortNotifyOnComplete && stats.total > 0) {
        const parts = [`Auto-sorted: ${stats.success} successful`];
        if (stats.failed > 0) parts.push(`${stats.failed} failed`);
        if (stats.pending > 0) parts.push(`${stats.pending} pending (rate limited)`);
        await showNotification('AutoSort+ Auto-Classification', parts.join(', '));
    }

    if (window.debugLogger) {
        window.debugLogger.info('[AutoSort]', `Auto-sort complete: ${stats.success} success, ${stats.failed} failed, ${stats.pending} pending out of ${stats.total}`);
    }
}

/**
 * Register the auto-sort listener for new emails at startup.
 */
function registerAutoSortListener() {
    browser.messages.onNewMailReceived.addListener(handleNewMail, false);
}

/** Build the full context menu with dynamic labels. */
async function buildContextMenu() {
    // Remove only our own menu items to avoid affecting other extensions
    try {
        const existingItems = await browser.menus.getAll();
        for (const item of existingItems) {
            if (item.id && (item.id.startsWith('autosort-') || item.id.startsWith('label-'))) {
                browser.menus.remove(item.id);
            }
        }
    } catch (e) {
        console.warn('[Menu] Failed to remove existing items:', e.message);
    }

    browser.menus.create({
        id: "autosort-parent",
        title: "AutoSort+",
        contexts: ["message_list"]
    });

    browser.menus.create({
        id: "autosort-analyze",
        parentId: "autosort-parent",
        title: "AutoSort+ Analyze with AI",
        contexts: ["message_list"]
    });

    const { labels } = await browser.storage.local.get(['labels']);
    if (labels && labels.length > 0) {
        browser.menus.create({
            id: "autosort-label-separator",
            parentId: "autosort-parent",
            type: "separator",
            contexts: ["message_list"]
        });
        for (const label of labels) {
            browser.menus.create({
                id: `label-${label}`,
                parentId: "autosort-parent",
                title: label,
                contexts: ["message_list"]
            });
        }
    }
}

/** Rebuild the menu when labels change — removes old items, then rebuilds from shared logic. */
async function rebuildLabelSubmenu() {
    try {
        const existingItems = await browser.menus.getAll();
        for (const item of existingItems) {
            if (item.id && (item.id.startsWith('autosort-') || item.id.startsWith('label-'))) {
                browser.menus.remove(item.id);
            }
        }
    } catch (e) {
        console.warn('[Menu] Failed to remove existing items:', e.message);
    }
    await buildContextMenu();
}

// Initialize menu on startup
browser.runtime.onStartup.addListener(buildContextMenu);
browser.runtime.onInstalled.addListener(buildContextMenu);

// Live-rebuild menu when labels change
browser.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local' && changes.labels) {
        await rebuildLabelSubmenu();
    }
});

// Listen for menu clicks
browser.menus.onClicked.addListener(async (info, tab) => {
    if (info.parentMenuItemId === "autosort-parent") {
        if (info.menuItemId === "autosort-analyze") {
            if (window.debugLogger) {
                window.debugLogger.info('[AutoSort+]', 'AI analysis selected - starting batch process');
            }
            try {
                if (!_acquireBatchLock()) {
                    await showNotification(
                        'AutoSort+ Busy',
                        'A batch is already in progress. Please wait or cancel it from the settings page.'
                    );
                    return;
                }

                const mailTabs = await browser.mailTabs.query({ active: true, currentWindow: true });
                if (!mailTabs || mailTabs.length === 0) {
                    console.error('No active mail tab found');
                    await showNotification('AutoSort+ Error', 'No active mail tab found');
                    _releaseBatchLock();
                    return;
                }

                const selectedMessageList = await browser.mailTabs.getSelectedMessages(mailTabs[0].id);
                if (!selectedMessageList || !selectedMessageList.messages || selectedMessageList.messages.length === 0) {
                    console.error('No messages selected');
                    await showNotification('AutoSort+ Error', 'No messages selected for analysis');
                    _releaseBatchLock();
                    return;
                }

                const messages = selectedMessageList.messages;
                if (window.debugLogger) {
                    window.debugLogger.info('[AutoSort+]', `Starting batch analysis of ${messages.length} selected messages`);
                }

                await showNotification(
                    'AutoSort+ Batch',
                    `Starting AI analysis of ${messages.length} email${messages.length > 1 ? 's' : ''}...`
                );

                batchAnalyzeEmails(messages).catch(err => {
                    console.error('[AutoSort+] Batch analysis failed:', err);
                    _releaseBatchLock();
                });

            } catch (error) {
                _releaseBatchLock();
                console.error('Error starting batch analysis:', error);
                await showNotification('AutoSort+ Error', `Error: ${error.message}`);
            }
            return;
        }

        if (!info.menuItemId.startsWith('label-')) return;
        const label = info.menuItemId.replace("label-", "");
        if (window.debugLogger) {
            window.debugLogger.info('[AutoSort+]', `Manual label selected: ${label}`);
        }
        await showNotification("AutoSort+", `Applying label: ${label}`);
        try {
            // Get the current mail tab for processing
            const mailTabs = await browser.mailTabs.query({ active: true, currentWindow: true });
            if (mailTabs && mailTabs.length > 0) {
                // Get full message objects
                const messages = await browser.mailTabs.getSelectedMessages(mailTabs[0].id);
                if (messages && messages.messages && messages.messages.length > 0) {
                    await applyLabelsToMessages(messages.messages, label);
                } else {
                    await showNotification("AutoSort+ Error", "No messages selected for labeling.");
                }
            } else {
                await showNotification("AutoSort+ Error", "No active mail tab found.");
            }
        } catch (error) {
            console.error("Error applying manual label:", error);
            await showNotification("AutoSort+ Error", `Error applying label: ${error.message}`);
        }
    }
}); 
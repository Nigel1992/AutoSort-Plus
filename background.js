// Initialize debug logger
if (window.debugLogger) {
    window.debugLogger.init();
}

// Listen for messages from the options page
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "applyLabels") {
        applyLabelsToMessages(message.messages, message.label);
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

// Ollama handling using tab injection (runs fetch in browser context)

async function ollamaChatViaTab(ollamaUrl, model, prompt, authToken) {
    // Open a hidden tab at localhost to make the fetch (browser context, not restricted)
    const tab = await browser.tabs.create({ url: ollamaUrl, active: false });
    
    // Wait for tab to load
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
        // Build the request headers
        const headers = { 'Content-Type': 'application/json' };
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
        
        // Inject code to make the fetch and store result
        const scriptCode = `
        (async () => {
            try {
                const headers = ${JSON.stringify(headers)};
                const response = await fetch(window.location.origin + '/api/chat', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        model: ${JSON.stringify(model)},
                        messages: [{ role: 'user', content: ${JSON.stringify(prompt)} }],
                        stream: false
                    })
                });
                
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                }
                
                const data = await response.json();
                window.__ollama_result = { ok: true, data };
            } catch (error) {
                window.__ollama_result = { ok: false, error: error.message };
            }
        })();
        `;
        
        await browser.tabs.executeScript(tab.id, { code: scriptCode });
        
        // Wait for result (with polling to be safe)
        let result = null;
        for (let i = 0; i < 60; i++) { // 30 seconds max
            await new Promise(resolve => setTimeout(resolve, 500));
            
            try {
                const results = await browser.tabs.executeScript(tab.id, { 
                    code: 'window.__ollama_result || null' 
                });
                if (results && results[0]) {
                    result = results[0];
                    break;
                }
            } catch (e) {
                // Tab might be closing
                break;
            }
        }
        
        if (!result) {
            throw new Error('Ollama request timed out (30s) - no response from API');
        }
        
        if (!result.ok) {
            throw new Error(result.error || 'Ollama API error');
        }
        
        return result.data;

    } finally {
        // Close the tab
        try { await browser.tabs.remove(tab.id); } catch (e) {}
    }
}

async function openaiCompatibleChatViaTab(baseUrl, model, prompt, apiKey) {
    // Open a hidden tab at the endpoint URL to make the fetch (browser context, not restricted)
    const tab = await browser.tabs.create({ url: baseUrl, active: false });

    // Wait for tab to load
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
        // Build the request headers
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        // Inject code to make the fetch using OpenAI-compatible format and store result
        const scriptCode = `
        (async () => {
            try {
                const headers = ${JSON.stringify(headers)};
                const response = await fetch(window.location.origin + '/v1/chat/completions', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        model: ${JSON.stringify(model)},
                        messages: [{ role: 'user', content: ${JSON.stringify(prompt)} }],
                        max_tokens: 8192,
                        temperature: 0.2,
                        stream: false
                    })
                });

                if (!response.ok) {
                    throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                }

                const data = await response.json();
                window.__openai_compat_result = { ok: true, data };
            } catch (error) {
                window.__openai_compat_result = { ok: false, error: error.message };
            }
        })();
        `;

        await browser.tabs.executeScript(tab.id, { code: scriptCode });

        // Wait for result (with polling to be safe)
        let result = null;
        for (let i = 0; i < 60; i++) { // 30 seconds max
            await new Promise(resolve => setTimeout(resolve, 500));

            try {
                const results = await browser.tabs.executeScript(tab.id, {
                    code: 'window.__openai_compat_result || null'
                });
                if (results && results[0]) {
                    result = results[0];
                    break;
                }
            } catch (e) {
                // Tab might be closing
                break;
            }
        }

        if (!result) {
            throw new Error('OpenAI-compatible request timed out (30s) - no response from API');
        }

        if (!result.ok) {
            throw new Error(result.error || 'OpenAI-compatible API error');
        }

        return result.data;

    } finally {
        // Close the tab
        try { await browser.tabs.remove(tab.id); } catch (e) {}
    }
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
 * checkGeminiRateLimit() / trackGeminiRequest() helpers and preserved here.
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
    provider:  ''
};

/** Reset batch state to defaults. */
function _resetBatchState(total, provider) {
    _batchState = {
        running:   true,
        cancelled: false,
        paused:    false,
        total,
        completed: 0,
        failed:    0,
        skipped:   0,
        provider
    };
}

/** Broadcast current batch progress to any open options pages. */
async function _broadcastBatchProgress(status = 'running') {
    const payload = {
        action:    'batchProgress',
        status,
        total:     _batchState.total,
        completed: _batchState.completed,
        failed:    _batchState.failed,
        skipped:   _batchState.skipped,
        provider:  _batchState.provider
    };
    try {
        // Persist to storage so options page can pick it up on open
        await browser.storage.local.set({ currentBatch: { ...payload, startTime: Date.now() } });
        // Also send a live runtime message (options page may be open)
        await browser.runtime.sendMessage(payload).catch(() => {});
    } catch (e) {
        // Ignore – options page may not be open
    }
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
 * the currently configured AI provider with appropriate concurrency and pacing.
 *
 * @param {Array} messages  – Array of Thunderbird message objects (from mailTabs API)
 */
async function batchAnalyzeEmails(messages) {
    const settingsData = await browser.storage.local.get(['aiProvider', 'geminiPaidPlan']);
    const provider = settingsData.aiProvider || 'gemini';
    const isPaidGemini = !!settingsData.geminiPaidPlan;

    const providerCfg = PROVIDER_BATCH_CONFIG[provider] || { concurrency: 1, delayMs: 500 };
    // Gemini paid tier can run with higher concurrency
    const concurrency = (provider === 'gemini' && isPaidGemini) ? 3 : providerCfg.concurrency;
    const delayMs     = providerCfg.delayMs;

    _resetBatchState(messages.length, provider);
    await _broadcastBatchProgress('running');

    if (window.debugLogger) {
        window.debugLogger.info('[Batch]', `Starting batch: ${messages.length} emails, provider=${provider}, concurrency=${concurrency}, delayMs=${delayMs}`);
    }

    // Helper to extract body text from a full Thunderbird message
    function extractText(fullMessage) {
        function fromParts(parts) {
            if (!parts) return '';
            let text = '';
            for (const part of parts) {
                if (part.parts) text += fromParts(part.parts);
                if (part.contentType === 'text/plain') {
                    text += part.body + '\n';
                } else if (part.contentType === 'text/html' && !text) {
                    text = browser.messengerUtilities.convertToPlainText(part.body);
                } else if (part.contentType === 'message/rfc822' && part.body) {
                    text += part.body + '\n';
                }
            }
            return text;
        }
        if (fullMessage.parts) return fromParts(fullMessage.parts);
        return fullMessage.body || '';
    }

    // Process a single message with one retry on failure
    async function processOne(message) {
        // Respect pause / cancel before starting
        if (_batchState.cancelled) return;
        if (_batchState.paused) {
            const resumed = await _waitWhilePaused();
            if (!resumed) return;
        }

        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const fullMessage = await browser.messages.getFull(message.id);
                if (!fullMessage) {
                    _batchState.skipped++;
                    return;
                }

                const emailContent = extractText(fullMessage);
                if (!emailContent || !emailContent.trim()) {
                    _batchState.skipped++;
                    return;
                }

                const label = await analyzeEmailContent(emailContent);

                if (!label || String(label).trim().toLowerCase() === 'null') {
                    _batchState.skipped++;
                    return;
                }

                await applyLabelsToMessages([message], label);
                _batchState.completed++;
                return; // success

            } catch (err) {
                if (window.debugLogger) {
                    window.debugLogger.warn('[Batch]', `Attempt ${attempt} failed for msg ${message.id}: ${err.message}`);
                }
                if (attempt === 2) {
                    // Both attempts failed
                    _batchState.failed++;
                    console.error(`[Batch] Message ${message.id} failed after retry:`, err.message);
                } else {
                    // Brief pause before retry
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }
        }
    }

    // Concurrency pool runner
    let launchIndex = 0;
    let lastLaunchTime = 0;
    const inFlight = new Set();

    while (launchIndex < messages.length || inFlight.size > 0) {
        // Check cancellation
        if (_batchState.cancelled) break;

        // Wait while paused (only when no new items are being launched)
        if (_batchState.paused && launchIndex >= messages.length) {
            await _waitWhilePaused();
        }

        // Launch new tasks up to concurrency limit
        while (
            launchIndex < messages.length &&
            inFlight.size < concurrency &&
            !_batchState.cancelled &&
            !_batchState.paused
        ) {
            // Enforce minimum delay between launches
            const now = Date.now();
            const sinceLastLaunch = now - lastLaunchTime;
            if (delayMs > 0 && sinceLastLaunch < delayMs) {
                await new Promise(resolve => setTimeout(resolve, delayMs - sinceLastLaunch));
            }

            const msg = messages[launchIndex++];
            lastLaunchTime = Date.now();

            const task = processOne(msg).finally(() => {
                inFlight.delete(task);
            });
            inFlight.add(task);
        }

        // Broadcast progress after each potential change
        await _broadcastBatchProgress('running');

        // Yield to let in-flight promises make progress
        if (inFlight.size > 0) {
            await Promise.race(inFlight);
        }
    }

    // Wait for all remaining in-flight tasks
    if (inFlight.size > 0) {
        await Promise.allSettled([...inFlight]);
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
// Gemini rate limiting functions (free tier: 5/min, 20/day per key)
async function checkGeminiRateLimit() {
    const now = Date.now();
    const data = await browser.storage.local.get([
        'geminiApiKeys', 
        'geminiRateLimits', 
        'currentGeminiKeyIndex', 
        'geminiPaidPlan',
        'geminiRateLimit' // Legacy single-key support
    ]);
    
    // Handle paid plan - no limits
    if (data.geminiPaidPlan) {
        return { allowed: true, waitTime: 0 };
    }
    
    // Multi-key mode
    if (data.geminiApiKeys && data.geminiApiKeys.length > 0) {
        const keys = data.geminiApiKeys;
        const rateLimits = data.geminiRateLimits || keys.map(() => ({
            requests: [],
            dailyCount: 0,
            dailyResetTime: now + (24 * 60 * 60 * 1000)
        }));
        let currentIndex = data.currentGeminiKeyIndex || 0;
        
        // Try to find an available key
        const startIndex = currentIndex;
        let attempts = 0;
        
        while (attempts < keys.length) {
            const rateLimit = rateLimits[currentIndex];
            
            // Reset daily count if it's a new day
            if (now > rateLimit.dailyResetTime) {
                rateLimit.dailyCount = 0;
                rateLimit.dailyResetTime = now + (24 * 60 * 60 * 1000);
                rateLimit.requests = [];
            }
            
            // Remove requests older than 1 minute
            const oneMinuteAgo = now - 60000;
            rateLimit.requests = rateLimit.requests.filter(time => time > oneMinuteAgo);
            
            // Check if this key is available
            if (rateLimit.dailyCount < 20) {
                // Check if we need to wait
                if (rateLimit.requests.length > 0) {
                    const lastRequest = Math.max(...rateLimit.requests);
                    const timeSinceLastRequest = now - lastRequest;
                    const minInterval = 12000; // 12 seconds
                    
                    if (timeSinceLastRequest < minInterval) {
                        const waitTime = Math.ceil((minInterval - timeSinceLastRequest) / 1000);
                        return {
                            allowed: true,
                            waitTime: waitTime,
                            keyIndex: currentIndex
                        };
                    }
                }
                
                // This key is ready to use
                await browser.storage.local.set({ 
                    currentGeminiKeyIndex: currentIndex,
                    geminiRateLimits: rateLimits
                });
                
                return {
                    allowed: true,
                    waitTime: 0,
                    keyIndex: currentIndex
                };
            }
            
            // This key has reached its limit, try next one
            currentIndex = (currentIndex + 1) % keys.length;
            attempts++;
        }
        
        // All keys have reached their limits
        return {
            allowed: false,
            message: `All ${keys.length} Gemini API keys have reached their daily limit (20/day each). Please wait for reset or add more API keys in settings.`
        };
    }
    
    // Legacy single-key mode (backward compatibility)
    const rateLimit = data.geminiRateLimit || { requests: [], dailyCount: 0, dailyResetTime: now };
    
    // Reset daily count if it's a new day
    if (now > rateLimit.dailyResetTime) {
        rateLimit.dailyCount = 0;
        rateLimit.dailyResetTime = now + (24 * 60 * 60 * 1000);
    }
    
    // Check daily limit (20 per day)
    if (rateLimit.dailyCount >= 20) {
        const hoursUntilReset = Math.ceil((rateLimit.dailyResetTime - now) / (1000 * 60 * 60));
        return {
            allowed: false,
            message: `Gemini free tier daily limit reached (20/day). Resets in ${hoursUntilReset} hours. Upgrade to paid plan or add multiple API keys in settings to remove limits.`
        };
    }
    
    // Remove requests older than 1 minute
    const oneMinuteAgo = now - 60000;
    rateLimit.requests = rateLimit.requests.filter(time => time > oneMinuteAgo);
    
    // Check if we need to wait (12 seconds between requests = 5 per minute)
    if (rateLimit.requests.length > 0) {
        const lastRequest = Math.max(...rateLimit.requests);
        const timeSinceLastRequest = now - lastRequest;
        const minInterval = 12000; // 12 seconds
        
        if (timeSinceLastRequest < minInterval) {
            const waitTime = Math.ceil((minInterval - timeSinceLastRequest) / 1000);
            return {
                allowed: true,
                waitTime: waitTime
            };
        }
    }
    
    return {
        allowed: true,
        waitTime: 0
    };
}

async function trackGeminiRequest(keyIndex = null) {
    const now = Date.now();
    const data = await browser.storage.local.get([
        'geminiApiKeys',
        'geminiRateLimits',
        'currentGeminiKeyIndex',
        'geminiRateLimit' // Legacy
    ]);
    
    // Multi-key mode
    if (data.geminiApiKeys && data.geminiApiKeys.length > 0 && keyIndex !== null) {
        const rateLimits = data.geminiRateLimits || data.geminiApiKeys.map(() => ({
            requests: [],
            dailyCount: 0,
            dailyResetTime: now + (24 * 60 * 60 * 1000)
        }));
        
        const rateLimit = rateLimits[keyIndex];
        
        // Add current request
        rateLimit.requests.push(now);
        rateLimit.dailyCount += 1;
        
        // Clean old requests
        const oneMinuteAgo = now - 60000;
        rateLimit.requests = rateLimit.requests.filter(time => time > oneMinuteAgo);
        
        await browser.storage.local.set({ geminiRateLimits: rateLimits });

        if (window.debugLogger) {
            window.debugLogger.info('[RateLimit]', `Gemini Key #${keyIndex + 1}: ${rateLimit.dailyCount}/20 today, ${rateLimit.requests.length} in last minute`);
        }
    } else {
        // Legacy single-key mode
        const rateLimit = data.geminiRateLimit || { requests: [], dailyCount: 0, dailyResetTime: now + (24 * 60 * 60 * 1000) };
        
        // Add current request
        rateLimit.requests.push(now);
        rateLimit.dailyCount += 1;
        
        // Clean old requests
        const oneMinuteAgo = now - 60000;
        rateLimit.requests = rateLimit.requests.filter(time => time > oneMinuteAgo);
        
        await browser.storage.local.set({ geminiRateLimit: rateLimit });

        if (window.debugLogger) {
            window.debugLogger.info('[RateLimit]', `Gemini requests: ${rateLimit.dailyCount}/20 today, ${rateLimit.requests.length} in last minute`);
        }
    }
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
async function analyzeEmailContent(emailContent) {
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
            'customModel'
        ]);
        const provider = settings.aiProvider || 'gemini';
        
        // Check Gemini rate limits (free tier only)
        let keyIndexToUse = null;
        if (provider === 'gemini' && !settings.geminiPaidPlan) {
            const rateLimitCheck = await checkGeminiRateLimit();
            if (!rateLimitCheck.allowed) {
                // Show persistent notification for limit reached
                const isSingleKey = !settings.geminiApiKeys || settings.geminiApiKeys.length <= 1;
                const notifTitle = isSingleKey ? "⛔ Gemini API Limit Reached" : "⛔ All Gemini Keys at Limit";
                
                const notifId = await showNotification(
                    notifTitle,
                    rateLimitCheck.message,
                    "list"
                );
                
                // Also try to update the current notification
                await updateNotification(
                    notificationId,
                    "AutoSort+ Rate Limit",
                    rateLimitCheck.message
                );
                throw new Error(rateLimitCheck.message);
            }
            
            if (rateLimitCheck.waitTime > 0) {
                await updateNotification(
                    notificationId,
                    "AutoSort+ Rate Limit",
                    `Rate limit reached. Waiting ${rateLimitCheck.waitTime} seconds...`
                );                await new Promise(resolve => setTimeout(resolve, rateLimitCheck.waitTime * 1000));
            }
            
            keyIndexToUse = rateLimitCheck.keyIndex;
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

        const prompt = `You are an email classification assistant. Analyze this email content and choose the most appropriate label from this list: ${settings.labels.join(', ')}. 
        Consider the following:
        1. The main topic and purpose of the email
        2. The sender and recipient context
        3. The urgency and importance of the content
        4. The type of communication (e.g., notification, request, update)
        
        Only respond with the exact label name that best fits the content. If no label fits well, respond with "null".
        
        Email content:
        ${emailContent}`;

        await updateNotification(
            notificationId,
            "AutoSort+ AI Analysis",
            `Sending request to ${provider.charAt(0).toUpperCase() + provider.slice(1)} AI...`
        );

        let response;
        let data;

        if (provider === 'gemini') {
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKeyToUse}`;
            if (window.debugLogger) {
                window.debugLogger.info('[Gemini]', 'Making API request...');
            }

            // Track request for rate limiting (free tier only)
            if (!settings.geminiPaidPlan) {
                await trackGeminiRequest(keyIndexToUse);
            }
            
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
                    temperature: 0.2,
                    topK: 1,
                    topP: 1,
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

            response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

        } else if (provider === 'openai') {
            if (window.debugLogger) {
                window.debugLogger.info('[OpenAI]', 'Making API request...');
            }

            await updateNotification(
                notificationId,
                "AutoSort+ AI Analysis",
                "Analyzing email content with OpenAI..."
            );

            response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKeyToUse}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 50,
                    temperature: 0.2
                })
            });

        } else if (provider === 'anthropic') {
            if (window.debugLogger) {
                window.debugLogger.info('[Claude]', 'Making API request...');
            }

            await updateNotification(
                notificationId,
                "AutoSort+ AI Analysis",
                "Analyzing email content with Claude..."
            );

            response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKeyToUse,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 50
                })
            });

        } else if (provider === 'groq') {
            if (window.debugLogger) {
                window.debugLogger.info('[Groq]', 'Making API request...');
            }

            await updateNotification(
                notificationId,
                "AutoSort+ AI Analysis",
                "Analyzing email content with Groq..."
            );

            response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKeyToUse}`
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 50,
                    temperature: 0.2
                })
            });

        } else if (provider === 'mistral') {
            if (window.debugLogger) {
                window.debugLogger.info('[Mistral]', 'Making API request...');
            }

            await updateNotification(
                notificationId,
                "AutoSort+ AI Analysis",
                "Analyzing email content with Mistral..."
            );

            response = await fetch('https://api.mistral.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKeyToUse}`
                },
                body: JSON.stringify({
                    model: 'mistral-small-latest',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 50,
                    temperature: 0.2
                })
            });

        } else if (provider === 'ollama') {
            if (window.debugLogger) {
                window.debugLogger.info('[Ollama]', 'Making API request (local)...');
            }

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

            if (window.debugLogger) {
                window.debugLogger.info('[Ollama]', `Using Ollama at ${ollamaUrl} with model ${ollamaModel}${cpuOnly ? ' (CPU-only)' : ''}`);
            }

            // Use tab injection to make the fetch (browser context, no restrictions)
            try {
                const ollamaResponse = await ollamaChatViaTab(ollamaUrl, ollamaModel, prompt, ollamaAuthToken);
                
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
            if (window.debugLogger) {
                window.debugLogger.info('[Custom]', 'Making API request to OpenAI-compatible endpoint...');
            }

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

            // Build headers
            const headers = {
                'Content-Type': 'application/json'
            };
            if (apiKey) {
                headers['Authorization'] = `Bearer ${apiKey}`;
            }

            // Check if this is a localhost endpoint - Thunderbird background scripts can't directly fetch localhost
            const isLocalhost = baseUrl.startsWith('http://localhost') || baseUrl.startsWith('http://127.0.0.1');

            if (isLocalhost) {
                // Use tab injection for localhost (similar to Ollama handling)
                if (window.debugLogger) {
                    window.debugLogger.info('[Custom]', `Using tab injection for localhost endpoint: ${baseUrl}`);
                }

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
                if (window.debugLogger) {
                    window.debugLogger.info('[Custom]', `Making direct fetch to: ${baseUrl}/chat/completions`);
                }

                response = await fetch(baseUrl + '/chat/completions', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        model,
                        messages: [{ role: 'user', content: prompt }],
                        max_tokens: 8192,
                        temperature: 0.2
                    })
                });
            }

        } else {
            throw new Error(`Unknown provider: ${provider}`);
        }

        if (response) {
            if (window.debugLogger) {
                window.debugLogger.info('[API]', `Response status: ${response.status}`);
            }

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
                window.debugLogger.info('[API]', 'Full response data received');
            }
        } else if (data) {
            await updateNotification(
                notificationId,
                "AutoSort+ AI Analysis",
                "Processing AI response..."
            );
            if (window.debugLogger) {
                window.debugLogger.info('[API]', 'Using response from native helper');
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

        const tryTrim = v => {
            try {
                return (v || '').toString().trim();
            } catch (e) {
                return null;
            }
        };

        if (provider === 'gemini') {
            if (data.candidates && data.candidates.length > 0) {
                const candidate = data.candidates[0];
                if (candidate.finishReason === "MAX_TOKENS") {
                    console.error("Response truncated");
                    await updateNotification(notificationId, "AutoSort+ Error", "AI response was cut off");
                    return null;
                }
                if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                    label = tryTrim(candidate.content.parts[0].text);
                }
            }
        } else if (provider === 'openai' || provider === 'groq' || provider === 'mistral' || provider === 'openai-compatible') {
            if (data.choices && data.choices.length > 0) {
                const choice = data.choices[0];
                if (window.debugLogger) {
                    window.debugLogger.info('[API]', 'Choice structure:', choice);
                }
                // Try multiple possible content locations
                label = tryTrim(choice.message?.content || choice.text || choice.delta?.content);
                // Some models return reasoning in separate field
                if (!label && choice.message?.reasoning_content) {
                    // Extract from reasoning if no content
                    label = tryTrim(choice.message.reasoning_content);
                }
            }
        } else if (provider === 'anthropic') {
            if (data.content && data.content.length > 0) {
                label = tryTrim(data.content[0].text);
            }
        } else if (provider === 'ollama') {
            // Ollama responses may vary in shape: string, object, array of parts, etc.
            try {
                const msg = data.message;
                if (!msg) {
                    // Some older/local versions may return data as string or have different keys
                    label = tryTrim(data.result || data.text || data.response);
                } else {
                    const content = msg.content;
                    if (typeof content === 'string') {
                        label = tryTrim(content);
                    } else if (Array.isArray(content)) {
                        // Find first element that's a string or has text fields
                        const first = content.find(c => typeof c === 'string' || (c && (c.text || c.content)));
                        if (typeof first === 'string') label = tryTrim(first);
                        else if (first && first.text) label = tryTrim(first.text);
                        else if (first && first.content) {
                            if (typeof first.content === 'string') label = tryTrim(first.content);
                            else if (Array.isArray(first.content)) label = tryTrim(first.content.map(x => x.text || x).join(' '));
                        }
                    } else if (content && typeof content === 'object') {
                        // Content might be an object with text or parts
                        label = tryTrim(content.text || content.content || content[0]);
                        if (!label && content.parts && content.parts.length > 0) {
                            label = tryTrim(content.parts[0].text || content.parts[0]);
                        }
                    } else if (typeof msg === 'string') {
                        label = tryTrim(msg);
                    }
                }
            } catch (e) {
                console.warn('Failed to parse Ollama response shape:', e.message);
                label = null;
            }
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
            ...result
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

        for (const message of messages) {
            if (window.debugLogger) {
                window.debugLogger.info('[Folder]', `Processing message: ${message.id}`);
            }
            if (window.debugLogger) {
                window.debugLogger.info('[Folder]', `Target label/folder: ${label}`);
            }

            // Get all folders to find the destination folder
            const account = await browser.accounts.get(message.folder.accountId);
            if (window.debugLogger) {
                window.debugLogger.info('[Folder]', 'Account info retrieved');
            }

            await updateNotification(
                notificationId,
                "AutoSort+ Processing",
                `Finding destination folder for message ${successCount + errorCount + 1}/${messageCount}...`
            );

            // Find the folder with matching name
            const findFolder = (folders, targetName) => {
                for (const folder of folders) {
                    if (window.debugLogger) {
                        window.debugLogger.info('[Folder]', `Checking folder: ${folder.name}`);
                    }
                    if (folder.name === targetName) {
                        return folder;
                    }
                    if (folder.subFolders) {
                        const found = findFolder(folder.subFolders, targetName);
                        if (found) return found;
                    }
                }
                return null;
            };

            // First try to find the category folder
            const categories = [
                "Financiën",
                "Werk en Carrière",
                "Persoonlijke Communicatie en Sociale Leven",
                "Gezondheid en Welzijn",
                "Online Activiteiten en E-commerce",
                "Reizen en Evenementen",
                "Informatie en Media",
                "Beveiliging en IT",
                "Klantensupport en Acties",
                "Overheid en Gemeenschap"
            ];

            let categoryFolder = null;
            let targetFolder = null;

            // Find the category and target folder
            for (const category of categories) {
                if (label.startsWith(category)) {
                    if (window.debugLogger) {
                        window.debugLogger.info('[Folder]', `Found matching category: ${category}`);
                    }
                    categoryFolder = findFolder(account.folders, category);
                    if (categoryFolder) {
                        if (window.debugLogger) {
                            window.debugLogger.info('[Folder]', `Found category folder: ${categoryFolder.name}`);
                        }
                        // Try to find the subfolder
                        const subfolderName = label.replace(category + "/", "");
                        if (window.debugLogger) {
                            window.debugLogger.info('[Folder]', `Looking for subfolder: ${subfolderName}`);
                        }
                        targetFolder = findFolder(categoryFolder.subFolders || [], subfolderName);
                        break;
                    } else {
                        if (window.debugLogger) {
                            window.debugLogger.warn('[Folder]', `Category folder not found: ${category} - skipping`);
                        }
                        continue;
                    }
                }
            }

            // If no target folder found, try direct match
            if (!targetFolder) {
                if (window.debugLogger) {
                    window.debugLogger.info('[Folder]', 'No category match, trying direct folder match');
                }
                targetFolder = findFolder(account.folders, label);
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

// Create context menu items
browser.menus.create({
    id: "autosort-label",
    title: "AutoSort+ Label",
    contexts: ["message_list"]
});

// Add submenu items for labels
browser.storage.local.get(['labels']).then(result => {
    if (result.labels) {
        result.labels.forEach(label => {
            browser.menus.create({
                id: `label-${label}`,
                parentId: "autosort-label",
                title: label,
                contexts: ["message_list"]
            });
        });
    }
});

// Add AI analysis option
browser.menus.create({
    id: "autosort-analyze",
    title: "AutoSort+ Analyze with AI",
    contexts: ["message_list"]
});

// Listen for menu clicks
browser.menus.onClicked.addListener(async (info, tab) => {
    if (info.parentMenuItemId === "autosort-label") {
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
    } else if (info.menuItemId === "autosort-analyze") {
        if (window.debugLogger) {
            window.debugLogger.info('[AutoSort+]', 'AI analysis selected - starting batch process');
        }

        try {
            // Guard: refuse if a batch is already running
            if (_batchState.running) {
                await showNotification(
                    'AutoSort+ Busy',
                    'A batch is already in progress. Please wait or cancel it from the settings page.'
                );
                return;
            }

            // Get the current mail tab
            const mailTabs = await browser.mailTabs.query({ active: true, currentWindow: true });
            if (!mailTabs || mailTabs.length === 0) {
                console.error('No active mail tab found');
                await showNotification('AutoSort+ Error', 'No active mail tab found');
                return;
            }

            // Get selected messages using mailTabs API
            const selectedMessageList = await browser.mailTabs.getSelectedMessages(mailTabs[0].id);
            if (!selectedMessageList || !selectedMessageList.messages || selectedMessageList.messages.length === 0) {
                console.error('No messages selected');
                await showNotification('AutoSort+ Error', 'No messages selected for analysis');
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

            // Hand off to the batch engine (runs async, does not block the event listener)
            batchAnalyzeEmails(messages);

        } catch (error) {
            console.error('Error starting batch analysis:', error);
            await showNotification('AutoSort+ Error', `Error: ${error.message}`);
        }
    }
}); 
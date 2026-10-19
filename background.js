// Listen for messages from the options page
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'refreshGeminiUsage') {
        refreshGeminiUsageCounters().then(sendResponse);
        return true;
    } else if (message.action === "applyLabels") {
        applyLabelsToMessages(message.messages, message.label);
    } else if (message.action === "analyzeEmail") {
        analyzeEmailContent(message.emailContent).then(label => {
            sendResponse({ label: label });
        });
        return true; // Required for async response
    } else if (message.action === 'batchCancel') {
        if (batchState.running) {
            batchState.cancelRequested = true;
            sendResponse({ ok: true, cancelling: true });
        } else {
            sendResponse({ ok: true, cancelling: false });
        }
    } else if (message.action === 'batchSync') {
        if (batchState.running && batchState.snapshot) {
            sendResponse(Object.assign({ running: true }, batchState.snapshot));
        } else if (batchState.lastSnapshot) {
            sendResponse(Object.assign({ running: false }, batchState.lastSnapshot));
        } else {
            sendResponse(null);
        }
    } else if (message.action === 'batchRetry') {
        handleBatchRetry(message).then(sendResponse);
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
    }
});

const GEMINI_USAGE_REFRESH_ALARM = 'autosort-gemini-usage-refresh';

// Reconcile counters against their locally stored reset deadlines. Google does
// not expose actual per-key quota through this extension's API permissions.
async function refreshGeminiUsageCounters() {
    return withGeminiRateLimitLock(async () => {
        const data = await browser.storage.local.get([
            'geminiApiKeys', 'geminiRateLimits', 'geminiRateLimit'
        ]);
        const now = Date.now();
        const makeFresh = () => ({
            requests: [],
            dailyCount: 0,
            pendingCount: 0,
            dailyResetTime: null
        });
        let changed = false;
        let resetKeys = 0;

        if (Array.isArray(data.geminiApiKeys) && data.geminiApiKeys.length) {
            const existing = Array.isArray(data.geminiRateLimits) ? data.geminiRateLimits : [];
            const limits = data.geminiApiKeys.map((_, index) => {
                const stored = existing[index];
                if (!stored || typeof stored !== 'object') {
                    changed = true;
                    return makeFresh();
                }
                // Older versions started the countdown on first use. The
                // deadline belongs only to keys that have actually hit cap.
                if ((stored.dailyCount || 0) < 20 && stored.dailyResetTime != null) {
                    changed = true;
                    return Object.assign({}, stored, { dailyResetTime: null });
                }
                if (typeof stored.dailyResetTime === 'number' && now >= stored.dailyResetTime) {
                    changed = true;
                    if ((stored.dailyCount || 0) > 0) resetKeys++;
                    return makeFresh();
                }
                if ((stored.dailyCount || 0) > 20) {
                    changed = true;
                    return Object.assign({}, stored, {
                        dailyCount: 20,
                        dailyResetTime: typeof stored.dailyResetTime === 'number'
                            ? stored.dailyResetTime
                            : now + (24 * 60 * 60 * 1000)
                    });
                }
                if ((stored.dailyCount || 0) === 20 && typeof stored.dailyResetTime !== 'number') {
                    changed = true;
                    return Object.assign({}, stored, { dailyResetTime: now + (24 * 60 * 60 * 1000) });
                }
                return stored;
            });
            if (existing.length !== limits.length) changed = true;
            if (changed) await browser.storage.local.set({ geminiRateLimits: limits });
        } else if (data.geminiRateLimit && typeof data.geminiRateLimit === 'object') {
            const legacy = data.geminiRateLimit;
            if ((legacy.dailyCount || 0) < 20 && legacy.dailyResetTime != null) {
                await browser.storage.local.set({
                    geminiRateLimit: Object.assign({}, legacy, { dailyResetTime: null })
                });
                changed = true;
            } else if (typeof legacy.dailyResetTime === 'number' && now >= legacy.dailyResetTime) {
                await browser.storage.local.set({ geminiRateLimit: makeFresh() });
                changed = true;
                if ((legacy.dailyCount || 0) > 0) resetKeys = 1;
            } else if ((legacy.dailyCount || 0) > 20) {
                await browser.storage.local.set({
                    geminiRateLimit: Object.assign({}, legacy, {
                        dailyCount: 20,
                        dailyResetTime: typeof legacy.dailyResetTime === 'number'
                            ? legacy.dailyResetTime
                            : now + (24 * 60 * 60 * 1000)
                    })
                });
                changed = true;
            } else if ((legacy.dailyCount || 0) === 20 && typeof legacy.dailyResetTime !== 'number') {
                await browser.storage.local.set({
                    geminiRateLimit: Object.assign({}, legacy, { dailyResetTime: now + (24 * 60 * 60 * 1000) })
                });
                changed = true;
            }
        }
        if (resetKeys > 0) {
            const settings = await browser.storage.local.get('geminiResetNotifications');
            if (settings.geminiResetNotifications) {
                const keyLabel = resetKeys === 1 ? 'A used Gemini key is ready again.' : `${resetKeys} used Gemini keys are ready again.`;
                await showNotification('AutoSort+ quota reset', `${keyLabel} You can run email sorting again.`);
            }
        }
        return { ok: true, changed };
    });
}

function scheduleGeminiUsageRefresh() {
    if (!browser.alarms) return;
    // Alarms are a fallback; the persistent MV2 background runs the 10s loop.
    browser.alarms.create(GEMINI_USAGE_REFRESH_ALARM, { periodInMinutes: 1 });
}

if (browser.alarms) {
    browser.alarms.onAlarm.addListener(alarm => {
        if (alarm.name === GEMINI_USAGE_REFRESH_ALARM) refreshGeminiUsageCounters();
    });
    if (browser.runtime.onStartup) browser.runtime.onStartup.addListener(scheduleGeminiUsageRefresh);
    if (browser.runtime.onInstalled) browser.runtime.onInstalled.addListener(scheduleGeminiUsageRefresh);
    scheduleGeminiUsageRefresh();
}

setInterval(() => {
    refreshGeminiUsageCounters().catch(error => {
        console.warn('[AutoSort+] Automatic Gemini usage refresh failed:', error.message);
    });
}, 10000);

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

// Normalize the LM Studio server URL to its root. Users often paste the
// OpenAI-compatible base (http://host:1234/v1) or the native base
// (http://host:1234/api/v1); we always append /api/v1/* ourselves, so strip
// those suffixes to avoid paths like /v1/api/v1/models.
function normalizeLmStudioBaseUrl(rawUrl) {
    let url = (rawUrl || 'http://localhost:1234').trim().replace(/\/+$/, '');
    url = url.replace(/\/(?:api\/v[01]|v1)$/i, '');
    return url.replace(/\/+$/, '') || 'http://localhost:1234';
}

// LM Studio replies HTTP 200 with a JSON `error` body for unknown endpoints,
// so an OK status alone is not enough to know the request succeeded.
function lmStudioErrorFromBody(data) {
    if (!data || !data.error) return null;
    const err = data.error;
    if (typeof err === 'string') return err;
    return err.message || JSON.stringify(err);
}

// Throw a helpful error if LM Studio returned a 200-with-error body.
function assertLmStudioResponse(data) {
    const errMsg = lmStudioErrorFromBody(data);
    if (errMsg) {
        const hint = /unexpected endpoint|not found/i.test(errMsg)
            ? ' Check the LM Studio URL in settings - use the server root (e.g. http://localhost:1234), not the /v1 OpenAI-compatible base.'
            : '';
        throw new Error(`LM Studio error: ${errMsg}.${hint}`);
    }
    return data;
}

// LM Studio native REST API chat (POST /api/v1/chat).
// Tries a direct fetch first (host permission + LM Studio's default CORS),
// then falls back to tab injection for setups where the background fetch is blocked.
async function lmStudioChat(lmUrl, model, prompt, authToken) {
    const base = normalizeLmStudioBaseUrl(lmUrl);
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const body = {
        model,
        input: prompt,
        system_prompt: 'You are an email classification assistant. Respond with only the label.',
        max_output_tokens: 512,
        temperature: 0.2,
        stream: false
    };

    let response;
    try {
        response = await fetch(`${base}/api/v1/chat`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });
    } catch (netErr) {
        console.warn('[LM Studio] Direct fetch failed, falling back to tab injection:', netErr.message);
        const fallbackData = await localChatViaTab(base, '/api/v1/chat', body, authToken);
        return assertLmStudioResponse(fallbackData);
    }

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        let detail = text;
        try { detail = JSON.parse(text).error || text; } catch (e) { /* keep raw text */ }
        throw new Error(`LM Studio HTTP ${response.status}: ${(detail || '').substring(0, 200)}`);
    }

    // LM Studio returns HTTP 200 even for unknown endpoints - detect that here.
    return assertLmStudioResponse(await response.json());
}

// Generic helper: POST JSON from a hidden tab at the local server's origin
// (browser context) to avoid background-script network restrictions.
async function localChatViaTab(baseUrl, path, body, authToken) {
    const tab = await browser.tabs.create({ url: baseUrl, active: false });
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

        const scriptCode = `
        (async () => {
            try {
                const response = await fetch(${JSON.stringify(baseUrl + path)}, {
                    method: 'POST',
                    headers: ${JSON.stringify(headers)},
                    body: ${JSON.stringify(JSON.stringify(body))}
                });
                const text = await response.text();
                window.__local_result = { ok: response.ok, status: response.status, text: text };
            } catch (error) {
                window.__local_result = { ok: false, error: error.message };
            }
        })();
        `;

        await browser.tabs.executeScript(tab.id, { code: scriptCode });

        let result = null;
        for (let i = 0; i < 60; i++) { // 30 seconds max
            await new Promise(resolve => setTimeout(resolve, 500));
            try {
                const results = await browser.tabs.executeScript(tab.id, {
                    code: 'window.__local_result || null'
                });
                if (results && results[0]) {
                    result = results[0];
                    break;
                }
            } catch (e) {
                break;
            }
        }

        if (!result) {
            throw new Error('LM Studio request timed out (30s) - no response from API');
        }
        if (result.error) {
            throw new Error(result.error);
        }
        if (!result.ok) {
            throw new Error(`LM Studio HTTP ${result.status}: ${(result.text || '').substring(0, 200)}`);
        }

        return JSON.parse(result.text);
    } finally {
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

// Serializes all Gemini rate-limit read/modify/write operations. Batch
// processing fires several requests concurrently, so without this lock the
// per-key counters would repeatedly read the same value and clobber each
// other's increments (e.g. 10 emails only adding +1).
let geminiRateLimitQueue = Promise.resolve();
function withGeminiRateLimitLock(task) {
    const run = geminiRateLimitQueue.then(task, task);
    geminiRateLimitQueue = run.then(() => {}, () => {});
    return run;
}

// Gemini rate limiting functions (free tier: 5/min, 20/day per key)
async function checkGeminiRateLimit() {
    return withGeminiRateLimitLock(() => checkGeminiRateLimitInner());
}

async function checkGeminiRateLimitInner() {
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
        const rawRateLimits = Array.isArray(data.geminiRateLimits) ? data.geminiRateLimits : [];
        const rateLimits = keys.map((_, i) => {
            const rl = rawRateLimits[i];
            if (rl && typeof rl === 'object') {
                return {
                    requests: Array.isArray(rl.requests) ? rl.requests : [],
                    dailyCount: typeof rl.dailyCount === 'number' ? rl.dailyCount : 0,
                    pendingCount: Math.max(0, Number(rl.pendingCount) || 0),
                    dailyResetTime: typeof rl.dailyCount === 'number' && rl.dailyCount >= 20 &&
                        typeof rl.dailyResetTime === 'number' ? rl.dailyResetTime : null
                };
            }
            return { requests: [], dailyCount: 0, pendingCount: 0, dailyResetTime: null };
        });
        let currentIndex = (data.currentGeminiKeyIndex || 0) % keys.length;
        
        // Try to find an available key
        const startIndex = currentIndex;
        let attempts = 0;
        
        while (attempts < keys.length) {
            const rateLimit = rateLimits[currentIndex];
            
            // Reset daily count if it's a new day
            if (typeof rateLimit.dailyResetTime === 'number' && now >= rateLimit.dailyResetTime) {
                rateLimit.dailyCount = 0;
                rateLimit.dailyResetTime = null;
                rateLimit.requests = [];
            }
            
            // Remove requests older than 1 minute
            const oneMinuteAgo = now - 60000;
            rateLimit.requests = rateLimit.requests.filter(time => time > oneMinuteAgo);
            
            // Check if this key is available
            if (rateLimit.dailyCount + rateLimit.pendingCount < 20) {
                // Reserve a daily slot and a spaced request time atomically,
                // before another parallel batch item can claim the same slot.
                const lastRequest = rateLimit.requests.length ? Math.max(...rateLimit.requests) : 0;
                const scheduledAt = Math.max(now, lastRequest + 12000);
                const waitTime = Math.ceil((scheduledAt - now) / 1000);
                rateLimit.requests.push(scheduledAt);
                rateLimit.pendingCount += 1;
                await browser.storage.local.set({ 
                    currentGeminiKeyIndex: currentIndex,
                    geminiRateLimits: rateLimits
                });
                
                return {
                    allowed: true,
                    waitTime,
                    keyIndex: currentIndex,
                    reserved: true
                };
            }
            
            // This key has reached its limit, try next one
            currentIndex = (currentIndex + 1) % keys.length;
            attempts++;
        }
        
        // All keys have reached their limits
        const pendingRequests = rateLimits.some(limit => limit.dailyCount < 20 && limit.pendingCount > 0);
        return {
            allowed: false,
            pending: pendingRequests,
            waitTime: pendingRequests ? 1 : 0,
            message: pendingRequests
                ? 'Gemini requests are already using the remaining daily slots. Waiting for one to finish.'
                : `All ${keys.length} Gemini API keys have reached their daily limit (20/day each). Please wait for reset or add more API keys in settings.`
        };
    }
    
    // Legacy single-key mode (backward compatibility)
    const storedRateLimit = data.geminiRateLimit;
    const rateLimit = (storedRateLimit && typeof storedRateLimit === 'object')
        ? {
            requests: Array.isArray(storedRateLimit.requests) ? storedRateLimit.requests : [],
            dailyCount: typeof storedRateLimit.dailyCount === 'number' ? storedRateLimit.dailyCount : 0,
            pendingCount: Math.max(0, Number(storedRateLimit.pendingCount) || 0),
            dailyResetTime: typeof storedRateLimit.dailyCount === 'number' && storedRateLimit.dailyCount >= 20 &&
                typeof storedRateLimit.dailyResetTime === 'number' ? storedRateLimit.dailyResetTime : null
        }
        : { requests: [], dailyCount: 0, pendingCount: 0, dailyResetTime: null };
    
    // Reset daily count if it's a new day
    if (typeof rateLimit.dailyResetTime === 'number' && now >= rateLimit.dailyResetTime) {
        rateLimit.dailyCount = 0;
        rateLimit.dailyResetTime = null;
    }
    
    // Check daily limit (20 per day), including slots reserved by in-flight calls.
    if (rateLimit.dailyCount + rateLimit.pendingCount >= 20) {
        const pending = rateLimit.pendingCount > 0 && rateLimit.dailyCount < 20;
        if (pending) {
            await browser.storage.local.set({ geminiRateLimit: rateLimit });
            return {
                allowed: false,
                pending: true,
                waitTime: 1,
                message: 'Gemini requests are already using the remaining daily slots. Waiting for one to finish.'
            };
        }
    }

    if (rateLimit.dailyCount >= 20) {
        if (typeof rateLimit.dailyResetTime !== 'number') {
            rateLimit.dailyResetTime = now + (24 * 60 * 60 * 1000);
            await browser.storage.local.set({ geminiRateLimit: rateLimit });
        }
        const hoursUntilReset = Math.ceil((rateLimit.dailyResetTime - now) / (1000 * 60 * 60));
        return {
            allowed: false,
            message: `Gemini free tier daily limit reached (20/day). Resets in ${hoursUntilReset} hours. Upgrade to paid plan or add multiple API keys in settings to remove limits.`
        };
    }
    
    // Reserve the next daily slot and space this call from concurrent requests.
    const oneMinuteAgo = now - 60000;
    rateLimit.requests = rateLimit.requests.filter(time => time > oneMinuteAgo);
    const lastRequest = rateLimit.requests.length ? Math.max(...rateLimit.requests) : 0;
    const scheduledAt = Math.max(now, lastRequest + 12000);
    const waitTime = Math.ceil((scheduledAt - now) / 1000);
    rateLimit.requests.push(scheduledAt);
    rateLimit.pendingCount += 1;
    await browser.storage.local.set({ geminiRateLimit: rateLimit });

    return {
        allowed: true,
        waitTime,
        keyIndex: null,
        reserved: true
    };
}

async function trackGeminiRequest(keyIndex = null) {
    return withGeminiRateLimitLock(() => trackGeminiRequestInner(keyIndex));
}

async function trackGeminiRequestInner(keyIndex = null) {
    const now = Date.now();
    
    // Always fetch the latest rate limit state from storage to prevent race conditions
    const data = await browser.storage.local.get([
        'geminiApiKeys',
        'geminiRateLimits',
        'currentGeminiKeyIndex',
        'geminiRateLimit' // Legacy
    ]);
    
    // Multi-key mode
    if (data.geminiApiKeys && data.geminiApiKeys.length > 0 && keyIndex !== null) {
        const keys = data.geminiApiKeys;
        const rawRateLimits = Array.isArray(data.geminiRateLimits) ? data.geminiRateLimits : [];
        let rateLimits = keys.map((_, i) => {
            const rl = rawRateLimits[i];
            if (rl && typeof rl === 'object') {
                return {
                    requests: Array.isArray(rl.requests) ? rl.requests : [],
                    dailyCount: typeof rl.dailyCount === 'number' ? rl.dailyCount : 0,
                    pendingCount: Math.max(0, Number(rl.pendingCount) || 0),
                    dailyResetTime: typeof rl.dailyCount === 'number' && rl.dailyCount >= 20 &&
                        typeof rl.dailyResetTime === 'number' ? rl.dailyResetTime : null
                };
            }
            return { requests: [], dailyCount: 0, pendingCount: 0, dailyResetTime: null };
        });
        
        const rateLimit = rateLimits[keyIndex];
        
        // Add current request
        rateLimit.pendingCount = Math.max(0, rateLimit.pendingCount - 1);
        rateLimit.dailyCount = Math.min(20, rateLimit.dailyCount + 1);
        if (rateLimit.dailyCount >= 20 && typeof rateLimit.dailyResetTime !== 'number') {
            rateLimit.dailyResetTime = now + (24 * 60 * 60 * 1000);
        }
        
        // Clean old requests (older than 1 minute)
        const oneMinuteAgo = now - 60000;
        rateLimit.requests = rateLimit.requests.filter(time => time > oneMinuteAgo);
        
        // Update in the array
        rateLimits[keyIndex] = rateLimit;
        
        await browser.storage.local.set({ geminiRateLimits: rateLimits });
        
        console.log(`Gemini Key #${keyIndex + 1}: ${rateLimit.dailyCount}/20 today, ${rateLimit.requests.length} in last minute`);
    } else {
        // Legacy single-key mode
        const storedRateLimit = data.geminiRateLimit;
        let rateLimit = (storedRateLimit && typeof storedRateLimit === 'object')
            ? {
                requests: Array.isArray(storedRateLimit.requests) ? storedRateLimit.requests : [],
                dailyCount: typeof storedRateLimit.dailyCount === 'number' ? storedRateLimit.dailyCount : 0,
                pendingCount: Math.max(0, Number(storedRateLimit.pendingCount) || 0),
                dailyResetTime: typeof storedRateLimit.dailyCount === 'number' && storedRateLimit.dailyCount >= 20 &&
                    typeof storedRateLimit.dailyResetTime === 'number' ? storedRateLimit.dailyResetTime : null
            }
            : { requests: [], dailyCount: 0, pendingCount: 0, dailyResetTime: null };
        
        // Add current request
        rateLimit.pendingCount = Math.max(0, rateLimit.pendingCount - 1);
        rateLimit.dailyCount = Math.min(20, rateLimit.dailyCount + 1);
        if (rateLimit.dailyCount >= 20 && typeof rateLimit.dailyResetTime !== 'number') {
            rateLimit.dailyResetTime = now + (24 * 60 * 60 * 1000);
        }
        
        // Clean old requests (older than 1 minute)
        const oneMinuteAgo = now - 60000;
        rateLimit.requests = rateLimit.requests.filter(time => time > oneMinuteAgo);
        
        await browser.storage.local.set({ geminiRateLimit: rateLimit });
        
        console.log(`Gemini requests: ${rateLimit.dailyCount}/20 today, ${rateLimit.requests.length} in last minute`);
    }
}

async function releaseGeminiRequestReservation(keyIndex = null) {
    return withGeminiRateLimitLock(async () => {
        const data = await browser.storage.local.get(['geminiApiKeys', 'geminiRateLimits', 'geminiRateLimit']);
        if (Array.isArray(data.geminiApiKeys) && data.geminiApiKeys.length && keyIndex !== null) {
            const limits = data.geminiApiKeys.map((_, index) => {
                const stored = Array.isArray(data.geminiRateLimits) ? data.geminiRateLimits[index] : null;
                if (!stored || typeof stored !== 'object') {
                    return { requests: [], dailyCount: 0, pendingCount: 0, dailyResetTime: null };
                }
                return Object.assign({}, stored, {
                    pendingCount: Math.max(0, (Number(stored.pendingCount) || 0) - (index === keyIndex ? 1 : 0))
                });
            });
            await browser.storage.local.set({ geminiRateLimits: limits });
        } else if (data.geminiRateLimit && typeof data.geminiRateLimit === 'object') {
            await browser.storage.local.set({
                geminiRateLimit: Object.assign({}, data.geminiRateLimit, {
                    pendingCount: Math.max(0, (Number(data.geminiRateLimit.pendingCount) || 0) - 1)
                })
            });
        }
    });
}

// Function to show notification
async function showNotification(title, message, type = "basic") {
    // Log to console if desktop notifications are unavailable.
    console.log(`[AutoSort+] ${title}: ${message}`);
    
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

async function playSortingCompletionSound() {
    try {
        const AudioContextConstructor = typeof AudioContext !== 'undefined'
            ? AudioContext
            : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null);
        if (!AudioContextConstructor) return;

        const context = new AudioContextConstructor();
        if (context.state === 'suspended') await context.resume();
        const startAt = context.currentTime + 0.03;
        const master = context.createGain();
        master.gain.value = 0.7;
        master.connect(context.destination);

        // Three clear, two-tone chime notes, about two seconds long.
        [0, 0.68, 1.36].forEach((offset, index) => {
            const noteStart = startAt + offset;
            const noteLength = 0.52;
            [index === 1 ? 784 : 659, index === 1 ? 988 : 784].forEach((frequency, toneIndex) => {
                const oscillator = context.createOscillator();
                const envelope = context.createGain();
                const toneStart = noteStart + toneIndex * 0.1;
                oscillator.type = 'triangle';
                oscillator.frequency.value = frequency;
                envelope.gain.setValueAtTime(0.0001, toneStart);
                envelope.gain.linearRampToValueAtTime(0.42, toneStart + 0.025);
                envelope.gain.setValueAtTime(0.42, toneStart + noteLength - 0.08);
                envelope.gain.exponentialRampToValueAtTime(0.0001, toneStart + noteLength);
                oscillator.connect(envelope);
                envelope.connect(master);
                oscillator.start(toneStart);
                oscillator.stop(toneStart + noteLength + 0.02);
            });
        });
        setTimeout(() => context.close().catch(() => {}), 2400);
    } catch (error) {
        console.warn('[AutoSort+] Could not play sorting completion sound:', error.message);
    }
}

// Function to update existing notification
async function updateNotification(id, title, message) {
    // Log to console
    console.log(`[AutoSort+] ${title}: ${message}`);
    
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

// Build a Gemini generationConfig that matches the selected model family.
// Gemini 3.x uses `thinkingLevel`; Gemini 2.5.x uses `thinkingBudget`.
// Sending both (or the wrong one) causes a 400 error.
function buildGeminiGenerationConfig(geminiModel) {
    const config = {
        // Gemini 3 counts thinking tokens against this budget as well. 50 is
        // often exhausted before it emits even a short classification label.
        maxOutputTokens: 512,
        responseMimeType: "text/plain"
    };

    if (/^gemini-3/.test(geminiModel)) {
        // Gemini 3.x: sampling params are deprecated; "low" thinking minimizes cost/latency.
        config.thinkingConfig = { thinkingLevel: "low" };
    } else {
        config.temperature = 0.2;
        config.topK = 1;
        config.topP = 1;
        if (geminiModel.includes("2.5")) {
            // Gemini 2.5.x: 0 disables thinking (Flash/Lite only).
            config.thinkingConfig = { thinkingBudget: 0 };
        }
    }

    return config;
}

function getGeminiRetryDelayMs(response, errorData, retryAttempt) {
    const retryAfter = response.headers && response.headers.get('Retry-After');
    if (retryAfter) {
        const seconds = Number(retryAfter);
        if (Number.isFinite(seconds)) return Math.max(1000, seconds * 1000);
        const dateDelay = Date.parse(retryAfter) - Date.now();
        if (Number.isFinite(dateDelay) && dateDelay > 0) return dateDelay;
    }

    const details = errorData && errorData.error && errorData.error.details;
    if (Array.isArray(details)) {
        const retryInfo = details.find(item => item && /RetryInfo/.test(item['@type'] || ''));
        const match = retryInfo && String(retryInfo.retryDelay || '').match(/([\d.]+)s/);
        if (match) return Math.max(1000, Math.ceil(Number(match[1]) * 1000));
    }

    const message = errorData && errorData.error && errorData.error.message || '';
    const messageMatch = message.match(/retry in\s+([\d.]+)s/i);
    if (messageMatch) return Math.max(1000, Math.ceil(Number(messageMatch[1]) * 1000));

    // No provider delay was supplied: use a bounded exponential backoff.
    return Math.min(60000, 10000 * Math.pow(2, retryAttempt));
}

// Function to analyze email content using AI
async function analyzeEmailContent(emailContent, notify) {
    // `notify(title, message)` routes status updates to a custom sink when
    // provided (batch processing forwards them to the progress panel);
    // default to desktop notifications.
    const notifyFn = typeof notify === 'function' ? notify : showNotification;
    let geminiReservationActive = false;
    let geminiReservationKeyIndex = null;
    const releaseReservation = async () => {
        if (!geminiReservationActive) return;
        await releaseGeminiRequestReservation(geminiReservationKeyIndex);
        geminiReservationActive = false;
    };
    try {
        const notificationId = await notifyFn(
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
            'geminiModel',
            'providerModel'
        ]);
        const provider = settings.aiProvider || 'gemini';
        
        // Check Gemini rate limits (free tier only)
        let keyIndexToUse = null;
        if (provider === 'gemini' && !settings.geminiPaidPlan) {
            let rateLimitCheck;
            while (true) {
                rateLimitCheck = await checkGeminiRateLimit();
                if (rateLimitCheck.allowed) break;
                if (rateLimitCheck.pending) {
                    await new Promise(resolve => setTimeout(resolve, (rateLimitCheck.waitTime || 1) * 1000));
                    continue;
                }

                // Show persistent notification for limit reached
                const isSingleKey = !settings.geminiApiKeys || settings.geminiApiKeys.length <= 1;
                const notifTitle = isSingleKey ? "⛔ Gemini API Limit Reached" : "⛔ All Gemini Keys at Limit";
                
                const notifId = await notifyFn(
                    notifTitle,
                    rateLimitCheck.message,
                    "list"
                );
                
                // Also try to update the current notification
                await notifyFn(
                    notificationId,
                    "AutoSort+ Rate Limit",
                    rateLimitCheck.message
                );
                throw new Error(rateLimitCheck.message);
            }

            keyIndexToUse = rateLimitCheck.keyIndex;
            geminiReservationKeyIndex = keyIndexToUse;
            geminiReservationActive = rateLimitCheck.reserved === true;
            
            if (rateLimitCheck.waitTime > 0) {
                await notifyFn(
                    notificationId,
                    "AutoSort+ Rate Limit",
                    `Rate limit reached. Waiting ${rateLimitCheck.waitTime} seconds...`
                );
                await new Promise(resolve => setTimeout(resolve, rateLimitCheck.waitTime * 1000));
            }
        }
        
        console.log("Settings retrieved:", {
            hasApiKey: !!(settings.apiKey || (settings.geminiApiKeys && settings.geminiApiKeys.length > 0)),
            provider: provider,
            labels: settings.labels,
            enableAi: settings.enableAi !== false
        });
        
        if (settings.enableAi === false) {
            console.error("AI is disabled");
            await notifyFn(
                notificationId,
                "AutoSort+ Error",
                "AI analysis is disabled in settings."
            );
            await releaseReservation();
            return null;
        }
        
        // Check API key availability based on provider
        let apiKeyToUse = null;
        if (provider === 'gemini') {
            if (settings.geminiApiKeys && settings.geminiApiKeys.length > 0) {
                const keyIndex = keyIndexToUse !== null ? keyIndexToUse : (settings.currentGeminiKeyIndex || 0);
                apiKeyToUse = settings.geminiApiKeys[keyIndex];
                console.log(`Using Gemini API Key #${keyIndex + 1} of ${settings.geminiApiKeys.length}`);
            } else if (settings.apiKey) {
                // Legacy single key
                apiKeyToUse = settings.apiKey;
            }
        } else if (provider !== 'ollama' && provider !== 'lmstudio') {
            // Local providers don't need an API key; other providers do
            apiKeyToUse = settings.apiKey;
        }
        
        if (!apiKeyToUse && provider !== 'ollama' && provider !== 'lmstudio') {
            console.error("Missing API key");
            await notifyFn(
                notificationId,
                "AutoSort+ Error",
                `${provider.charAt(0).toUpperCase() + provider.slice(1)} API key not configured. Please add your API key in settings.`
            );
            await releaseReservation();
            return null;
        }
        
        if (!settings.labels || settings.labels.length === 0) {
            console.error("No labels configured");
            await notifyFn(
                notificationId,
                "AutoSort+ Error",
                "No folders/labels configured. Please go to settings and either load folders from your mail account or add custom labels."
            );
            await releaseReservation();
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

        await notifyFn(
            notificationId,
            "AutoSort+ AI Analysis",
            `Sending request to ${provider.charAt(0).toUpperCase() + provider.slice(1)} AI...`
        );

        let response;
        let data;

        if (provider === 'gemini') {
            // Gemini model is configurable (new API keys can no longer use 2.5 models)
            const geminiModel = settings.geminiModel || 'gemini-3.5-flash-lite';
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKeyToUse}`;
            console.log(`Making API request to Gemini (${geminiModel})...`);
            
            await notifyFn(
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
                generationConfig: buildGeminiGenerationConfig(geminiModel),
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

            const sendGeminiRequest = () => fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            response = await sendGeminiRequest();

            // Gemini may return 429 with a RetryInfo or "Please retry in Ns".
            // Honor that delay and retry the same email request a few times;
            // failures do not increment the local usage counter.
            let quotaRetry = 0;
            const maxQuotaRetries = 5;
            while (response.status === 429 && quotaRetry < maxQuotaRetries) {
                let errorData = null;
                try { errorData = await response.clone().json(); } catch (e) { /* use fallback delay */ }
                const retryDelayMs = getGeminiRetryDelayMs(response, errorData, quotaRetry);
                const retrySeconds = Math.ceil(retryDelayMs / 1000);
                await notifyFn(
                    notificationId,
                    'AutoSort+ Rate Limit',
                    `Gemini quota is temporarily full. Retrying in ${retrySeconds} seconds (${quotaRetry + 1}/${maxQuotaRetries})...`
                );
                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                quotaRetry++;
                response = await sendGeminiRequest();
            }

        } else if (provider === 'openai') {
            console.log("Making API request to OpenAI...");
            
            await notifyFn(
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
                    model: settings.providerModel || 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 50,
                    temperature: 0.2
                })
            });

        } else if (provider === 'anthropic') {
            console.log("Making API request to Anthropic...");
            
            await notifyFn(
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
                    model: settings.providerModel || 'claude-3-haiku-20240307',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 50
                })
            });

        } else if (provider === 'groq') {
            console.log("Making API request to Groq...");
            
            await notifyFn(
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
                    model: settings.providerModel || 'openai/gpt-oss-120b',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 200,
                    temperature: 0.2,
                    reasoning_effort: 'low'
                })
            });

        } else if (provider === 'mistral') {
            console.log("Making API request to Mistral...");
            
            await notifyFn(
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
                    model: settings.providerModel || 'mistral-small-latest',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 50,
                    temperature: 0.2
                })
            });

        } else if (provider === 'ollama') {
            console.log("Making API request to Ollama (local)...");
            
            await notifyFn(
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
            
            console.log(`Using Ollama at ${ollamaUrl} with model ${ollamaModel}${cpuOnly ? ' (CPU-only)' : ''}`);

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

        } else if (provider === 'lmstudio') {
            console.log("Making API request to LM Studio (local)...");

            await notifyFn(
                notificationId,
                "AutoSort+ AI Analysis",
                "Analyzing email content with local LM Studio..."
            );

            const lmSettings = await browser.storage.local.get([
                'lmstudioUrl', 'lmstudioModel', 'lmstudioCustomModel', 'lmstudioAuthToken'
            ]);
            const lmUrl = lmSettings.lmstudioUrl || 'http://localhost:1234';
            let lmModel = lmSettings.lmstudioModel || '';
            const lmAuthToken = lmSettings.lmstudioAuthToken || '';

            // Resolve the custom-model sentinel to the user's typed model name
            if (!lmModel || lmModel === 'custom' || lmModel === '__custom__') {
                lmModel = lmSettings.lmstudioCustomModel || '';
            }

            if (!lmModel) {
                throw new Error('No LM Studio model configured. Open settings and select a model.');
            }

            console.log(`Using LM Studio at ${lmUrl} with model ${lmModel}`);

            data = await lmStudioChat(lmUrl, lmModel, prompt, lmAuthToken);
            response = null; // Mark as handled

        } else {
            throw new Error(`Unknown provider: ${provider}`);
        }

        if (response) {
            console.log("API response status:", response.status);

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
                
                // Handle model-not-found errors (e.g. retired/restricted Gemini models)
                if (response.status === 404 || /is not found|no longer available|does not exist/i.test(errorMessage)) {
                    const modelHint = provider === 'gemini'
                        ? ' Choose a different model under Settings → Gemini Model.'
                        : ' Check the Model field in Settings.';
                    errorMessage = `${errorMessage}${modelHint}`;
                }
                
                // Handle Ollama auth errors
                if (response.status === 403) {
                    errorMessage = "Ollama authentication failed (403). Check your API key/token if Ollama requires authentication.";
                }
                
                await notifyFn(
                    notificationId,
                    "AutoSort+ Error",
                    `API Error: ${errorMessage}`
                );
                await releaseReservation();
                return null;
            }

            // Count only requests accepted successfully by Gemini. Failed
            // HTTP responses and network errors should not consume the local
            // daily usage counter. Successful responses count even if the
            // model output is truncated or cannot be mapped to a label.
            if (provider === 'gemini' && !settings.geminiPaidPlan) {
                await trackGeminiRequest(keyIndexToUse);
                geminiReservationActive = false;
            }

            await notifyFn(
                notificationId,
                "AutoSort+ AI Analysis",
                "Processing AI response..."
            );

            data = await response.json();
            console.log("Full API response data:", JSON.stringify(data, null, 2));
        } else if (data) {
            await notifyFn(
                notificationId,
                "AutoSort+ AI Analysis",
                "Processing AI response..."
            );
            console.log("Using response from native helper.");
        } else {
            await notifyFn(
                notificationId,
                "AutoSort+ Error",
                "No response received from provider."
            );
            await releaseReservation();
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
                    console.warn("Gemini reached its output token limit; attempting to use the returned label text.");
                }
                if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                    label = tryTrim(candidate.content.parts[0].text);
                }
            }
        } else if (provider === 'openai' || provider === 'groq' || provider === 'mistral') {
            if (data.choices && data.choices.length > 0) {
                label = tryTrim(data.choices[0].message?.content || data.choices[0].text);
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
        } else if (provider === 'lmstudio') {
            // LM Studio native API: { output: [{ type: "message", content: "..." }, ...] }
            try {
                if (Array.isArray(data.output)) {
                    const msg = data.output.find(o => o.type === 'message' && o.content)
                        || data.output.find(o => o && o.content);
                    if (msg) label = tryTrim(msg.content);
                }
                if (!label) {
                    // OpenAI-compatible / other fallback shapes
                    label = tryTrim(
                        (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ||
                        data.response ||
                        data.content
                    );
                }
            } catch (e) {
                console.warn('Failed to parse LM Studio response shape:', e.message);
                label = null;
            }
        }

        if (!label) {
            console.error("No label extracted from response:", data);
            await notifyFn(notificationId, "AutoSort+ Error", "No response from AI");
            return null;
        }

        console.log("Raw generated label:", label);

        // Normalize and try to match configured labels more forgivingly
        const normalize = s => s.toString().trim().replace(/^['"`]+|['"`]+$/g, '');
        const lower = normalize(label).toLowerCase();

        // Exact match first
        if (settings.labels.includes(label)) {
            await notifyFn(notificationId, "AutoSort+ Success", `AI analysis complete. Selected label: ${label}`);
            return label;
        }

        // Try to find a label that matches case-insensitively or is contained within the AI output
        let matched = settings.labels.find(l => l.toLowerCase() === lower);
        if (!matched) {
            matched = settings.labels.find(l => lower.includes(l.toLowerCase()) || l.toLowerCase().includes(lower));
        }

        if (matched) {
            console.log('Mapped AI output to configured label:', matched);
            await notifyFn(notificationId, "AutoSort+ Success", `AI analysis complete. Selected label: ${matched}`);
            return matched;
        }

        console.log("Label not found in configured labels. Generated:", label);
        await notifyFn(notificationId, "AutoSort+ Warning", `AI suggested: "${label}" but it's not in your configured labels.`);
        return null;
    } catch (error) {
        try { await releaseReservation(); } catch (releaseError) {
            console.warn('[AutoSort+] Could not release Gemini usage reservation:', releaseError.message);
        }
        console.error("Error analyzing email:", error);
        await notifyFn(
            "AutoSort+ Error",
            `Error analyzing email: ${error.message}`
        );
        return null;
    }
}

// ---- Batch processing with progress tracking ----

// Shared state for the current/last batch, pushed to the progress tab.
const batchState = {
    running: false,
    cancelRequested: false,
    progressTabId: null,
    snapshot: null,     // latest progress payload for a running batch
    lastSnapshot: null  // retained after completion so the tab can re-sync
};

async function getApiKeyUsageInfo() {
    try {
        const data = await browser.storage.local.get(['geminiApiKeys', 'geminiRateLimits', 'currentGeminiKeyIndex', 'geminiPaidPlan']);
        if (!data.geminiApiKeys || data.geminiApiKeys.length === 0) return null;
        const rateLimits = Array.isArray(data.geminiRateLimits) ? data.geminiRateLimits : [];
        const currentIndex = data.currentGeminiKeyIndex || 0;
        return data.geminiApiKeys.map((key, idx) => ({
            index: idx + 1,
            dailyCount: (rateLimits[idx] && typeof rateLimits[idx].dailyCount === 'number') ? rateLimits[idx].dailyCount : 0,
            active: idx === currentIndex,
            resetTime: (rateLimits[idx] && rateLimits[idx].dailyResetTime) || null
        }));
    } catch (e) {
        return null;
    }
}

// Push a progress snapshot to the batch progress tab (if still open).
async function pushBatchSnapshot(patch) {
    const usageInfo = await getApiKeyUsageInfo();
    const snap = Object.assign({}, batchState.snapshot, patch);
    snap.counts = Object.assign({}, (batchState.snapshot && batchState.snapshot.counts) || {}, patch.counts || {});
    snap.results = patch.results || (batchState.snapshot && batchState.snapshot.results) || [];
    if (usageInfo) snap.apiKeyUsage = usageInfo;
    batchState.snapshot = snap;
    batchState.lastSnapshot = snap;

    try {
            await browser.runtime.sendMessage(Object.assign({ action: 'batchProgress' }, snap));
        } catch (e) {
            console.warn('[AutoSort+] Progress tab closed; continuing batch without UI:', e.message);
        }
}

// Extract readable text from a full message object (recursive MIME parts).
async function extractEmailContentFromMessage(fullMessage) {
    async function extractTextFromParts(parts) {
        let text = "";
        if (!parts) return text;

        for (const part of parts) {
            if (part.parts) {
                text += await extractTextFromParts(part.parts);
            }

            if (part.contentType === "text/plain") {
                text += (part.body ?? "") + "\n";
            } else if (part.contentType === "text/html" && !text) {
                // Only use HTML if we haven't found plain text
                text = await browser.messengerUtilities.convertToPlainText(part.body ?? "");
            } else if (part.contentType === "message/rfc822" && part.body) {
                text += (part.body ?? "") + "\n";
            }
        }
        return text;
    }

    if (fullMessage.parts) {
        return await extractTextFromParts(fullMessage.parts);
    }
    const body = fullMessage.body;
    return typeof body === 'string' ? body : (body ? String(body) : '');
}

// Resolve the destination folder for a label. Handles the built-in category
// hierarchy, direct matches, and auto-creating folders for custom labels.
async function findTargetFolder(account, label) {
    const findFolder = (folders, targetName) => {
        for (const folder of folders) {
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

    let targetFolder = null;

    for (const category of categories) {
        if (label.startsWith(category)) {
            const categoryFolder = findFolder(account.folders, category);
            if (categoryFolder) {
                const subfolderName = label.replace(category + "/", "");
                targetFolder = findFolder(categoryFolder.subFolders || [], subfolderName);
                break;
            }
        }
    }

    // If no category match found, try direct match
    if (!targetFolder) {
        targetFolder = findFolder(account.folders, label);
    }

    // Auto-create missing folder when it's a custom label (skip imported/structured labels)
    if (!targetFolder) {
        const looksImported = label.includes('/') || label.includes('\\');
        if (looksImported) {
            console.warn(`Folder "${label}" looks imported/structured; skipping auto-create.`);
        } else {
            try {
                const parentFolder = account.folders && account.folders.length > 0 ? account.folders[0] : null;
                if (parentFolder && browser.folders && browser.folders.create) {
                    console.log(`Creating missing folder "${label}" under ${parentFolder.name || 'root'}`);
                    const created = await browser.folders.create(parentFolder, label);
                    if (created) {
                        targetFolder = created;
                        console.log("Created folder:", created);
                    }
                }
            } catch (createError) {
                console.error(`Failed to create folder "${label}":`, createError);
            }
        }
    }

    return targetFolder;
}

// Process multiple selected emails with progress tracking.
// Each message is AI-analyzed and moved to its sorted folder; per-message
// outcomes are reported to the progress tab as sorted/skipped/failed.
async function runBatchProcessing(messages, progressTabId, options = {}) {
    const mergeResults = Array.isArray(options.mergeResults) ? options.mergeResults : null;
    const retriedIds = new Set(messages.map(m => m.id));

    // When retrying failures, keep prior outcomes for messages not being retried
    const results = (mergeResults || []).filter(r => !retriedIds.has(r.id));
    const counts = { sorted: 0, skipped: 0, failed: 0 };
    for (const r of results) {
        counts[r.status] = (counts[r.status] || 0) + 1;
    }
    const total = results.length + messages.length;

    batchState.running = true;
    batchState.cancelRequested = false;
    batchState.progressTabId = progressTabId;
    batchState.snapshot = null;
    batchState.lastSnapshot = null;

    // Route AI status updates to the progress panel instead of desktop notifications
    let lastAiStatus = '';
    const notify = (title, message) => {
        lastAiStatus = message || '';
    };

    await pushBatchSnapshot({ phase: 'processing', current: results.length, total, counts, subject: '', aiStatus: '', results });

    // Parallelism: how many emails to analyze at once. Prefer an explicit
    // option, otherwise read the user's setting (Settings → Parallel batch
    // size), clamped to 1-20 with a default of 5.
    let chunkSizeOption = options.chunkSize;
    if (chunkSizeOption === undefined || chunkSizeOption === null) {
        try {
            const stored = await browser.storage.local.get('batchChunkSize');
            chunkSizeOption = stored.batchChunkSize;
        } catch (e) {
            // Fall back to the default below.
        }
    }
    const chunkSize = Math.min(20, Math.max(1, parseInt(chunkSizeOption || 5, 10)));
    let rateLimitHit = false;

    for (let i = 0; i < messages.length; i += chunkSize) {
        if (batchState.cancelRequested || rateLimitHit) {
            console.log('[AutoSort+] Batch stopped/cancelled');
            break;
        }

        const chunk = messages.slice(i, i + chunkSize);

        const chunkPromises = chunk.map(async (message) => {
            if (batchState.cancelRequested || rateLimitHit) return;

            const subject = message.subject || '(No subject)';
            let status = 'failed';
            let label = null;
            let detail = null;

            const maxRetries = Math.max(0, parseInt(options.maxRetries || 2, 10));
            // Analyze at most once per email; retries reuse this result so a
            // transient failure (e.g. a move error) never spends another API call.
            let cachedAiLabel;
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                status = 'failed';
                label = null;
                detail = null;
                try {
                    const fullMessage = await browser.messages.getFull(message.id);
                    if (!fullMessage) {
                        throw new Error('Email already moved or no longer available');
                    }

                    const emailContent = await extractEmailContentFromMessage(fullMessage);
                    if (!emailContent || typeof emailContent !== 'string' || !emailContent.trim()) {
                        status = 'skipped';
                        detail = 'No readable content';
                        break;
                    } else {
                        if (cachedAiLabel === undefined) {
                            cachedAiLabel = await analyzeEmailContent(emailContent, notify);
                        }
                        const aiLabel = cachedAiLabel;
                        if (!aiLabel || String(aiLabel).trim().toLowerCase() === 'null') {
                            status = 'skipped';
                            detail = 'AI returned no label';
                        } else {
                            const account = await browser.accounts.get(message.folder.accountId);
                            const targetFolder = await findTargetFolder(account, aiLabel);
                            if (!targetFolder) {
                                status = 'failed';
                                detail = `Folder "${aiLabel}" not found. Please create it first in Thunderbird.`;
                            } else {
                                try {
                                    await browser.messages.move([message.id], targetFolder.id);
                                    status = 'sorted';
                                    label = aiLabel;
                                    detail = targetFolder.name;
                                    break;
                                } catch (moveError) {
                                    status = 'failed';
                                    detail = moveError.message || String(moveError);
                                }
                            }
                        }
                    }
                } catch (err) {
                    status = 'failed';
                    detail = err.message || String(err);
                    if (/limit/i.test(detail)) {
                        rateLimitHit = true;
                        break;
                    }
                }

                // Only retry genuinely transient failures (move/fetch errors).
                // Deterministic outcomes (no label, missing folder) are not
                // retried, since they would just consume more API quota.
                const retryable = status === 'failed'
                    && !/limit/i.test(detail || '')
                    && !/not found/i.test(detail || '')
                    && !/already moved/i.test(detail || '');
                if (!retryable || attempt === maxRetries) break;
                await new Promise(r => setTimeout(r, 1000));
            }

            const res = {
                id: message.id,
                subject,
                status,
                label,
                detail,
                timestamp: new Date().toISOString()
            };

            counts[res.status]++;
            results.push(res);
            await storeMoveHistory({
                subject: res.subject,
                status: res.status === 'sorted' ? 'Success' : 'Error',
                destination: res.label || res.detail || ''
            });

            if (rateLimitHit && /limit/i.test(res.detail)) {
                await pushBatchSnapshot({ phase: 'stopped', current: results.length, total, counts, subject: res.subject, aiStatus: res.detail, results });
                batchState.running = false;
            } else {
                await pushBatchSnapshot({
                    current: results.length,
                    subject: res.subject,
                    aiStatus: lastAiStatus,
                    counts,
                    results
                });
            }

            return res;
        });

        await Promise.all(chunkPromises);

        if (rateLimitHit) break;
    }

    const cancelled = batchState.cancelRequested;
    const phase = cancelled ? 'cancelled' : 'done';
    batchState.running = false;
    batchState.progressTabId = null;

    await pushBatchSnapshot({ phase, current: results.length, total, counts, results, aiStatus: lastAiStatus, subject: '' });

    if (!cancelled && results.length === total) {
        const soundSetting = await browser.storage.local.get('completionSoundEnabled');
        if (soundSetting.completionSoundEnabled === true) {
            await playSortingCompletionSound();
        }
    }

    if (cancelled) {
        await showNotification(
            "AutoSort+ Batch Cancelled",
            `Processed ${results.length}/${total} message(s): ${counts.sorted} sorted, ${counts.skipped} skipped, ${counts.failed} failed`
        );
    } else if (counts.failed === 0 && counts.skipped === 0) {
        await showNotification("AutoSort+ Success", `Batch complete: sorted ${counts.sorted} message(s)`);
    } else {
        await showNotification(
            "AutoSort+ Batch Complete",
            `Processed ${total} message(s): ${counts.sorted} sorted, ${counts.skipped} skipped, ${counts.failed} failed`
        );
    }
}

// Re-run only the messages that failed in the last batch.
async function handleBatchRetry(message) {
    if (batchState.running) {
        return { ok: false, error: 'A batch is already running' };
    }
    const failedIds = (message.messageIds || []).filter(Boolean);
    if (failedIds.length === 0) {
        return { ok: false, error: 'No failed messages to retry' };
    }

    const retryMessages = [];
    for (const id of failedIds) {
        try {
            retryMessages.push(await browser.messages.get(id));
        } catch (e) {
            console.warn(`[AutoSort+] Could not reload message ${id} for retry:`, e.message);
        }
    }
    if (retryMessages.length === 0) {
        return { ok: false, error: 'Failed messages could not be reloaded' };
    }

    let tabId = batchState.progressTabId;
    if (!tabId) {
        const tab = await browser.tabs.create({ url: browser.runtime.getURL('batch.html'), active: true });
        tabId = tab.id;
    }

    const mergeResults = batchState.lastSnapshot ? batchState.lastSnapshot.results : null;
    runBatchProcessing(retryMessages, tabId, { mergeResults }).catch(err => {
        console.error('[AutoSort+] Retry batch failed:', err);
    });

    return { ok: true, retried: retryMessages.length };
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
            console.log("Processing message:", message.id);
            console.log("Target label/folder:", label);
            
            // Get all folders to find the destination folder
            const account = await browser.accounts.get(message.folder.accountId);
            console.log("Account info:", account);

            await updateNotification(
                notificationId,
                "AutoSort+ Processing",
                `Finding destination folder for message ${successCount + errorCount + 1}/${messageCount}...`
            );

            const targetFolder = await findTargetFolder(account, label);

            console.log("Moving message to folder:", targetFolder ? targetFolder.name : "not found");

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
        console.log("[AutoSort+] Results:", message);
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
    title: "AutoSort+ Batch Analyze with AI",
    contexts: ["message_list"]
});

// Listen for menu clicks
browser.menus.onClicked.addListener(async (info, tab) => {
    if (info.parentMenuItemId === "autosort-label") {
        const label = info.menuItemId.replace("label-", "");
        console.log(`Manual label selected: ${label}`);
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
        console.log("AI analysis selected - starting batch process");

        if (batchState.running) {
            await showNotification("AutoSort+", "A batch is already running. Cancel it or wait for it to finish.");
            if (batchState.progressTabId) {
                try {
                    await browser.tabs.update(batchState.progressTabId, { active: true });
                } catch (e) { /* progress tab was closed */ }
            }
            return;
        }

        try {
            // Get the current mail tab
            const mailTabs = await browser.mailTabs.query({ active: true, currentWindow: true });
            if (!mailTabs || mailTabs.length === 0) {
                console.error("No active mail tab found");
                await showNotification("AutoSort+ Error", "No active mail tab found");
                return;
            }
            console.log("Current mail tab:", mailTabs[0]);

            // Get selected messages using mailTabs API
            const selectedMessageList = await browser.mailTabs.getSelectedMessages(mailTabs[0].id);
            console.log("Selected message list:", selectedMessageList);

            if (!selectedMessageList || !selectedMessageList.messages || selectedMessageList.messages.length === 0) {
                console.error("No messages selected");
                await showNotification("AutoSort+ Error", "No messages selected for analysis");
                return;
            }

            console.log(`Starting batch AI analysis of ${selectedMessageList.messages.length} selected messages`);

            // Open the progress panel in a tab so the user can watch and control the batch
            const progressTab = await browser.tabs.create({
                url: browser.runtime.getURL('batch.html'),
                active: true
            });

            await runBatchProcessing(selectedMessageList.messages, progressTab.id);
        } catch (error) {
            console.error("Error during AI analysis:", error);
            await showNotification("AutoSort+ Error", `Error: ${error.message}`);
        }
    }
});

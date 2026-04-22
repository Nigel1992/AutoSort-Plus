/**
 * Tab Fetch Utility - Execute fetch in browser context via tab injection
 * Used for localhost endpoints that background scripts can't access directly
 */

/**
 * Execute a fetch request via hidden tab injection
 * @param {string} baseUrl - The base URL to open (e.g., "http://localhost:11434")
 * @param {object} options - Fetch options
 * @param {string} options.endpoint - API endpoint path (e.g., "/api/chat")
 * @param {object} options.body - Request body (will be JSON.stringify'd)
 * @param {object} options.headers - Request headers
 * @param {number} options.timeoutMs - Timeout in milliseconds (default 30000)
 * @param {string} options.resultKey - Window key for result (default "__tab_fetch_result")
 * @returns {Promise<object>} - The response data
 */
async function fetchViaTab(baseUrl, options = {}) {
    const {
        endpoint = '',
        body = {},
        headers = {},
        timeoutMs = 30000,
        resultKey = '__tab_fetch_result'
    } = options;

    const tab = await browser.tabs.create({ url: baseUrl, active: false });
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
        const headersJson = JSON.stringify({ 'Content-Type': 'application/json', ...headers });
        const bodyJson = JSON.stringify(body);

        const scriptCode = `
(async () => {
    try {
        const headers = ${headersJson};
        const response = await fetch(window.location.origin + '${endpoint}', {
            method: 'POST',
            headers,
            body: ${bodyJson}
        });

        if (!response.ok) {
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
        }

        const data = await response.json();
        window.${resultKey} = { ok: true, data };
    } catch (error) {
        window.${resultKey} = { ok: false, error: error.message };
    }
})();
`;

        await browser.tabs.executeScript(tab.id, { code: scriptCode });

        const maxIterations = Math.ceil(timeoutMs / 500);
        let result = null;

        for (let i = 0; i < maxIterations; i++) {
            await new Promise(resolve => setTimeout(resolve, 500));

            try {
                const results = await browser.tabs.executeScript(tab.id, {
                    code: `window.${resultKey} || null`
                });
                if (results?.[0]) {
                    result = results[0];
                    break;
                }
            } catch (e) {
                break;
            }
        }

        if (!result) {
            throw new Error(`Tab fetch timed out (${timeoutMs}ms)`);
        }

        if (!result.ok) {
            throw new Error(result.error || 'Unknown error');
        }

        return result.data;

    } finally {
        try {
            await browser.tabs.remove(tab.id);
        } catch (e) {}
    }
}

/**
 * Helper for Ollama chat via tab
 */
async function ollamaChatViaTabUtil(ollamaUrl, model, prompt, authToken) {
    const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
    return fetchViaTab(ollamaUrl, {
        endpoint: '/api/chat',
        body: { model, messages: [{ role: 'user', content: prompt }], stream: false },
        headers,
        resultKey: '__ollama_result'
    });
}

/**
 * Helper for OpenAI-compatible chat via tab
 */
async function openaiCompatChatViaTabUtil(baseUrl, model, prompt, apiKey) {
    const headers = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};
    return fetchViaTab(baseUrl, {
        endpoint: '/v1/chat/completions',
        body: { model, messages: [{ role: 'user', content: prompt }], max_tokens: 8192, stream: false },
        headers,
        resultKey: '__openai_compat_result'
    });
}

// Export for use in other contexts
if (typeof window !== 'undefined') {
    window.tabFetchUtils = {
        fetchViaTab,
        ollamaChatViaTabUtil,
        openaiCompatChatViaTabUtil
    };
}
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
        
        console.log(`Gemini Key #${keyIndex + 1}: ${rateLimit.dailyCount}/20 today, ${rateLimit.requests.length} in last minute`);
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
        
        console.log(`Gemini requests: ${rateLimit.dailyCount}/20 today, ${rateLimit.requests.length} in last minute`);
    }
}

// Function to show notification
async function showNotification(title, message, type = "basic") {
    // Log to console (Thunderbird doesn't support browser.notifications)
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
            'geminiRateLimits'
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
        
        console.log("Settings retrieved:", {
            hasApiKey: !!(settings.apiKey || (settings.geminiApiKeys && settings.geminiApiKeys.length > 0)),
            provider: provider,
            labels: settings.labels,
            enableAi: settings.enableAi !== false
        });
        
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
                console.log(`Using Gemini API Key #${keyIndex + 1} of ${settings.geminiApiKeys.length}`);
            } else if (settings.apiKey) {
                // Legacy single key
                apiKeyToUse = settings.apiKey;
            }
        } else if (provider !== 'ollama') {
            // Ollama doesn't need an API key; other providers do
            apiKeyToUse = settings.apiKey;
        }
        
        if (!apiKeyToUse && provider !== 'ollama') {
            console.error("Missing API key");
            await updateNotification(
                notificationId,
                "AutoSort+ Error",
                `${provider.charAt(0).toUpperCase() + provider.slice(1)} API key not configured. Please add your API key in settings.`
            );
            return null;
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
            console.log("Making API request to Gemini...");
            
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
            console.log("Making API request to OpenAI...");
            
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
            console.log("Making API request to Anthropic...");
            
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
            console.log("Making API request to Groq...");
            
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
            console.log("Making API request to Mistral...");
            
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
            console.log("Making API request to Ollama (local)...");
            
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
            console.log("Full API response data:", JSON.stringify(data, null, 2));
        } else if (data) {
            await updateNotification(
                notificationId,
                "AutoSort+ AI Analysis",
                "Processing AI response..."
            );
            console.log("Using response from native helper.");
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
        
        if (provider === 'gemini') {
            if (data.candidates && data.candidates.length > 0) {
                const candidate = data.candidates[0];
                if (candidate.finishReason === "MAX_TOKENS") {
                    console.error("Response truncated");
                    await updateNotification(notificationId, "AutoSort+ Error", "AI response was cut off");
                    return null;
                }
                if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                    label = candidate.content.parts[0].text.trim();
                }
            }
        } else if (provider === 'openai' || provider === 'groq' || provider === 'mistral') {
            if (data.choices && data.choices.length > 0) {
                label = data.choices[0].message.content.trim();
            }
        } else if (provider === 'anthropic') {
            if (data.content && data.content.length > 0) {
                label = data.content[0].text.trim();
            }
        } else if (provider === 'ollama') {
            if (data.message && data.message.content) {
                label = data.message.content.trim();
            } else if (typeof data.message === 'string') {
                label = data.message.trim();
            }
        }
        
        if (!label) {
            console.error("No label extracted from response:", data);
            await updateNotification(notificationId, "AutoSort+ Error", "No response from AI");
            return null;
        }
        
        console.log("Generated label:", label);
        
        // Verify the label exists in our list
        if (settings.labels.includes(label)) {
            await updateNotification(
                notificationId,
                "AutoSort+ Success",
                `AI analysis complete. Selected label: ${label}`
            );
            return label;
        } else {
            console.log("Label not found in configured labels. Generated:", label);
            await updateNotification(
                notificationId,
                "AutoSort+ Warning",
                `AI suggested: "${label}" but it's not in your configured labels.`
            );
            return null;
        }
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

            // Find the folder with matching name
            const findFolder = (folders, targetName) => {
                for (const folder of folders) {
                    console.log("Checking folder:", folder.name);
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
                    console.log("Found matching category:", category);
                    categoryFolder = findFolder(account.folders, category);
                    if (categoryFolder) {
                        console.log("Found category folder:", categoryFolder.name);
                        // Try to find the subfolder
                        const subfolderName = label.replace(category + "/", "");
                        console.log("Looking for subfolder:", subfolderName);
                        targetFolder = findFolder(categoryFolder.subFolders || [], subfolderName);
                        break;
                    } else {
                        console.log("Category folder not found:", category, "- skipping to next category");
                        continue;
                    }
                }
            }

            // If no target folder found, try direct match
            if (!targetFolder) {
                console.log("No category match found, trying direct folder match");
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
    title: "AutoSort+ Analyze with AI",
    contexts: ["message_list"]
});

// Listen for menu clicks
browser.menus.onClicked.addListener(async (info, tab) => {
    if (info.parentMenuItemId === "autosort-label") {
        const label = info.menuItemId.replace("label-", "");
        console.log(`Manual label selected: ${label}`);
        await showNotification("AutoSort+", `Applying label: ${label}`);
        try {
            // Get selected messages from content script
            const response = await browser.tabs.sendMessage(tab.id, {
                action: "getSelectedMessages",
                label: label
            });
            console.log("Got selected messages from content script:", response);
            
            if (response && response.length > 0) {
                // Get the current mail tab for processing
                const mailTabs = await browser.mailTabs.query({ active: true, currentWindow: true });
                if (mailTabs && mailTabs.length > 0) {
                    // Get full message objects
                    const messages = await browser.mailTabs.getSelectedMessages(mailTabs[0].id);
                    if (messages && messages.messages && messages.messages.length > 0) {
                        await applyLabelsToMessages(messages.messages, label);
                    }
                }
            }
        } catch (error) {
            console.error("Error applying manual label:", error);
            await showNotification("AutoSort+ Error", `Error applying label: ${error.message}`);
        }
    } else if (info.menuItemId === "autosort-analyze") {
        console.log("AI analysis selected - starting process");
        await showNotification("AutoSort+", "Starting AI analysis of selected messages...");
        
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

            console.log(`Analyzing ${selectedMessageList.messages.length} selected messages`);
            
            for (const message of selectedMessageList.messages) {
                // Get the full message with body
                const fullMessage = await browser.messages.getFull(message.id);
                console.log("Got full message:", fullMessage ? "yes" : "no");
                console.log("Message content:", fullMessage);

                if (!fullMessage) {
                    console.error("Could not get message content");
                    continue;
                }

                // Function to recursively extract text from message parts
                function extractTextFromParts(parts) {
                    let text = "";
                    if (!parts) return text;

                    for (const part of parts) {
                        console.log("Processing part:", {
                            contentType: part.contentType,
                            partName: part.partName,
                            size: part.size
                        });

                        if (part.parts) {
                            // Recursively process nested parts
                            text += extractTextFromParts(part.parts);
                        }
                        
                        if (part.contentType === "text/plain") {
                            text += part.body + "\n";
                        } else if (part.contentType === "text/html" && !text) {
                            // Only use HTML if we haven't found plain text
                            text = browser.messengerUtilities.convertToPlainText(part.body);
                        } else if (part.contentType === "message/rfc822" && part.body) {
                            // Handle message/rfc822 parts
                            text += part.body + "\n";
                        }
                    }
                    return text;
                }

                // Extract email content from the message
                let emailContent = "";
                if (fullMessage.parts) {
                    emailContent = await extractTextFromParts(fullMessage.parts);
                } else if (fullMessage.body) {
                    emailContent = fullMessage.body;
                }

                console.log("Extracted email content:", emailContent || "<empty string>");

                if (!emailContent) {
                    console.error("No readable content found in message");
                    await showNotification("AutoSort+ Error", "Could not extract email content");
                    continue;
                }

                console.log("Analyzing message content");
                const label = await analyzeEmailContent(emailContent);

                // Skip if AI returned null/no label
                if (!label || String(label).trim().toLowerCase() === "null") {
                    console.log("Skipping message because generated label was null/empty");
                    continue;
                }

                console.log("Applying label:", label);
                await applyLabelsToMessages([message], label);
                await showNotification("AutoSort+", `Successfully applied label: ${label}`);
            }
        } catch (error) {
            console.error("Error during AI analysis:", error);
            await showNotification("AutoSort+ Error", `Error: ${error.message}`);
        }
    }
}); 
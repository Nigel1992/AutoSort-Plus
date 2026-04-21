document.addEventListener('DOMContentLoaded', async function() {
    // Initialize debug logger
    if (window.debugLogger) {
        window.debugLogger.init();
    }

    // Initialize collapsible sections
    const sectionHeaders = document.querySelectorAll('.section-header');
    sectionHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const sectionId = this.getAttribute('data-section');
            const content = document.getElementById(sectionId);
            const section = this.parentElement;
            const icon = this.querySelector('.collapse-icon');
            
            if (section.classList.contains('collapsed')) {
                // Expand
                section.classList.remove('collapsed');
                content.style.display = 'block';
                icon.textContent = '▼';
                // Trigger animation
                setTimeout(() => {
                    content.style.animation = 'slideDown 0.3s ease-out';
                }, 0);
            } else {
                // Collapse
                section.classList.add('collapsed');
                content.style.display = 'none';
                icon.textContent = '▶';
            }
        });
    });
    
    const labelsContainer = document.getElementById('labels-container');
    const addLabelButton = document.getElementById('add-label');
    const saveButton = document.getElementById('save-settings');
    const apiKeyInput = document.getElementById('api-key');
    const aiProviderSelect = document.getElementById('ai-provider');
    const providerInfo = document.getElementById('provider-info');
    const getApiKeyButton = document.getElementById('get-api-key');
    const testApiButton = document.getElementById('test-api');
    const apiTestResult = document.getElementById('api-test-result');
    const geminiPaidContainer = document.getElementById('gemini-paid-container');
    const geminiPaidCheckbox = document.getElementById('gemini-paid-plan');
    const importLabelsButton = document.getElementById('import-labels');
    const bulkImportTextarea = document.getElementById('bulk-import-text');
    const loadImapFoldersButton = document.getElementById('load-imap-folders');
    const folderLoadingIndicator = document.getElementById('folder-loading');
    const folderSelection = document.getElementById('folder-selection');
    const foldersPreview = document.getElementById('folders-preview');
    const folderCount = document.getElementById('folder-count');
    const useImapFoldersButton = document.getElementById('use-imap-folders');
    const useCustomFoldersButton = document.getElementById('use-custom-folders');
    const geminiMultiKeysContainer = document.getElementById('gemini-multi-keys-container');
    const geminiKeysList = document.getElementById('gemini-keys-list');
    const addGeminiKeyButton = document.getElementById('add-gemini-key');
    
    // Ollama-specific elements  
    const ollamaModelSelect = document.getElementById('ollama-model');
    const ollamaCustomModelInput = document.getElementById('ollama-custom-model');
    const ollamaUrlInput = document.getElementById('ollama-url');
    const ollamaAuthTokenInput = document.getElementById('ollama-auth-token');
    const ollamaCpuOnlyCheckbox = document.getElementById('ollama-cpu-only');
    const testOllamaButton = document.getElementById('test-ollama');
    const listOllamaModelsButton = document.getElementById('list-ollama-models');
    const downloadOllamaModelButton = document.getElementById('download-ollama-model');
    const ollamaDownloadModelInput = document.getElementById('ollama-download-model');
    const ollamaDownloadStatus = document.getElementById('ollama-download-status');
    const ollamaTestResult = document.getElementById('ollama-test-result');
    const diagnoseOllamaButton = document.getElementById('diagnose-ollama');
    const ollamaDiagnostics = document.getElementById('ollama-diagnostics');

    // OpenAI-Compatible elements
    const customBaseUrlInput = document.getElementById('custom-base-url');
    const customModelSelect = document.getElementById('custom-model-select');
    const customModelCustomInput = document.getElementById('custom-model-custom');
    const customApiKeyInput = document.getElementById('custom-api-key');
    const fetchCustomModelsButton = document.getElementById('fetch-custom-models');
    const testCustomEndpointButton = document.getElementById('test-custom-endpoint');
    const customTestResult = document.getElementById('custom-test-result');

    // Debug mode element
    const enableDebugCheckbox = document.getElementById('enable-debug');
    
    // Update endpoint URLs when Ollama URL changes
    if (ollamaUrlInput) {
        ollamaUrlInput.addEventListener('input', () => {
            const url = ollamaUrlInput.value.trim() || 'http://localhost:11434';
            const chatEndpoint = document.getElementById('ollama-chat-endpoint');
            const pullEndpoint = document.getElementById('ollama-pull-endpoint');
            const tagsEndpoint = document.getElementById('ollama-tags-endpoint');

            if (chatEndpoint) chatEndpoint.textContent = `${url}/api/chat`;
            if (pullEndpoint) pullEndpoint.textContent = `${url}/api/pull`;
            if (tagsEndpoint) tagsEndpoint.textContent = `${url}/api/tags`;

            updateSaveButtonState();
        });
    }
    
    let loadedFolders = [];
    let geminiKeys = []; // Array to store multiple Gemini API keys
    
    // AI Provider configurations
    const aiProviders = {
        gemini: {
            name: 'Google Gemini',
            signupUrl: 'https://aistudio.google.com/app/apikey',
            info: '✓ Free tier: 5 requests/minute, 20/day per API key (enforced by addon)<br>✓ Tip: Create multiple API keys in different projects, switch keys when limit reached<br>✓ Check usage: <a href="https://aistudio.google.com/usage" target="_blank">AI Studio Usage</a><br>✓ Best for: General use, multilingual support<br>✓ Models: Gemini 2.5 Flash<br>✓ Check "paid plan" option to remove limits',
            isFree: true
        },
        openai: {
            name: 'OpenAI',
            signupUrl: 'https://platform.openai.com/signup',
            info: '✓ Free trial: $5 credit<br>✓ Best for: High accuracy, English content<br>✓ Models: GPT-4o-mini ($0.15/1M tokens)',
            isFree: false
        },
        anthropic: {
            name: 'Anthropic Claude',
            signupUrl: 'https://console.anthropic.com/',
            info: '✓ Free tier: Limited requests<br>✓ Best for: Long emails, detailed analysis<br>✓ Models: Claude 3 Haiku',
            isFree: true
        },
        groq: {
            name: 'Groq',
            signupUrl: 'https://console.groq.com/',
            info: '✓ Free tier: 30 requests/minute<br>✓ Best for: Speed (fastest)<br>✓ Models: Llama 3.3 (Mixtral deprecated)',
            isFree: true
        },
        mistral: {
            name: 'Mistral AI',
            signupUrl: 'https://console.mistral.ai/',
            info: '✓ Free tier: Limited requests<br>✓ Best for: European users, GDPR compliance<br>✓ Models: Mistral Small',
            isFree: true
        },
        ollama: {
            name: 'Ollama (Local LLM)',
            signupUrl: 'https://ollama.ai/',
            info: '✓ 100% Free: Runs locally on your machine<br>✓ Privacy: No data sent to external servers<br>✓ No rate limits: Process unlimited emails<br>✓ Models: Llama 2/3, Mistral, Phi, Gemma, Qwen, and more<br>✓ Requires: <a href="https://ollama.ai/download" target="_blank">Ollama installed</a> and running locally<br>✓ Setup: Install Ollama, run "ollama pull llama3.2" to download a model',
            isFree: true
        },
        'openai-compatible': {
            name: 'OpenAI-Compatible',
            signupUrl: '',
            info: '✓ Compatible with: LocalAI, LM Studio, vLLM, Together AI, OpenRouter, DeepSeek, Fireworks, etc.<br>✓ Enter your endpoint base URL and model name<br>✓ API key optional for local servers<br>✓ Uses standard /v1/chat/completions format',
            isFree: true
        }
    };
    
    // Update provider info when selection changes
    function updateProviderInfo() {
        const provider = aiProviderSelect.value;
        const config = aiProviders[provider];
        
        // Get subsection elements
        const ollamaSubsection = document.getElementById('ollama-settings-subsection');
        const apiKeySubsection = document.getElementById('api-key-subsection');
        const geminiMultiKeysSubsection = document.getElementById('gemini-multi-keys-subsection');
        const geminiUsageSubsection = document.getElementById('gemini-usage-subsection');
        const rateLimitWarning = document.getElementById('rate-limit-warning');
        const openaiCompatibleSubsection = document.getElementById('openai-compatible-settings-subsection');

        // Show/hide rate limit warning (not for Ollama or OpenAI-Compatible local)
        if (rateLimitWarning) {
            rateLimitWarning.style.display = (provider === 'ollama' || provider === 'openai-compatible') ? 'none' : 'block';
        }
        
        // Show/hide Gemini-specific elements
        if (provider === 'gemini') {
            geminiPaidContainer.style.display = 'block';
            if (geminiMultiKeysSubsection) geminiMultiKeysSubsection.style.display = 'block';
            if (geminiUsageSubsection) geminiUsageSubsection.style.display = 'block';
            if (apiKeySubsection) apiKeySubsection.style.display = 'none';
            if (ollamaSubsection) ollamaSubsection.style.display = 'none';
            if (openaiCompatibleSubsection) openaiCompatibleSubsection.style.display = 'none';
            updateGeminiUsageDisplay();
        } else if (provider === 'ollama') {
            // Show Ollama settings, hide API key and Gemini sections
            geminiPaidContainer.style.display = 'none';
            if (geminiMultiKeysSubsection) geminiMultiKeysSubsection.style.display = 'none';
            if (geminiUsageSubsection) geminiUsageSubsection.style.display = 'none';
            if (apiKeySubsection) apiKeySubsection.style.display = 'none';
            if (ollamaSubsection) ollamaSubsection.style.display = 'block';
            if (openaiCompatibleSubsection) openaiCompatibleSubsection.style.display = 'none';
        } else if (provider === 'openai-compatible') {
            // Show OpenAI-Compatible settings, hide others
            geminiPaidContainer.style.display = 'none';
            if (geminiMultiKeysSubsection) geminiMultiKeysSubsection.style.display = 'none';
            if (geminiUsageSubsection) geminiUsageSubsection.style.display = 'none';
            if (apiKeySubsection) apiKeySubsection.style.display = 'none';
            if (ollamaSubsection) ollamaSubsection.style.display = 'none';
            if (openaiCompatibleSubsection) openaiCompatibleSubsection.style.display = 'block';
        } else {
            geminiPaidContainer.style.display = 'none';
            if (geminiMultiKeysSubsection) geminiMultiKeysSubsection.style.display = 'none';
            if (geminiUsageSubsection) geminiUsageSubsection.style.display = 'none';
            if (apiKeySubsection) apiKeySubsection.style.display = 'block';
            if (ollamaSubsection) ollamaSubsection.style.display = 'none';
            if (openaiCompatibleSubsection) openaiCompatibleSubsection.style.display = 'none';
        }
        
        providerInfo.innerHTML = `
            <div class="provider-details">
                <strong>${config.name}</strong> ${config.isFree ? '<span class="free-badge">FREE</span>' : '<span class="paid-badge">PAID</span>'}
                <p>${config.info}</p>
            </div>
        `;

        if (provider !== 'ollama' && provider !== 'openai-compatible') {
            apiKeyInput.placeholder = `Enter your ${config.name} API key`;
        }

        // Update save button state when provider changes
        updateSaveButtonState();
    }
    
    // Update Gemini usage display
    async function updateGeminiUsageDisplay() {
        const data = await browser.storage.local.get(['geminiRateLimits', 'currentGeminiKeyIndex', 'geminiApiKeys', 'geminiRateLimit']);
        const currentIndex = data.currentGeminiKeyIndex || 0;
        const keys = data.geminiApiKeys || geminiKeys;
        
        if (keys.length > 1) {
            // Multi-key mode
            document.getElementById('single-key-usage').style.display = 'none';
            document.getElementById('multi-key-usage').style.display = 'block';
            const rateLimits = data.geminiRateLimits || [];
            updateMultiKeyUsageDisplay(keys, rateLimits, currentIndex);
        } else if (keys.length === 1) {
            // Single-key mode but stored in new format
            document.getElementById('single-key-usage').style.display = 'block';
            document.getElementById('multi-key-usage').style.display = 'none';
            const rateLimits = data.geminiRateLimits || [{ requests: [], dailyCount: 0, dailyResetTime: Date.now() }];
            updateSingleKeyUsageDisplay(rateLimits[0]);
        } else {
            // Legacy single-key mode (backward compatibility)
            document.getElementById('single-key-usage').style.display = 'block';
            document.getElementById('multi-key-usage').style.display = 'none';
            const rateLimit = data.geminiRateLimit || { requests: [], dailyCount: 0, dailyResetTime: Date.now() };
            updateSingleKeyUsageDisplay(rateLimit);
        }
    }
    
    // Update single key usage display (backward compatibility)
    async function updateSingleKeyUsageDisplay(rateLimit) {
        const now = Date.now();
        
        // Update daily count
        document.getElementById('gemini-daily-count').textContent = rateLimit.dailyCount;
        
        // Update last request time
        if (rateLimit.requests && rateLimit.requests.length > 0) {
            const lastRequest = Math.max(...rateLimit.requests);
            const minutesAgo = Math.floor((now - lastRequest) / 60000);
            if (minutesAgo < 1) {
                document.getElementById('gemini-last-request').textContent = 'Just now';
            } else if (minutesAgo < 60) {
                document.getElementById('gemini-last-request').textContent = `${minutesAgo} minute${minutesAgo > 1 ? 's' : ''} ago`;
            } else {
                const hoursAgo = Math.floor(minutesAgo / 60);
                document.getElementById('gemini-last-request').textContent = `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago`;
            }
        } else {
            document.getElementById('gemini-last-request').textContent = 'Never';
        }
        
        // Update reset time
        if (rateLimit.dailyResetTime > now) {
            const hoursUntil = Math.ceil((rateLimit.dailyResetTime - now) / (1000 * 60 * 60));
            document.getElementById('gemini-reset-time').textContent = `In ${hoursUntil} hour${hoursUntil > 1 ? 's' : ''}`;
        } else {
            document.getElementById('gemini-reset-time').textContent = 'Expired (will reset on next request)';
        }
        
        // Update status and show warnings
        const usageMessage = document.getElementById('usage-message');
        const statusSpan = document.getElementById('gemini-status');
        
        if (rateLimit.dailyCount >= 20) {
            statusSpan.textContent = '🔴 Limit Reached';
            statusSpan.style.color = '#dc3545';
            usageMessage.className = 'usage-message warning';
            usageMessage.textContent = '⚠️ Daily limit reached! Create a new API key in a different project and update it above to continue processing emails.';
        } else if (rateLimit.dailyCount >= 15) {
            statusSpan.textContent = '🟡 Nearly Full';
            statusSpan.style.color = '#ffc107';
            usageMessage.className = 'usage-message warning';
            usageMessage.textContent = `⚠️ Only ${20 - rateLimit.dailyCount} requests remaining today. Consider switching to a new API key soon.`;
        } else {
            statusSpan.textContent = '🟢 Ready';
            statusSpan.style.color = '#28a745';
            usageMessage.style.display = 'none';
        }
    }
    
    // Update multi-key usage display
    function updateMultiKeyUsageDisplay(keys, rateLimits, currentIndex) {
        const container = document.getElementById('all-keys-usage-stats');
        const now = Date.now();
        container.innerHTML = '';
        
        keys.forEach((key, index) => {
            const rateLimit = rateLimits[index] || { requests: [], dailyCount: 0, dailyResetTime: now };
            const isActive = index === currentIndex;
            
            const card = document.createElement('div');
            card.className = `key-usage-card${isActive ? ' active' : ''}`;
            
            // Determine status
            let statusBadge = '';
            if (isActive) {
                statusBadge = '<span class="key-status active">🔵 ACTIVE</span>';
            } else if (rateLimit.dailyCount >= 20) {
                statusBadge = '<span class="key-status limit">🔴 LIMIT</span>';
            } else if (rateLimit.dailyCount >= 15) {
                statusBadge = '<span class="key-status warning">🟡 NEAR LIMIT</span>';
            } else {
                statusBadge = '<span class="key-status ready">🟢 READY</span>';
            }
            
            // Calculate reset time
            let resetText = '--';
            if (rateLimit.dailyResetTime > now) {
                const hoursUntil = Math.ceil((rateLimit.dailyResetTime - now) / (1000 * 60 * 60));
                resetText = `${hoursUntil}h`;
            }
            
            // Last request time
            let lastRequestText = 'Never';
            if (rateLimit.requests && rateLimit.requests.length > 0) {
                const lastRequest = Math.max(...rateLimit.requests);
                const minutesAgo = Math.floor((now - lastRequest) / 60000);
                if (minutesAgo < 1) {
                    lastRequestText = 'Just now';
                } else if (minutesAgo < 60) {
                    lastRequestText = `${minutesAgo}m ago`;
                } else {
                    lastRequestText = `${Math.floor(minutesAgo / 60)}h ago`;
                }
            }
            
            // Mask key for display
            const maskedKey = key ? `...${key.slice(-8)}` : 'Not set';
            
            card.innerHTML = `
                <div class="key-header">
                    <span class="key-title">Key ${index + 1}: ${maskedKey}</span>
                    ${statusBadge}
                </div>
                <div class="key-stats">
                    <div class="stat-item">
                        <span class="stat-label">Usage:</span>
                        <span class="stat-value">${rateLimit.dailyCount}/20</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Last:</span>
                        <span class="stat-value">${lastRequestText}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Resets:</span>
                        <span class="stat-value">${resetText}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Available:</span>
                        <span class="stat-value">${20 - rateLimit.dailyCount}</span>
                    </div>
                </div>
            `;
            
            container.appendChild(card);
        });
    }
    
    // Add Gemini key input field
    function addGeminiKeyInput(value = '', index = -1) {
        if (index === -1) {
            index = geminiKeys.length;
            geminiKeys.push(value);
        }
        
        const keyItem = document.createElement('div');
        keyItem.className = 'gemini-key-item';
        keyItem.dataset.index = index;
        
        const keyIndex = document.createElement('span');
        keyIndex.className = 'key-index';
        keyIndex.textContent = `#${index + 1}`;
        
        const input = document.createElement('input');
        input.type = 'password';
        input.className = 'gemini-api-key-input';
        input.placeholder = 'Enter Gemini API key from another project';
        input.value = value;
        input.dataset.index = index;
        input.addEventListener('input', (e) => {
            const newKey = e.target.value.trim();
            geminiKeys[index] = newKey;

            // Check for duplicates in real-time
            if (newKey) {
                const isDuplicate = geminiKeys.some((key, i) => i !== index && key.trim() === newKey);
                if (isDuplicate) {
                    input.style.borderColor = '#dc3545';
                    input.title = '⚠️ This key is already added!';
                } else {
                    input.style.borderColor = '';
                    input.title = '';
                }
            } else {
                input.style.borderColor = '';
                input.title = '';
            }

            // Update save button state
            updateSaveButtonState();
        });
        
        const testButton = document.createElement('button');
        testButton.className = 'button';
        testButton.textContent = 'Test';
        testButton.addEventListener('click', () => {
            const keyValue = input.value.trim();
            if (!keyValue) {
                statusSpan.textContent = '⚠️ Enter key first';
                statusSpan.className = 'key-test-result error';
                return;
            }
            
            // Check for duplicates before testing
            const isDuplicate = geminiKeys.some((key, i) => i !== index && key.trim() === keyValue);
            if (isDuplicate) {
                statusSpan.textContent = '⚠️ Duplicate key';
                statusSpan.className = 'key-test-result error';
                statusSpan.title = 'This key is already added in the list';
                return;
            }
            
            testGeminiKey(keyValue, index, keyItem);
        });
        
        const removeButton = document.createElement('button');
        removeButton.className = 'button';
        removeButton.textContent = '×';
        removeButton.addEventListener('click', () => removeGeminiKey(index));
        
        const statusSpan = document.createElement('span');
        statusSpan.className = 'key-test-result';
        statusSpan.dataset.index = index;
        
        keyItem.appendChild(keyIndex);
        keyItem.appendChild(input);
        keyItem.appendChild(testButton);
        keyItem.appendChild(removeButton);
        keyItem.appendChild(statusSpan);
        geminiKeysList.appendChild(keyItem);
    }
    
    // Remove Gemini key
    function removeGeminiKey(index) {
        if (geminiKeys.length <= 1) {
            alert('You must have at least one API key configured.');
            return;
        }
        
        if (confirm(`Remove API key #${index + 1}?`)) {
            geminiKeys.splice(index, 1);
            refreshGeminiKeysList();
        }
    }
    
    // Refresh Gemini keys list display
    function refreshGeminiKeysList() {
        geminiKeysList.innerHTML = '';
        geminiKeys.forEach((key, index) => {
            addGeminiKeyInput(key, index);
        });
    }
    
    // Test individual Gemini key
    async function testGeminiKey(apiKey, index, keyItemElement) {
        const statusSpan = keyItemElement.querySelector('.key-test-result');
        
        if (!apiKey) {
            statusSpan.textContent = '⚠️ Enter key first';
            statusSpan.className = 'key-test-result error';
            return;
        }
        
        try {
            statusSpan.textContent = 'Testing...';
            statusSpan.className = 'key-test-result testing';
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: "Test" }] }],
                    generationConfig: { maxOutputTokens: 10 }
                })
            });
            
            if (response.ok) {
                statusSpan.textContent = '✓ Valid';
                statusSpan.className = 'key-test-result success';
            } else if (response.status === 429) {
                statusSpan.textContent = '⚠️ Limit reached';
                statusSpan.className = 'key-test-result error';
                statusSpan.title = 'This key has reached its daily rate limit (20/day). Will reset in ~24 hours.';
                console.error(`Key #${index + 1} has reached rate limit (429)`);
            } else if (response.status === 401 || response.status === 403) {
                statusSpan.textContent = '✗ Invalid key';
                statusSpan.className = 'key-test-result error';
                statusSpan.title = 'API key is invalid or expired. Check your key in Google AI Studio.';
                console.error(`Key #${index + 1} test failed: ${response.status}`);
            } else {
                statusSpan.textContent = `✗ Failed (${response.status})`;
                statusSpan.className = 'key-test-result error';
                console.error(`Key #${index + 1} test failed:`, response.status);
            }
        } catch (error) {
            statusSpan.textContent = `✗ Error`;
            statusSpan.className = 'key-test-result error';
            console.error(`Key #${index + 1} test error:`, error);
        }
    }
    
    // Initialize provider info
    updateProviderInfo();
    aiProviderSelect.addEventListener('change', updateProviderInfo);
    
    // Add Gemini key button
    addGeminiKeyButton.addEventListener('click', () => {
        addGeminiKeyInput('');
    });
    
    // Reset Gemini counter button
    document.getElementById('reset-gemini-counter').addEventListener('click', async () => {
        if (confirm('Reset usage counter? Do this only after switching to a new API key.')) {
            await browser.storage.local.set({ 
                geminiRateLimit: { 
                    requests: [], 
                    dailyCount: 0, 
                    dailyResetTime: Date.now() + (24 * 60 * 60 * 1000)
                } 
            });
            await updateGeminiUsageDisplay();
            const usageMessage = document.getElementById('usage-message');
            usageMessage.className = 'usage-message info';
            usageMessage.textContent = '✓ Usage counter reset. You can now process up to 20 more emails today with your new API key.';
        }
    });
    
    // Refresh usage button (single key)
    document.getElementById('refresh-usage').addEventListener('click', async () => {
        await updateGeminiUsageDisplay();
        const usageMessage = document.getElementById('usage-message');
        usageMessage.className = 'usage-message info';
        usageMessage.textContent = '✓ Usage information refreshed.';
        setTimeout(() => {
            if (usageMessage.classList.contains('info')) {
                usageMessage.style.display = 'none';
            }
        }, 3000);
    });
    
    // Refresh all usage button (multi key)
    document.getElementById('refresh-all-usage').addEventListener('click', async () => {
        await updateGeminiUsageDisplay();
        showMessage('✓ All usage information refreshed.', true);
    });
    
    // Get API Key button
    getApiKeyButton.addEventListener('click', async () => {
        const provider = aiProviderSelect.value;
        const config = aiProviders[provider];

        // Skip if provider has no signup URL (like openai-compatible)
        if (!config.signupUrl) {
            showMessage('This provider doesn\'t have a signup URL. Configure the endpoint directly in the settings above.', false);
            return;
        }

        try {
            // Try to open in new tab
            await browser.tabs.create({ url: config.signupUrl });
        } catch (error) {
            console.error('Failed to open tab:', error);
            // Fallback: show URL and copy to clipboard
            const url = config.signupUrl;
            try {
                await navigator.clipboard.writeText(url);
                showMessage(`URL copied to clipboard:\n${url}`, true);
            } catch (e) {
                // Last resort: show alert with URL
                alert(`Please visit:\n${url}`);
            }
        }
    });

    // Function to validate and update save button state
    function updateSaveButtonState() {
        const labels = Array.from(document.querySelectorAll('.label-input'))
            .map(input => input.value.trim())
            .filter(label => label !== '');
        
        const provider = aiProviderSelect.value;
        let hasValidApiKey = true; // Default to true, override based on provider

        if (provider === 'gemini') {
            const validGeminiKeys = geminiKeys.filter(key => key && key.trim() !== '');
            hasValidApiKey = validGeminiKeys.length > 0;
        } else if (provider === 'ollama') {
            // Ollama needs URL and model configured
            const ollamaUrl = ollamaUrlInput ? ollamaUrlInput.value.trim() : '';
            let ollamaModel = ollamaModelSelect ? ollamaModelSelect.value : '';
            const ollamaCustomModel = ollamaCustomModelInput ? ollamaCustomModelInput.value.trim() : '';
            hasValidApiKey = !!ollamaUrl && (!!ollamaModel || (!!ollamaCustomModel && ollamaModel === 'custom'));
        } else if (provider === 'openai-compatible') {
            // OpenAI-compatible needs baseUrl and model, not API key
            const baseUrl = customBaseUrlInput ? customBaseUrlInput.value.trim() : '';
            const model = customModelSelect ? customModelSelect.value : '';
            const customModel = customModelCustomInput ? customModelCustomInput.value.trim() : '';
            hasValidApiKey = !!baseUrl && (!!model || (!!customModel && model === 'custom'));
        } else {
            // Non-Ollama providers (OpenAI, Anthropic, Groq, Mistral) require API key
            const apiKey = apiKeyInput.value.trim();
            hasValidApiKey = !!apiKey;
        }
        
        if (labels.length === 0 || !hasValidApiKey) {
            saveButton.disabled = true;
            saveButton.classList.add('disabled');

            let missingItems = [];
            if (labels.length === 0) missingItems.push('folders/labels');
            if (!hasValidApiKey) {
                if (provider === 'ollama') missingItems.push('Ollama URL/model');
                else if (provider === 'openai-compatible') missingItems.push('endpoint URL/model');
                else if (provider === 'gemini') missingItems.push('Gemini API key');
                else missingItems.push('API key');
            }

            saveButton.title = `Please configure: ${missingItems.join(' and ')}`;
        } else {
            saveButton.disabled = false;
            saveButton.classList.remove('disabled');
            saveButton.title = '';
        }
    }

    // Load saved settings
    browser.storage.local.get(['labels', 'apiKey', 'geminiApiKeys', 'aiProvider', 'enableAi', 'geminiPaidPlan', 'ollamaUrl', 'ollamaModel', 'ollamaCustomModel', 'ollamaCpuOnly', 'customBaseUrl', 'customModel', 'debugMode']).then(result => {
        if (result.labels && result.labels.length > 0) {
            result.labels.forEach(label => {
                addLabelInput(label);
            });
        } else {
            // Show instruction if no labels
            labelsContainer.innerHTML = '<div class="instruction-message">No folders/labels configured. Click "Load Folders from Mail Account" above or add custom labels below.</div>';
        }
        
        // Load API keys
        if (result.geminiApiKeys && result.geminiApiKeys.length > 0) {
            // Multi-key mode
            geminiKeys = result.geminiApiKeys;
            geminiKeys.forEach((key, index) => {
                addGeminiKeyInput(key, index);
            });
        } else if (result.apiKey) {
            // Migrate from single key to multi-key
            geminiKeys = [result.apiKey];
            addGeminiKeyInput(result.apiKey, 0);
            apiKeyInput.value = result.apiKey;
        } else {
            // No keys configured yet - add one empty field
            addGeminiKeyInput('', 0);
        }
        
        // Load Ollama settings
        if (result.ollamaUrl && ollamaUrlInput) {
            ollamaUrlInput.value = result.ollamaUrl;
        }
        if (result.ollamaAuthToken && ollamaAuthTokenInput) {
            ollamaAuthTokenInput.value = result.ollamaAuthToken;
        }
        if (result.ollamaModel && ollamaModelSelect) {
            ollamaModelSelect.value = result.ollamaModel;
            if (result.ollamaModel === 'custom' && result.ollamaCustomModel && ollamaCustomModelInput) {
                ollamaCustomModelInput.value = result.ollamaCustomModel;
                ollamaCustomModelInput.style.display = 'block';
            }
        }
        if (ollamaCpuOnlyCheckbox) {
            ollamaCpuOnlyCheckbox.checked = result.ollamaCpuOnly === true;
        }

        // Load OpenAI-Compatible endpoint settings
        if (result.customBaseUrl && customBaseUrlInput) {
            customBaseUrlInput.value = result.customBaseUrl;
        }
        if (result.customModel) {
            // Check if it matches a dropdown option or use custom input
            const dropdownOptions = customModelSelect ? Array.from(customModelSelect.options).map(o => o.value) : [];
            if (dropdownOptions.includes(result.customModel)) {
                if (customModelSelect) customModelSelect.value = result.customModel;
            } else {
                // Not in dropdown - use custom input
                if (customModelSelect) {
                    customModelSelect.value = 'custom';
                    if (customModelCustomInput) {
                        customModelCustomInput.style.display = 'block';
                        customModelCustomInput.value = result.customModel;
                    }
                }
            }
        }

        if (result.aiProvider) {
            aiProviderSelect.value = result.aiProvider;
            updateProviderInfo();
        }
        // Set enableAi to true by default if not set
        document.getElementById('enable-ai').checked = result.enableAi !== false;
        
        // Set gemini paid plan checkbox
        geminiPaidCheckbox.checked = result.geminiPaidPlan === true;

        // Load debug mode setting
        if (enableDebugCheckbox && result.debugMode !== undefined) {
            enableDebugCheckbox.checked = result.debugMode;
        }

        updateSaveButtonState();
    });

    // Debug mode toggle
    if (enableDebugCheckbox) {
        enableDebugCheckbox.addEventListener('change', async () => {
            if (window.debugLogger) {
                if (enableDebugCheckbox.checked) {
                    await window.debugLogger.enable();
                    showMessage('✓ Debug mode enabled. Open Thunderbird Developer Tools (Ctrl+Shift+I) to view logs.', true);
                } else {
                    await window.debugLogger.disable();
                    showMessage('✓ Debug mode disabled.', true);
                }
            }
        });
    }
    
    // Add input listeners for validation
    apiKeyInput.addEventListener('input', updateSaveButtonState);
    labelsContainer.addEventListener('input', updateSaveButtonState);

    // Test API connection
    testApiButton.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        const provider = aiProviderSelect.value;
        
        // Skip for Ollama and OpenAI-Compatible as they have their own test buttons
        if (provider === 'ollama') {
            showApiTestResult('Please use the "Test Ollama Connection" button below', false);
            return;
        }
        if (provider === 'openai-compatible') {
            showApiTestResult('Please use the "Test Connection" button in the OpenAI-Compatible section', false);
            return;
        }
        
        if (!apiKey) {
            showApiTestResult('Please enter an API key', false);
            return;
        }

        try {
            showApiTestResult('Testing connection...', false);
            
            let response;
            if (provider === 'gemini') {
                response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': apiKey
                    },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: "Test" }] }],
                        generationConfig: { maxOutputTokens: 10 }
                    })
                });
            } else if (provider === 'openai') {
                response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [{ role: 'user', content: 'Test' }],
                        max_tokens: 10
                    })
                });
            } else if (provider === 'anthropic') {
                response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model: 'claude-3-haiku-20240307',
                        messages: [{ role: 'user', content: 'Test' }],
                        max_tokens: 10
                    })
                });
            } else if (provider === 'groq') {
                response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'llama-3.3-70b-versatile',
                        messages: [{ role: 'user', content: 'Test' }],
                        max_tokens: 10
                    })
                });
            } else if (provider === 'mistral') {
                response = await fetch('https://api.mistral.ai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'mistral-small-latest',
                        messages: [{ role: 'user', content: 'Test' }],
                        max_tokens: 10
                    })
                });
            }

            if (response.ok) {
                showApiTestResult('✓ API connection successful!', true);
            } else {
                const error = await response.json();
                showApiTestResult(`API Error: ${error.error?.message || error.message || 'Unknown error'}`, false);
            }
        } catch (error) {
            showApiTestResult(`Connection Error: ${error.message}`, false);
        }
    });

    // Load IMAP folders
    loadImapFoldersButton.addEventListener('click', async () => {
        folderLoadingIndicator.style.display = 'block';
        folderSelection.style.display = 'none';
        
        try {
            const accounts = await browser.accounts.list();
            const allFolders = [];
            
            for (const account of accounts) {
                const folders = await getAllFolders(account);
                allFolders.push(...folders);
            }
            
            // Filter out system folders and duplicates
            loadedFolders = [...new Set(allFolders
                .filter(f => !['Inbox', 'Trash', 'Drafts', 'Sent', 'Spam', 'Junk', 'Templates', 'Outbox', 'Archives'].includes(f))
                .map(f => f.replace(/^INBOX\./i, '').trim())
            )].sort();
            
            if (loadedFolders.length === 0) {
                showMessage('No folders found. You can create custom folders instead.', false);
                folderLoadingIndicator.style.display = 'none';
                return;
            }
            
            // Show folder preview
            folderCount.textContent = loadedFolders.length;
            foldersPreview.innerHTML = loadedFolders
                .slice(0, 10)
                .map(f => `<div class="folder-preview-item">${f}</div>`)
                .join('') + (loadedFolders.length > 10 ? `<div class="folder-preview-item">...and ${loadedFolders.length - 10} more</div>` : '');
            
            folderSelection.style.display = 'block';
        } catch (error) {
            showMessage(`Error loading folders: ${error.message}`, false);
            console.error('Error loading folders:', error);
        } finally {
            folderLoadingIndicator.style.display = 'none';
        }
    });
    
    // Use IMAP folders
    useImapFoldersButton.addEventListener('click', () => {
        if (confirm(`This will replace any existing folders/labels with ${loadedFolders.length} folders from your mail account. Continue?`)) {
            labelsContainer.innerHTML = '';
            loadedFolders.forEach(folder => {
                addLabelInput(folder);
            });
            folderSelection.style.display = 'none';
            updateSaveButtonState();
            showMessage(`Loaded ${loadedFolders.length} folders from your mail account. Don't forget to save!`, true);
        }
    });
    
    // Use custom folders
    useCustomFoldersButton.addEventListener('click', () => {
        folderSelection.style.display = 'none';
        showMessage('You can now add custom folders below', true);
    });
    
    // Helper function to recursively get all folders
    async function getAllFolders(account) {
        const folders = [];
        
        async function processFolder(folder) {
            if (folder.type !== 'inbox' && folder.type !== 'trash' && folder.type !== 'sent' && 
                folder.type !== 'drafts' && folder.type !== 'junk' && folder.type !== 'templates' &&
                folder.type !== 'outbox' && folder.type !== 'archives') {
                folders.push(folder.name);
            }
            
            if (folder.subFolders) {
                for (const subFolder of folder.subFolders) {
                    await processFolder(subFolder);
                }
            }
        }
        
        for (const folder of account.folders) {
            await processFolder(folder);
        }
        
        return folders;
    }

    // Import categories/folders in bulk
    importLabelsButton.addEventListener('click', () => {
        const bulkText = bulkImportTextarea.value.trim();
        const labels = bulkText.split('\n').map(l => l.trim()).filter(l => l !== '');
        
        // Validation
        if (labels.length === 0) {
            showMessage('Please add at least one folder/label before importing. Enter labels one per line.', false);
            return;
        }

        // Confirm if there are existing labels
        const existingLabels = Array.from(document.querySelectorAll('.label-input'))
            .map(input => input.value.trim())
            .filter(label => label !== '');
            
        if (existingLabels.length > 0) {
            if (!confirm(`This will replace your ${existingLabels.length} existing folders/labels with ${labels.length} new ones. Continue?`)) {
                return;
            }
        }

        // Clear existing categories/folders
        labelsContainer.innerHTML = '';

        // Add each category/folder
        labels.forEach(label => {
            addLabelInput(label);
        });

        updateSaveButtonState();
        showMessage(`Imported ${labels.length} categories/folders. Don't forget to save!`, true);
        bulkImportTextarea.value = ''; // Clear the textarea
    });

    // Add new label input
    
    // Show/hide custom model input based on selection
    if (ollamaModelSelect) {
        ollamaModelSelect.addEventListener('change', () => {
            if (ollamaModelSelect.value === 'custom') {
                ollamaCustomModelInput.style.display = 'block';
            } else {
                ollamaCustomModelInput.style.display = 'none';
            }
            updateSaveButtonState();
        });
    }

    // Update save button when custom model input changes
    if (ollamaCustomModelInput) {
        ollamaCustomModelInput.addEventListener('input', updateSaveButtonState);
    }
    
    // Test Ollama connection
    if (testOllamaButton) {
        testOllamaButton.addEventListener('click', async () => {
            const ollamaUrl = ollamaUrlInput.value.trim() || 'http://localhost:11434';
            let selectedModel = ollamaModelSelect.value;
            
            if (selectedModel === 'custom') {
                selectedModel = ollamaCustomModelInput.value.trim();
                if (!selectedModel) {
                    ollamaTestResult.textContent = '⚠️ Please enter a custom model name first';
                    ollamaTestResult.className = 'api-test-result error';
                    return;
                }
            }
            
            try {
                ollamaTestResult.textContent = 'Testing connection and checking model...';
                ollamaTestResult.className = 'api-test-result';
                
                const testUrl = `${ollamaUrl}/api/tags`;
                if (window.debugLogger) { window.debugLogger.info('[Ollama]', 'Test connecting to: ' + testUrl); }
                
                const headers = {};
                if (ollamaAuthTokenInput && ollamaAuthTokenInput.value.trim()) {
                    headers['Authorization'] = `Bearer ${ollamaAuthTokenInput.value.trim()}`;
                }

                const response = await fetch(testUrl, {
                    method: 'GET',
                    headers
                });
                
                if (window.debugLogger) { window.debugLogger.info('[Ollama]', 'Response status: ' + response.status); }
                
                if (response.ok) {
                    const data = await response.json();
                    if (window.debugLogger) { window.debugLogger.info('[Ollama]', 'Success:', data); }
                    const installedModels = data.models && data.models.length > 0 
                        ? data.models.map(m => m.name)
                        : [];
                    
                    if (installedModels.length === 0) {
                        ollamaTestResult.textContent = `⚠️ Ollama is running but no models installed. Enter a model name in "Download Model" and click "Download" to get started.`;
                        ollamaTestResult.className = 'api-test-result error';
                    } else {
                        // Extract base model name (before colon) for regex matching
                        const selectedBase = selectedModel.split(':')[0].toLowerCase();
                        const installedBases = installedModels.map(m => m.split(':')[0].toLowerCase());
                        
                        const modelFound = installedBases.some(base => base === selectedBase);
                        if (modelFound) {
                            ollamaTestResult.textContent = `✓ Connected! Model "${selectedModel}" is installed and ready. Available: ${installedModels.join(', ')}`;
                            ollamaTestResult.className = 'api-test-result success';
                        } else {
                            ollamaTestResult.textContent = `✗ Model "${selectedModel}" not installed. Available models: ${installedModels.join(', ')}. Use "Download Model" to install it.`;
                            ollamaTestResult.className = 'api-test-result error';
                        }
                    }
                } else {
                    const errorText = await response.text();
                    console.error('[Ollama Test] Error response:', errorText);
                    let errorMsg = 'Connection failed';
                    if (response.status === 403) {
                        errorMsg = 'Access denied (403). Check if Ollama is running and the URL is correct.';
                    } else if (response.status === 404) {
                        errorMsg = 'Ollama not found (404). Check the server URL.';
                    } else {
                        try {
                            const errorData = JSON.parse(errorText);
                            errorMsg = errorData.error || errorText;
                        } catch (e) {
                            errorMsg = errorText || `HTTP ${response.status}`;
                        }
                    }
                    ollamaTestResult.textContent = `✗ Error: ${errorMsg}`;
                    ollamaTestResult.className = 'api-test-result error';
                }
            } catch (error) {
                console.error('[Ollama Test] Exception:', error);
                ollamaTestResult.textContent = `✗ Connection failed: ${error.message}. Make sure Ollama is running (try: ollama serve)`;
                ollamaTestResult.className = 'api-test-result error';
            }
        });
    }

    // Custom model dropdown change handler - show/hide custom input
    if (customModelSelect) {
        customModelSelect.addEventListener('change', () => {
            if (customModelSelect.value === 'custom') {
                if (customModelCustomInput) customModelCustomInput.style.display = 'block';
            } else {
                if (customModelCustomInput) customModelCustomInput.style.display = 'none';
            }
            updateSaveButtonState();
        });
    }

    // Update save button when custom endpoint inputs change
    if (customBaseUrlInput) {
        customBaseUrlInput.addEventListener('input', updateSaveButtonState);
    }
    if (customModelCustomInput) {
        customModelCustomInput.addEventListener('input', updateSaveButtonState);
    }

    // Fetch models from OpenAI-compatible endpoint
    if (fetchCustomModelsButton) {
        fetchCustomModelsButton.addEventListener('click', async () => {
            const baseUrl = customBaseUrlInput ? customBaseUrlInput.value.trim().replace(/\/$/, '') : '';
            const apiKey = customApiKeyInput ? customApiKeyInput.value.trim() : '';

            if (!baseUrl) {
                if (customTestResult) {
                    customTestResult.textContent = '⚠️ Please enter a base URL first';
                    customTestResult.className = 'api-test-result error';
                }
                return;
            }

            try {
                if (customTestResult) {
                    customTestResult.textContent = 'Fetching models from endpoint...';
                    customTestResult.className = 'api-test-result';
                }

                const headers = { 'Content-Type': 'application/json' };
                if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

                // Check if localhost - needs tab injection
                const isLocalhost = baseUrl.startsWith('http://localhost') || baseUrl.startsWith('http://127.0.0.1');

                let modelsData;

                if (isLocalhost) {
                    // Use tab injection for localhost (Thunderbird restriction)
                    modelsData = await fetchModelsViaTab(baseUrl, apiKey);
                } else {
                    // Direct fetch for cloud endpoints
                    const response = await fetch(baseUrl + '/models', { headers });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    modelsData = await response.json();
                }

                // Parse models - handle different response formats
                const models = modelsData.data || modelsData.models || [];

                if (models.length === 0) {
                    if (customTestResult) {
                        customTestResult.textContent = '⚠️ No models found at this endpoint';
                        customTestResult.className = 'api-test-result error';
                    }
                    return;
                }

                // Populate dropdown
                if (customModelSelect) {
                    customModelSelect.innerHTML = '<option value="">-- Select model --</option>';
                    models.forEach(m => {
                        const modelId = m.id || m.name || m;
                        const option = document.createElement('option');
                        option.value = modelId;
                        option.textContent = modelId;
                        customModelSelect.appendChild(option);
                    });
                    // Add custom option at end
                    const customOpt = document.createElement('option');
                    customOpt.value = 'custom';
                    customOpt.textContent = 'Custom (enter manually)';
                    customModelSelect.appendChild(customOpt);
                }

                if (customTestResult) {
                    customTestResult.textContent = `✓ Found ${models.length} models. Select from dropdown or use "Custom" option.`;
                    customTestResult.className = 'api-test-result success';
                }

            } catch (error) {
                console.error('[Fetch Models] Error:', error);
                if (customTestResult) {
                    customTestResult.textContent = `✗ Failed to fetch models: ${error.message}`;
                    customTestResult.className = 'api-test-result error';
                }
            }
        });
    }

    // Test OpenAI-Compatible endpoint connection
    if (testCustomEndpointButton) {
        testCustomEndpointButton.addEventListener('click', async () => {
            const baseUrl = customBaseUrlInput ? customBaseUrlInput.value.trim() : '';
            let model = customModelSelect ? customModelSelect.value : '';
            const apiKey = customApiKeyInput ? customApiKeyInput.value.trim() : '';

            // If custom selected, use custom input value
            if (model === 'custom' && customModelCustomInput) {
                model = customModelCustomInput.value.trim();
            }

            if (!baseUrl) {
                if (customTestResult) {
                    customTestResult.textContent = '⚠️ Please enter a base URL';
                    customTestResult.className = 'api-test-result error';
                }
                return;
            }
            if (!model) {
                if (customTestResult) {
                    customTestResult.textContent = '⚠️ Please enter a model name';
                    customTestResult.className = 'api-test-result error';
                }
                return;
            }

            try {
                if (customTestResult) {
                    customTestResult.textContent = 'Testing connection...';
                    customTestResult.className = 'api-test-result';
                }

                const headers = { 'Content-Type': 'application/json' };
                if (apiKey) {
                    headers['Authorization'] = `Bearer ${apiKey}`;
                }

                // Normalize base URL (remove trailing slash)
                const normalizedUrl = baseUrl.replace(/\/$/, '');

                if (window.debugLogger) { window.debugLogger.info('[Custom]', 'Test connecting to: ' + normalizedUrl + '/chat/completions'); }

                const response = await fetch(normalizedUrl + '/chat/completions', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        model,
                        messages: [{ role: 'user', content: 'Test' }],
                        max_tokens: 10
                    })
                });

                if (window.debugLogger) { window.debugLogger.info('[Custom]', 'Response status: ' + response.status); }

                if (response.ok) {
                    if (customTestResult) {
                        customTestResult.textContent = `✓ Connected successfully! Model "${model}" is ready at ${normalizedUrl}`;
                        customTestResult.className = 'api-test-result success';
                    }
                } else {
                    const errorText = await response.text();
                    console.error('[Custom Endpoint Test] Error response:', errorText);
                    let errorMsg = 'Connection failed';
                    try {
                        const errorData = JSON.parse(errorText);
                        errorMsg = errorData.error?.message || errorData.error || errorText;
                    } catch (e) {
                        errorMsg = `HTTP ${response.status}: ${response.statusText}`;
                    }
                    if (customTestResult) {
                        customTestResult.textContent = `✗ Error: ${errorMsg}`;
                        customTestResult.className = 'api-test-result error';
                    }
                }
            } catch (error) {
                console.error('[Custom Endpoint Test] Exception:', error);
                if (customTestResult) {
                    customTestResult.textContent = `✗ Connection failed: ${error.message}. Check the base URL and ensure the endpoint is running.`;
                    customTestResult.className = 'api-test-result error';
                }
            }
        });
    }

    // Run comprehensive Ollama diagnostics
    if (diagnoseOllamaButton) {
        diagnoseOllamaButton.addEventListener('click', async () => {
            const ollamaUrl = ollamaUrlInput.value.trim() || 'http://localhost:11434';
            let diagnosticOutput = '🔍 OLLAMA DIAGNOSTICS\n' + '='.repeat(50) + '\n\n';
            
            ollamaDiagnostics.style.display = 'block';
            ollamaDiagnostics.className = 'diagnostics-result';
            ollamaDiagnostics.textContent = diagnosticOutput + 'Running tests...\n';
            
            try {
                // Test 1: Check /api/tags endpoint
                diagnosticOutput += '📋 Test 1: List Models Endpoint\n';
                diagnosticOutput += `   URL: ${ollamaUrl}/api/tags\n`;
                try {
                    const tagsResponse = await fetch(`${ollamaUrl}/api/tags`);
                    diagnosticOutput += `   Status: ${tagsResponse.status} ${tagsResponse.statusText}\n`;
                    
                    if (tagsResponse.ok) {
                        const data = await tagsResponse.json();
                        diagnosticOutput += `   ✓ SUCCESS - Found ${data.models?.length || 0} models\n`;
                        if (data.models && data.models.length > 0) {
                            diagnosticOutput += '   Installed models: ' + data.models.map(m => m.name).join(', ') + '\n';
                        } else {
                            diagnosticOutput += '   ⚠️ No models installed\n';
                        }
                    } else {
                        diagnosticOutput += `   ✗ FAILED\n`;
                    }
                } catch (error) {
                    diagnosticOutput += `   ✗ ERROR: ${error.message}\n`;
                }
                
                // Test 2: Check /api/version endpoint
                diagnosticOutput += '\n🔢 Test 2: Version Endpoint\n';
                diagnosticOutput += `   URL: ${ollamaUrl}/api/version\n`;
                try {
                    const versionResponse = await fetch(`${ollamaUrl}/api/version`);
                    diagnosticOutput += `   Status: ${versionResponse.status} ${versionResponse.statusText}\n`;
                    
                    if (versionResponse.ok) {
                        const data = await versionResponse.json();
                        diagnosticOutput += `   ✓ SUCCESS - Ollama version: ${data.version || 'unknown'}\n`;
                    } else {
                        diagnosticOutput += `   ⚠️ Endpoint not available (older Ollama version)\n`;
                    }
                } catch (error) {
                    diagnosticOutput += `   ✗ ERROR: ${error.message}\n`;
                }
                
                // Test 3: Test pull endpoint (without actually downloading)
                diagnosticOutput += '\n⬇️ Test 3: Pull Endpoint Check\n';
                diagnosticOutput += `   URL: ${ollamaUrl}/api/pull\n`;
                diagnosticOutput += `   Note: This endpoint is used for downloading models\n`;
                
                // Summary
                diagnosticOutput += '\n' + '='.repeat(50) + '\n';
                diagnosticOutput += '📊 SUMMARY:\n\n';
                
                if (diagnosticOutput.includes('✓ SUCCESS - Found')) {
                    diagnosticOutput += '✓ Ollama is running and accessible\n';
                    diagnosticOutput += `✓ API base URL: ${ollamaUrl}\n`;
                    ollamaDiagnostics.className = 'diagnostics-result success';
                } else {
                    diagnosticOutput += '✗ Cannot connect to Ollama\n';
                    diagnosticOutput += '\nTroubleshooting:\n';
                    diagnosticOutput += '1. Check if Ollama is running: ps aux | grep ollama\n';
                    diagnosticOutput += '2. Start Ollama: ollama serve\n';
                    diagnosticOutput += `3. Test manually: curl ${ollamaUrl}/api/tags\n`;
                    diagnosticOutput += '4. Check if port 11434 is in use: lsof -i :11434\n';
                    ollamaDiagnostics.className = 'diagnostics-result error';
                }
                
            } catch (error) {
                diagnosticOutput += '\n❌ CRITICAL ERROR:\n';
                diagnosticOutput += error.message + '\n';
                ollamaDiagnostics.className = 'diagnostics-result error';
            }
            
            ollamaDiagnostics.textContent = diagnosticOutput;
        });
    }
    
    // List Ollama models
    if (listOllamaModelsButton) {
        listOllamaModelsButton.addEventListener('click', async () => {
            const ollamaUrl = ollamaUrlInput.value.trim() || 'http://localhost:11434';
            
            try {
                ollamaTestResult.textContent = 'Fetching models...';
                ollamaTestResult.className = 'api-test-result';
                
                const response = await fetch(`${ollamaUrl}/api/tags`);
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.models && data.models.length > 0) {
                        const modelNames = data.models.map(m => m.name).join(', ');
                        ollamaTestResult.textContent = `✓ Available models: ${modelNames}`;
                        ollamaTestResult.className = 'api-test-result success';
                    } else {
                        ollamaTestResult.textContent = '⚠️ No models installed. Run "ollama pull llama3.2" to download one.';
                        ollamaTestResult.className = 'api-test-result error';
                    }
                } else {
                    ollamaTestResult.textContent = '✗ Failed to fetch models';
                    ollamaTestResult.className = 'api-test-result error';
                }
            } catch (error) {
                ollamaTestResult.textContent = `✗ Connection failed: ${error.message}. Is Ollama running?`;
                ollamaTestResult.className = 'api-test-result error';
            }
        });
    }

    // Download Ollama model via tab proxy
    if (downloadOllamaModelButton) {
        downloadOllamaModelButton.addEventListener('click', async () => {
            const ollamaUrl = (ollamaUrlInput.value.trim() || 'http://localhost:11434').replace(/\/$/, '');
            const modelName = ollamaDownloadModelInput.value.trim();
            const token = ollamaAuthTokenInput && ollamaAuthTokenInput.value.trim();
            if (!modelName) {
                ollamaDownloadStatus.textContent = '⚠️ Please enter a model name to download';
                ollamaDownloadStatus.className = 'api-test-result error';
                ollamaDownloadStatus.style.display = 'block';
                return;
            }
            try {
                downloadOllamaModelButton.disabled = true;
                ollamaDownloadStatus.textContent = `Starting download of ${modelName}...`;
                ollamaDownloadStatus.className = 'api-test-result';
                ollamaDownloadStatus.style.display = 'block';

                // Ask background to open a hidden tab and start pull
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                await browser.runtime.sendMessage({
                    action: 'startOllamaPull',
                    ollamaUrl,
                    model: modelName,
                    headers
                });
            } catch (e) {
                ollamaDownloadStatus.textContent = `✗ Failed to start: ${e.message}`;
                ollamaDownloadStatus.className = 'api-test-result error';
            } finally {
                downloadOllamaModelButton.disabled = false;
            }
        });
        // Listen for progress events from content.js
        browser.runtime.onMessage.addListener((msg) => {
            if (msg.action === 'ollamaPullProgress') {
                const parts = [];
                if (msg.status) parts.push(msg.status);
                if (typeof msg.percent === 'number') parts.push(`${msg.percent}%`);
                ollamaDownloadStatus.textContent = parts.join(' — ');
                ollamaDownloadStatus.className = 'api-test-result';
                ollamaDownloadStatus.style.display = 'block';
            } else if (msg.action === 'ollamaPullComplete') {
                if (msg.ok) {
                    ollamaDownloadStatus.textContent = '✓ Download complete';
                    ollamaDownloadStatus.className = 'api-test-result success';
                } else {
                    ollamaDownloadStatus.textContent = `✗ Download failed: ${msg.error || 'unknown error'}`;
                    ollamaDownloadStatus.className = 'api-test-result error';
                }
                ollamaDownloadStatus.style.display = 'block';
            }
        });
    }
    
    addLabelButton.addEventListener('click', () => {
        // Clear instruction message if present
        const instructionMsg = labelsContainer.querySelector('.instruction-message');
        if (instructionMsg) {
            labelsContainer.innerHTML = '';
        }
        addLabelInput('');
        updateSaveButtonState();
    });

    // Save settings
    saveButton.addEventListener('click', () => {
        const labels = Array.from(document.querySelectorAll('.label-input'))
            .map(input => input.value.trim())
            .filter(label => label !== '');
        
        const apiKey = apiKeyInput.value.trim();
        const provider = aiProviderSelect.value;
        
        // Validation
        if (labels.length === 0) {
            showMessage('Please add at least one folder/label before saving. Use "Load Folders from Mail Account" or add custom labels.', false);
            return;
        }
        
        // Validate API keys based on provider
        if (provider === 'gemini') {
            // Filter out empty Gemini keys
            const validGeminiKeys = geminiKeys.filter(key => key && key.trim() !== '');
            
            if (validGeminiKeys.length === 0) {
                showMessage('Please add at least one Gemini API key before saving.', false);
                return;
            }
            
            // Check for duplicate keys
            const uniqueKeys = new Set(validGeminiKeys.map(key => key.trim().toLowerCase()));
            if (uniqueKeys.size !== validGeminiKeys.length) {
                showMessage('⚠️ Duplicate API keys detected! Each key must be unique. Please remove duplicates before saving.', false);
                return;
            }
            
            const settings = {
                labels: labels,
                geminiApiKeys: validGeminiKeys,
                currentGeminiKeyIndex: 0, // Start with first key
                aiProvider: provider,
                enableAi: document.getElementById('enable-ai').checked,
                geminiPaidPlan: geminiPaidCheckbox.checked,
                debugMode: enableDebugCheckbox ? enableDebugCheckbox.checked : false
            };
            
            // Initialize rate limits array for all keys if not exists
            browser.storage.local.get(['geminiRateLimits']).then(result => {
                if (!result.geminiRateLimits || result.geminiRateLimits.length !== validGeminiKeys.length) {
                    settings.geminiRateLimits = validGeminiKeys.map(() => ({
                        requests: [],
                        dailyCount: 0,
                        dailyResetTime: Date.now() + (24 * 60 * 60 * 1000)
                    }));
                }
                
                browser.storage.local.set(settings).then(() => {
                    showMessage('✓ Settings saved successfully! Multiple Gemini API keys configured for automatic rotation.', true);
                    updateSaveButtonState();
                }).catch(error => {
                    showMessage('Error saving settings: ' + error, false);
                });
            });
        } else if (provider === 'ollama') {
            // Ollama doesn't need API key, just save URL and model
            let ollamaModel = ollamaModelSelect.value;
            if (ollamaModel === 'custom') {
                ollamaModel = ollamaCustomModelInput.value.trim();
                if (!ollamaModel) {
                    showMessage('Please enter a custom model name for Ollama.', false);
                    return;
                }
            }
            
            const settings = {
                labels: labels,
                aiProvider: provider,
                enableAi: document.getElementById('enable-ai').checked,
                ollamaUrl: ollamaUrlInput.value.trim() || 'http://localhost:11434',
                ollamaModel: ollamaModel,
                ollamaCustomModel: ollamaCustomModelInput.value.trim(),
                ollamaAuthToken: ollamaAuthTokenInput ? ollamaAuthTokenInput.value.trim() : '',
                ollamaCpuOnly: ollamaCpuOnlyCheckbox.checked,
                debugMode: enableDebugCheckbox ? enableDebugCheckbox.checked : false
            };

            browser.storage.local.set(settings).then(() => {
                const cpuMode = ollamaCpuOnlyCheckbox.checked ? ' (CPU-only mode)' : '';
                showMessage(`✓ Settings saved successfully! Ollama is configured for local email processing${cpuMode}.`, true);
                updateSaveButtonState();
            }).catch(error => {
                showMessage('Error saving settings: ' + error, false);
            });
        } else if (provider === 'openai-compatible') {
            // OpenAI-Compatible endpoint needs base URL and model
            const baseUrl = customBaseUrlInput ? customBaseUrlInput.value.trim() : '';
            let model = customModelSelect ? customModelSelect.value : '';
            const apiKey = customApiKeyInput ? customApiKeyInput.value.trim() : '';

            // If custom selected, use custom input value
            if (model === 'custom' && customModelCustomInput) {
                model = customModelCustomInput.value.trim();
            }

            if (!baseUrl) {
                showMessage('Please enter a base URL for the custom endpoint.', false);
                return;
            }
            if (!model) {
                showMessage('Please select or enter a model name for the custom endpoint.', false);
                return;
            }

            const settings = {
                labels: labels,
                aiProvider: provider,
                enableAi: document.getElementById('enable-ai').checked,
                customBaseUrl: baseUrl.replace(/\/$/, ''),
                customModel: model,
                apiKey: apiKey,
                debugMode: enableDebugCheckbox ? enableDebugCheckbox.checked : false
            };

            browser.storage.local.set(settings).then(() => {
                showMessage('✓ Settings saved successfully! Custom OpenAI-compatible endpoint configured.', true);
                updateSaveButtonState();
            }).catch(error => {
                showMessage('Error saving settings: ' + error, false);
            });
        } else {
            // Other providers use single key
            if (!apiKey) {
                showMessage('Please enter your API key before saving. Click "Get API Key" to obtain one.', false);
                return;
            }

            const settings = {
                labels: labels,
                apiKey: apiKey,
                aiProvider: provider,
                enableAi: document.getElementById('enable-ai').checked,
                geminiPaidPlan: geminiPaidCheckbox.checked,
                debugMode: enableDebugCheckbox ? enableDebugCheckbox.checked : false
            };

            browser.storage.local.set(settings).then(() => {
                showMessage('✓ Settings saved successfully! You can now use AutoSort+ to analyze emails.', true);
                updateSaveButtonState();
            }).catch(error => {
                showMessage('Error saving settings: ' + error, false);
            });
        }
    });

    // Add category/folder input field
    function addLabelInput(value = '') {
        const labelItem = document.createElement('div');
        labelItem.className = 'label-item';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'label-input';
        input.placeholder = 'Enter category/folder name';
        input.value = value;
        input.addEventListener('input', updateSaveButtonState);

        const removeButton = document.createElement('button');
        removeButton.className = 'remove-label';
        removeButton.textContent = '×';
        removeButton.addEventListener('click', () => {
            labelItem.remove();
            updateSaveButtonState();
            
            // Show instruction if no labels left
            const remainingLabels = document.querySelectorAll('.label-input');
            if (remainingLabels.length === 0) {
                labelsContainer.innerHTML = '<div class="instruction-message">No folders/labels configured. Click "Load Folders from Mail Account" above or add custom labels below.</div>';
            }
        });

        labelItem.appendChild(input);
        labelItem.appendChild(removeButton);
        labelsContainer.appendChild(labelItem);
    }

    // Show API test result
    function showApiTestResult(message, isSuccess) {
        apiTestResult.textContent = message;
        apiTestResult.className = `api-test-result ${isSuccess ? 'success' : 'error'}`;
    }

    // Helper function to fetch models via tab injection (for localhost endpoints)
    async function fetchModelsViaTab(baseUrl, apiKey) {
        const tab = await browser.tabs.create({ url: baseUrl, active: false });
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            const headers = { 'Content-Type': 'application/json' };
            if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

            const scriptCode = `
            (async () => {
                try {
                    const headers = ${JSON.stringify(headers)};
                    const response = await fetch(window.location.origin + '/v1/models', {
                        method: 'GET',
                        headers
                    });

                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status);
                    }

                    const data = await response.json();
                    window.__models_result = { ok: true, data };
                } catch (error) {
                    window.__models_result = { ok: false, error: error.message };
                }
            })();
            `;

            await browser.tabs.executeScript(tab.id, { code: scriptCode });

            // Poll for result
            let result = null;
            for (let i = 0; i < 30; i++) {
                await new Promise(resolve => setTimeout(resolve, 500));
                try {
                    const results = await browser.tabs.executeScript(tab.id, { code: 'window.__models_result || null' });
                    if (results && results[0]) {
                        result = results[0];
                        break;
                    }
                } catch (e) {
                    break;
                }
            }

            if (!result || !result.ok) {
                throw new Error(result?.error || 'Timeout fetching models');
            }

            return result.data;

        } finally {
            try { await browser.tabs.remove(tab.id); } catch (e) {}
        }
    }

    // Show message to user
    function showMessage(message, isSuccess = true) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.textContent = message;
        messageDiv.style.backgroundColor = isSuccess ? 'var(--success-color)' : 'var(--error-color)';
        document.body.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }

    // Function to format timestamp
    function formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString();
    }

    // Function to update history table
    async function updateHistoryTable() {
        const historyBody = document.getElementById('history-body');
        const data = await browser.storage.local.get('moveHistory');
        const history = data.moveHistory || [];
        
        historyBody.innerHTML = history.map(entry => `
            <tr>
                <td class="timestamp">${formatTimestamp(entry.timestamp)}</td>
                <td>${entry.subject}</td>
                <td class="${entry.status.toLowerCase()}">${entry.status}</td>
                <td>${entry.destination}</td>
            </tr>
        `).join('');
    }

    // Function to clear history
    async function clearHistory() {
        if (confirm('Are you sure you want to clear the move history?')) {
            await browser.storage.local.set({ moveHistory: [] });
            await updateHistoryTable();
        }
    }

    // Initialize the page
    await updateHistoryTable();

    // Add event listeners for history controls
    document.getElementById('clear-history').addEventListener('click', clearHistory);
    document.getElementById('refresh-history').addEventListener('click', updateHistoryTable);
}); 
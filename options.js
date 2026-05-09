/** Escape HTML special characters to prevent XSS in innerHTML assignments. */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

document.addEventListener('DOMContentLoaded', async function() {
    // Apply i18n translations first
    if (typeof applyTranslations === 'function') {
        applyTranslations();
    }

    if (window.debugLogger) {
        window.debugLogger.init();
    }

    const sectionHeaders = document.querySelectorAll('.section-header');
    sectionHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const sectionId = this.getAttribute('data-section');
            const content = document.getElementById(sectionId);
            const section = this.parentElement;
            const icon = this.querySelector('.collapse-icon');
            
            if (section.classList.contains('collapsed')) {
                section.classList.remove('collapsed');
                content.style.display = 'block';
                icon.textContent = '▼';
                setTimeout(() => {
                    content.style.animation = 'slideDown 0.3s ease-out';
                }, 0);
            } else {
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
            name: i18n.get('providerGemini'),
            signupUrl: 'https://aistudio.google.com/app/apikey',
            info: i18n.get('providerInfoGemini'),
            isFree: true
        },
        openai: {
            name: i18n.get('providerOpenAI'),
            signupUrl: 'https://platform.openai.com/signup',
            info: i18n.get('providerInfoOpenai'),
            isFree: false
        },
        anthropic: {
            name: i18n.get('providerAnthropic'),
            signupUrl: 'https://console.anthropic.com/',
            info: i18n.get('providerInfoAnthropic'),
            isFree: true
        },
        groq: {
            name: i18n.get('providerGroq'),
            signupUrl: 'https://console.groq.com/',
            info: i18n.get('providerInfoGroq'),
            isFree: true
        },
        mistral: {
            name: i18n.get('providerMistral'),
            signupUrl: 'https://console.mistral.ai/',
            info: i18n.get('providerInfoMistral'),
            isFree: true
        },
        ollama: {
            name: i18n.get('providerOllama'),
            signupUrl: 'https://ollama.ai/',
            info: i18n.get('providerInfoOllama'),
            isFree: true
        },
        'openai-compatible': {
            name: i18n.get('providerOpenAICompatible'),
            signupUrl: '',
            info: i18n.get('providerInfoOpenaiCompatible'),
            isFree: true
        }
    };
    
    function updateProviderInfo() {
        const provider = aiProviderSelect.value;
        const config = aiProviders[provider];

        const ollamaSubsection = document.getElementById('ollama-settings-subsection');
        const apiKeySubsection = document.getElementById('api-key-subsection');
        const geminiMultiKeysSubsection = document.getElementById('gemini-multi-keys-subsection');
        const geminiUsageSubsection = document.getElementById('gemini-usage-subsection');
        const rateLimitWarning = document.getElementById('rate-limit-warning');
        const openaiCompatibleSubsection = document.getElementById('openai-compatible-settings-subsection');

        // Show/hide provider-specific UI elements
        if (provider === 'gemini') {
            geminiPaidContainer.style.display = 'block';
            if (geminiMultiKeysSubsection) geminiMultiKeysSubsection.style.display = 'block';
            if (geminiUsageSubsection) geminiUsageSubsection.style.display = 'block';
            if (apiKeySubsection) apiKeySubsection.style.display = 'none';
            if (ollamaSubsection) ollamaSubsection.style.display = 'none';
            if (openaiCompatibleSubsection) openaiCompatibleSubsection.style.display = 'none';
            updateGeminiUsageDisplay();
        } else if (provider === 'ollama') {
            geminiPaidContainer.style.display = 'none';
            if (geminiMultiKeysSubsection) geminiMultiKeysSubsection.style.display = 'none';
            if (geminiUsageSubsection) geminiUsageSubsection.style.display = 'none';
            if (apiKeySubsection) apiKeySubsection.style.display = 'none';
            if (ollamaSubsection) ollamaSubsection.style.display = 'block';
            if (openaiCompatibleSubsection) openaiCompatibleSubsection.style.display = 'none';
        } else if (provider === 'openai-compatible') {
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
                <strong>${config.name}</strong> ${config.isFree ? '<span class="free-badge">' + i18n.get('freeBadge') + '</span>' : '<span class="paid-badge">' + i18n.get('paidBadge') + '</span>'}
                <p>${config.info}</p>
            </div>
        `;

        if (provider !== 'ollama' && provider !== 'openai-compatible') {
            apiKeyInput.placeholder = i18n.get('apiKeyPlaceholder');
        }

        updateSaveButtonState();
    }
    
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
    
    // Backward compatibility for single key mode
    async function updateSingleKeyUsageDisplay(rateLimit) {
        const now = Date.now();

        document.getElementById('gemini-daily-count').textContent = rateLimit.dailyCount;

        if (rateLimit.requests && rateLimit.requests.length > 0) {
            const lastRequest = Math.max(...rateLimit.requests);
            const minutesAgo = Math.floor((now - lastRequest) / 60000);
            if (minutesAgo < 1) {
                document.getElementById('gemini-last-request').textContent = i18n.get('geminiNever');
            } else if (minutesAgo < 60) {
                document.getElementById('gemini-last-request').textContent = i18n.get('minutesAgo', [minutesAgo, minutesAgo > 1 ? 's' : '']);
            } else {
                const hoursAgo = Math.floor(minutesAgo / 60);
                document.getElementById('gemini-last-request').textContent = i18n.get('hoursAgo', [hoursAgo, hoursAgo > 1 ? 's' : '']);
            }
        } else {
            document.getElementById('gemini-last-request').textContent = i18n.get('geminiNever');
        }

        if (rateLimit.dailyResetTime > now) {
            const hoursUntil = Math.ceil((rateLimit.dailyResetTime - now) / (1000 * 60 * 60));
            document.getElementById('gemini-reset-time').textContent = i18n.get('inHours', [hoursUntil, hoursUntil > 1 ? 's' : '']);
        } else {
            document.getElementById('gemini-reset-time').textContent = i18n.get('geminiResetExpired');
        }

        const usageMessage = document.getElementById('usage-message');
        const statusSpan = document.getElementById('gemini-status');
        
        if (rateLimit.dailyCount >= 20) {
            statusSpan.textContent = '🔴 ' + i18n.get('geminiStatusLimitReached');
            statusSpan.style.color = '#dc3545';
            usageMessage.className = 'usage-message warning';
            usageMessage.textContent = '⚠️ ' + i18n.get('geminiLimitMessage');
        } else if (rateLimit.dailyCount >= 15) {
            statusSpan.textContent = '🟡 ' + i18n.get('geminiStatusNearlyFull');
            statusSpan.style.color = '#ffc107';
            usageMessage.className = 'usage-message warning';
            usageMessage.textContent = `⚠️ ${i18n.get('geminiRemainingMessage')} ${20 - rateLimit.dailyCount} ${i18n.get('requestsRemainingToday')}`;
        } else {
            statusSpan.textContent = '🟢 ' + i18n.get('geminiStatusReady');
            statusSpan.style.color = '#28a745';
            usageMessage.style.display = 'none';
        }
    }
    
    function updateMultiKeyUsageDisplay(keys, rateLimits, currentIndex) {
        const container = document.getElementById('all-keys-usage-stats');
        const now = Date.now();
        container.innerHTML = '';
        
        keys.forEach((key, index) => {
            const rateLimit = rateLimits[index] || { requests: [], dailyCount: 0, dailyResetTime: now };
            const isActive = index === currentIndex;
            
            const card = document.createElement('div');
            card.className = `key-usage-card${isActive ? ' active' : ''}`;

        let statusBadge = '';
            if (isActive) {
                statusBadge = `<span class="key-status active">${i18n.get('keyActive')}</span>`;
            } else if (rateLimit.dailyCount >= 20) {
                statusBadge = `<span class="key-status limit">${i18n.get('keyLimit')}</span>`;
            } else if (rateLimit.dailyCount >= 15) {
                statusBadge = `<span class="key-status warning">${i18n.get('keyNearLimit')}</span>`;
            } else {
                statusBadge = `<span class="key-status ready">${i18n.get('keyReady')}</span>`;
            }

        let resetText = '--';
            if (rateLimit.dailyResetTime > now) {
                const hoursUntil = Math.ceil((rateLimit.dailyResetTime - now) / (1000 * 60 * 60));
                resetText = i18n.get('inHoursShort', [hoursUntil]);
            }

        let lastRequestText = i18n.get('geminiNever');
            if (rateLimit.requests && rateLimit.requests.length > 0) {
                const lastRequest = Math.max(...rateLimit.requests);
                const minutesAgo = Math.floor((now - lastRequest) / 60000);
                if (minutesAgo < 1) {
                    lastRequestText = i18n.get('justNow');
                } else if (minutesAgo < 60) {
                    lastRequestText = i18n.get('minutesAgoShort', [minutesAgo]);
                } else {
                    lastRequestText = i18n.get('hoursAgoShort', [Math.floor(minutesAgo / 60)]);
                }
            }

        const maskedKey = key ? `...${key.slice(-8)}` : i18n.get('keyNotSet');
            
            card.innerHTML = `
                <div class="key-header">
                    <span class="key-title">${i18n.get('keyLabel', [index + 1])} ${maskedKey}</span>
                    ${statusBadge}
                </div>
                <div class="key-stats">
                    <div class="stat-item">
                        <span class="stat-label">${i18n.get('statUsage')}</span>
                        <span class="stat-value">${rateLimit.dailyCount}/20</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">${i18n.get('statLast')}</span>
                        <span class="stat-value">${lastRequestText}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">${i18n.get('statResets')}</span>
                        <span class="stat-value">${resetText}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">${i18n.get('statAvailable')}</span>
                        <span class="stat-value">${20 - rateLimit.dailyCount}</span>
                    </div>
                </div>
            `;
            
            container.appendChild(card);
        });
    }
    
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
        input.placeholder = i18n.get('geminiKeyInputPlaceholder');
        input.value = value;
        input.dataset.index = index;
        input.addEventListener('input', (e) => {
            const newKey = e.target.value.trim();
            geminiKeys[index] = newKey;

            if (newKey) {
                const isDuplicate = geminiKeys.some((key, i) => i !== index && key.trim() === newKey);
                if (isDuplicate) {
                    input.style.borderColor = '#dc3545';
                    input.title = i18n.get('keyAlreadyAddedTitle');
                } else {
                    input.style.borderColor = '';
                    input.title = '';
                }
            } else {
                input.style.borderColor = '';
                input.title = '';
            }

            updateSaveButtonState();
        });
        
        const testButton = document.createElement('button');
        testButton.className = 'button';
        testButton.textContent = i18n.get('testButton');
        testButton.addEventListener('click', () => {
            const keyValue = input.value.trim();
            if (!keyValue) {
                statusSpan.textContent = i18n.get('enterKeyFirst');
                statusSpan.className = 'key-test-result error';
                return;
            }

            // Check for duplicates before testing
            const isDuplicate = geminiKeys.some((key, i) => i !== index && key.trim() === keyValue);
            if (isDuplicate) {
                statusSpan.textContent = i18n.get('duplicateKey');
                statusSpan.className = 'key-test-result error';
                statusSpan.title = i18n.get('duplicateKeyTitle');
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
    
    function removeGeminiKey(index) {
        if (geminiKeys.length <= 1) {
            alert(i18n.get('mustHaveOneKey'));
            return;
        }

        if (confirm(i18n.get('removeApiKeyConfirm', [index + 1]))) {
            geminiKeys.splice(index, 1);
            refreshGeminiKeysList();
        }
    }
    
    function refreshGeminiKeysList() {
        geminiKeysList.innerHTML = '';
        geminiKeys.forEach((key, index) => {
            addGeminiKeyInput(key, index);
        });
    }
    
    async function testGeminiKey(apiKey, index, keyItemElement) {
        const statusSpan = keyItemElement.querySelector('.key-test-result');
        
        if (!apiKey) {
            statusSpan.textContent = i18n.get('enterKeyFirst');
            statusSpan.className = 'key-test-result error';
            return;
        }
        
        try {
            statusSpan.textContent = i18n.get('testingStatus');
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
                statusSpan.textContent = i18n.get('validKey');
                statusSpan.className = 'key-test-result success';
            } else if (response.status === 429) {
                statusSpan.textContent = i18n.get('limitReachedGemini');
                statusSpan.className = 'key-test-result error';
                statusSpan.title = i18n.get('limitReachedGeminiTitle');
                console.error(`Key #${index + 1} has reached rate limit (429)`);
            } else if (response.status === 401 || response.status === 403) {
                statusSpan.textContent = i18n.get('invalidKey');
                statusSpan.className = 'key-test-result error';
                statusSpan.title = i18n.get('invalidKeyTitle');
                console.error(`Key #${index + 1} test failed: ${response.status}`);
            } else {
                statusSpan.textContent = i18n.get('testFailed', [response.status]);
                statusSpan.className = 'key-test-result error';
                console.error(`Key #${index + 1} test failed:`, response.status);
            }
        } catch (error) {
            statusSpan.textContent = i18n.get('errorStatus');
            statusSpan.className = 'key-test-result error';
            console.error(`Key #${index + 1} test error:`, error);
        }
    }

    updateProviderInfo();
    aiProviderSelect.addEventListener('change', updateProviderInfo);

    addGeminiKeyButton.addEventListener('click', () => {
        addGeminiKeyInput('');
    });
    
    document.getElementById('reset-gemini-counter').addEventListener('click', async () => {
        if (confirm(i18n.get('resetCounterConfirm'))) {
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
            usageMessage.textContent = i18n.get('counterResetMsg');
        }
    });
    
    document.getElementById('refresh-usage').addEventListener('click', async () => {
        await updateGeminiUsageDisplay();
        const usageMessage = document.getElementById('usage-message');
        usageMessage.className = 'usage-message info';
        usageMessage.textContent = i18n.get('usageRefreshed');
        setTimeout(() => {
            if (usageMessage.classList.contains('info')) {
                usageMessage.style.display = 'none';
            }
        }, 3000);
    });
    
    document.getElementById('refresh-all-usage').addEventListener('click', async () => {
        await updateGeminiUsageDisplay();
        showMessage(i18n.get('allUsageRefreshed'), true);
    });
    
    getApiKeyButton.addEventListener('click', async () => {
        const provider = aiProviderSelect.value;
        const config = aiProviders[provider];

        // Skip if provider has no signup URL (like openai-compatible)
        if (!config.signupUrl) {
            showMessage(i18n.get('noSignupUrl'), false);
            return;
        }

        try {
            await browser.tabs.create({ url: config.signupUrl });
        } catch (error) {
            console.error('Failed to open tab:', error);
            const url = config.signupUrl;
            try {
                await navigator.clipboard.writeText(url);
                showMessage(i18n.get('urlCopied', [url]), true);
            } catch (e) {
                alert(i18n.get('pleaseVisit', [url]));
            }
        }
    });

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

            saveButton.title = i18n.get('pleaseConfigure', [missingItems.join(' and ')]);
        } else {
            saveButton.disabled = false;
            saveButton.classList.remove('disabled');
            saveButton.title = '';
        }
    }

    browser.storage.local.get(['labels', 'apiKey', 'geminiApiKeys', 'aiProvider', 'enableAi', 'geminiPaidPlan', 'ollamaUrl', 'ollamaModel', 'ollamaCustomModel', 'ollamaCpuOnly', 'customBaseUrl', 'customModel', 'debugMode', 'batchChunkSize', 'autoSortEnabled', 'customPrompt']).then(result => {
        // Migration: default autoSortEnabled to true for users upgrading from older versions
        if (result.autoSortEnabled === undefined) {
            browser.storage.local.set({ autoSortEnabled: true }).catch(() => {});
            result.autoSortEnabled = true;
        }

        if (result.labels && result.labels.length > 0) {
            result.labels.forEach(label => {
                addLabelInput(label);
            });
        } else {
            labelsContainer.innerHTML = '<div class="instruction-message">' + i18n.get('noFoldersInstruction') + '</div>';
        }

        if (result.geminiApiKeys && result.geminiApiKeys.length > 0) {
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

        if (result.customBaseUrl && customBaseUrlInput) {
            customBaseUrlInput.value = result.customBaseUrl;
        }
        if (result.customModel) {
            const dropdownOptions = customModelSelect ? Array.from(customModelSelect.options).map(o => o.value) : [];
            if (dropdownOptions.includes(result.customModel)) {
                if (customModelSelect) customModelSelect.value = result.customModel;
            } else {
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

        geminiPaidCheckbox.checked = result.geminiPaidPlan === true;

        if (enableDebugCheckbox && result.debugMode !== undefined) {
            enableDebugCheckbox.checked = result.debugMode;
        }

        const batchChunkSizeInput = document.getElementById('batch-chunk-size');
        if (batchChunkSizeInput && result.batchChunkSize) {
            batchChunkSizeInput.value = result.batchChunkSize;
        }

        const autoSortCheckbox = document.getElementById('enable-auto-sort');
        if (autoSortCheckbox) {
            autoSortCheckbox.checked = result.autoSortEnabled === true;
        }

        const customPromptTextarea = document.getElementById('custom-prompt-text');
        if (customPromptTextarea) {
            customPromptTextarea.value = result.customPrompt || '';
        }

        updateSaveButtonState();
    });

    if (enableDebugCheckbox) {
        enableDebugCheckbox.addEventListener('change', async () => {
            if (window.debugLogger) {
                if (enableDebugCheckbox.checked) {
                    await window.debugLogger.enable();
                    showMessage(i18n.get('debugEnabled'), true);
                } else {
                    await window.debugLogger.disable();
                    showMessage(i18n.get('debugDisabled'), true);
                }
            }
        });
    }

    const resetPromptButton = document.getElementById('reset-prompt');
    if (resetPromptButton) {
        resetPromptButton.addEventListener('click', () => {
            const customPromptTextarea = document.getElementById('custom-prompt-text');
            if (customPromptTextarea) {
                customPromptTextarea.value = '';
                showMessage(i18n.get('promptCleared'), true);
            }
        });
    }

    apiKeyInput.addEventListener('input', updateSaveButtonState);
    labelsContainer.addEventListener('input', updateSaveButtonState);

    testApiButton.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        const provider = aiProviderSelect.value;
        
        // Skip for Ollama and OpenAI-Compatible as they have their own test buttons
        if (provider === 'ollama') {
            showApiTestResult(i18n.get('useOllamaTestButton'), false);
            return;
        }
        if (provider === 'openai-compatible') {
            showApiTestResult(i18n.get('useCustomTestButton'), false);
            return;
        }
        
        if (!apiKey) {
            showApiTestResult(i18n.get('enterApiKey'), false);
            return;
        }

        try {
            showApiTestResult(i18n.get('testingConnection'), false);
            
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
                showApiTestResult(i18n.get('apiConnectionSuccess'), true);
            } else {
                const error = await response.json();
                showApiTestResult(i18n.get('apiError', [error.error?.message || error.message || 'Unknown error']), false);
            }
        } catch (error) {
            showApiTestResult(i18n.get('connectionError', [error.message]), false);
        }
    });

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

            loadedFolders = [...new Set(allFolders
                .filter(f => !['Inbox', 'Trash', 'Drafts', 'Sent', 'Spam', 'Junk', 'Templates', 'Outbox', 'Archives'].includes(f))
                .map(f => f.replace(/^INBOX\./i, '').trim())
            )].sort();
            
            if (loadedFolders.length === 0) {
                showMessage(i18n.get('noFoldersFound'), false);
                folderLoadingIndicator.style.display = 'none';
                return;
            }

            folderCount.textContent = loadedFolders.length;
            foldersPreview.innerHTML = loadedFolders
                .slice(0, 10)
                .map(f => `<div class="folder-preview-item">${escapeHtml(f)}</div>`)
                .join('') + (loadedFolders.length > 10 ? `<div class="folder-preview-item">${escapeHtml(i18n.get('andMore', [loadedFolders.length - 10]))}</div>` : '');
            
            folderSelection.style.display = 'block';
        } catch (error) {
            showMessage(i18n.get('errorLoadingFolders', [error.message]), false);
            console.error('Error loading folders:', error);
        } finally {
            folderLoadingIndicator.style.display = 'none';
        }
    });

    useImapFoldersButton.addEventListener('click', () => {
        if (confirm(i18n.get('replaceFoldersConfirm', [loadedFolders.length]))) {
            labelsContainer.innerHTML = '';
            loadedFolders.forEach(folder => {
                addLabelInput(folder);
            });
            folderSelection.style.display = 'none';
            updateSaveButtonState();
            showMessage(i18n.get('loadedFoldersMsg', [loadedFolders.length]), true);
        }
    });

    useCustomFoldersButton.addEventListener('click', () => {
        folderSelection.style.display = 'none';
        showMessage(i18n.get('addCustomFoldersMsg'), true);
    });

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

    importLabelsButton.addEventListener('click', () => {
        const bulkText = bulkImportTextarea.value.trim();
        const labels = bulkText.split('\n').map(l => l.trim()).filter(l => l !== '');

        if (labels.length === 0) {
            showMessage(i18n.get('importOneLabelRequired'), false);
            return;
        }

        const existingLabels = Array.from(document.querySelectorAll('.label-input'))
            .map(input => input.value.trim())
            .filter(label => label !== '');
            
        if (existingLabels.length > 0) {
            if (!confirm(i18n.get('replaceExistingConfirm', [existingLabels.length, labels.length]))) {
                return;
            }
        }

        labelsContainer.innerHTML = '';

        labels.forEach(label => {
            addLabelInput(label);
        });

        updateSaveButtonState();
        showMessage(i18n.get('importedFoldersMsg', [labels.length]), true);
        bulkImportTextarea.value = '';
    });

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

    if (ollamaCustomModelInput) {
        ollamaCustomModelInput.addEventListener('input', updateSaveButtonState);
    }

    if (testOllamaButton) {
        testOllamaButton.addEventListener('click', async () => {
            const ollamaUrl = ollamaUrlInput.value.trim() || 'http://localhost:11434';
            let selectedModel = ollamaModelSelect.value;
            
            if (selectedModel === 'custom') {
                selectedModel = ollamaCustomModelInput.value.trim();
                if (!selectedModel) {
                    ollamaTestResult.textContent = i18n.get('enterCustomModelFirst');
                    ollamaTestResult.className = 'api-test-result error';
                    return;
                }
            }
            
            try {
                ollamaTestResult.textContent = i18n.get('testingConnectionModels');
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
                        ollamaTestResult.textContent = i18n.get('ollamaRunningNoModels');
                        ollamaTestResult.className = 'api-test-result error';
                    } else {
                        // Extract base model name (before colon) for regex matching
                        const selectedBase = selectedModel.split(':')[0].toLowerCase();
                        const installedBases = installedModels.map(m => m.split(':')[0].toLowerCase());
                        
                        const modelFound = installedBases.some(base => base === selectedBase);
                        if (modelFound) {
                            ollamaTestResult.textContent = i18n.get('connectedModelReady', [selectedModel, installedModels.join(', ')]);
                            ollamaTestResult.className = 'api-test-result success';
                        } else {
                            ollamaTestResult.textContent = i18n.get('modelNotInstalled', [selectedModel, installedModels.join(', ')]);
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
                    ollamaTestResult.textContent = i18n.get('ollamaErrorLabel', [errorMsg]);
                    ollamaTestResult.className = 'api-test-result error';
                }
            } catch (error) {
                console.error('[Ollama Test] Exception:', error);
                ollamaTestResult.textContent = i18n.get('ollamaConnectionFailed', [error.message]);
                ollamaTestResult.className = 'api-test-result error';
            }
        });
    }

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

    if (customBaseUrlInput) {
        customBaseUrlInput.addEventListener('input', updateSaveButtonState);
    }
    if (customModelCustomInput) {
        customModelCustomInput.addEventListener('input', updateSaveButtonState);
    }

    if (fetchCustomModelsButton) {
        fetchCustomModelsButton.addEventListener('click', async () => {
            const baseUrl = customBaseUrlInput ? customBaseUrlInput.value.trim().replace(/\/$/, '') : '';
            const apiKey = customApiKeyInput ? customApiKeyInput.value.trim() : '';

            if (!baseUrl) {
                if (customTestResult) {
                    customTestResult.textContent = i18n.get('enterBaseUrlFirst');
                    customTestResult.className = 'api-test-result error';
                }
                return;
            }

            try {
                if (customTestResult) {
                    customTestResult.textContent = i18n.get('fetchingModels');
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
                    const response = await fetch(baseUrl + '/models', { headers });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    modelsData = await response.json();
                }

                const models = modelsData.data || modelsData.models || [];

                if (models.length === 0) {
                    if (customTestResult) {
                        customTestResult.textContent = i18n.get('noModelsEndpoint');
                        customTestResult.className = 'api-test-result error';
                    }
                    return;
                }

                if (customModelSelect) {
                    customModelSelect.innerHTML = `<option value="">-- ${i18n.get('openaiCompatibleModelSelect')} --</option>`;
                    models.forEach(m => {
                        const modelId = m.id || m.name || m;
                        const option = document.createElement('option');
                        option.value = modelId;
                        option.textContent = modelId;
                        customModelSelect.appendChild(option);
                    });
                    const customOpt = document.createElement('option');
                    customOpt.value = 'custom';
                    customOpt.textContent = i18n.get('openaiCompatibleModelCustom');
                    customModelSelect.appendChild(customOpt);
                }

                if (customTestResult) {
                    customTestResult.textContent = i18n.get('foundModelsMsg', [models.length]);
                    customTestResult.className = 'api-test-result success';
                }

            } catch (error) {
                console.error('[Fetch Models] Error:', error);
                if (customTestResult) {
                    customTestResult.textContent = i18n.get('failedFetchModels', [error.message]);
                    customTestResult.className = 'api-test-result error';
                }
            }
        });
    }

    if (testCustomEndpointButton) {
        testCustomEndpointButton.addEventListener('click', async () => {
            const baseUrl = customBaseUrlInput ? customBaseUrlInput.value.trim() : '';
            let model = customModelSelect ? customModelSelect.value : '';
            const apiKey = customApiKeyInput ? customApiKeyInput.value.trim() : '';

            if (model === 'custom' && customModelCustomInput) {
                model = customModelCustomInput.value.trim();
            }

            if (!baseUrl) {
                if (customTestResult) {
                    customTestResult.textContent = i18n.get('enterBaseUrl');
                    customTestResult.className = 'api-test-result error';
                }
                return;
            }
            if (!model) {
                if (customTestResult) {
                    customTestResult.textContent = i18n.get('enterModelName');
                    customTestResult.className = 'api-test-result error';
                }
                return;
            }

            try {
                if (customTestResult) {
                    customTestResult.textContent = i18n.get('testingConnection');
                    customTestResult.className = 'api-test-result';
                }

                const headers = { 'Content-Type': 'application/json' };
                if (apiKey) {
                    headers['Authorization'] = `Bearer ${apiKey}`;
                }

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
                        customTestResult.textContent = i18n.get('connectedSuccessfully', [model, normalizedUrl]);
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
                    customTestResult.textContent = i18n.get('genericErrorLabel', [errorMsg]);
                        customTestResult.className = 'api-test-result error';
                    }
                }
            } catch (error) {
                console.error('[Custom Endpoint Test] Exception:', error);
                if (customTestResult) {
                    customTestResult.textContent = i18n.get('customConnectionFailed', [error.message]);
                    customTestResult.className = 'api-test-result error';
                }
            }
        });
    }

    if (diagnoseOllamaButton) {
        diagnoseOllamaButton.addEventListener('click', async () => {
            const ollamaUrl = ollamaUrlInput.value.trim() || 'http://localhost:11434';
            let diagnosticOutput = i18n.get('diagnosticsTitle') + '\n' + '='.repeat(50) + '\n\n';

            ollamaDiagnostics.style.display = 'block';
            ollamaDiagnostics.className = 'diagnostics-result';
            ollamaDiagnostics.textContent = diagnosticOutput + i18n.get('diagnosticsRunning') + '\n';

            try {
                diagnosticOutput += i18n.get('testListModels') + '\n';
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
                            diagnosticOutput += '   ' + i18n.get('noInstalledModels') + '\n';
                        }
                    } else {
                        diagnosticOutput += `   ✗ FAILED\n`;
                    }
                } catch (error) {
                    diagnosticOutput += `   ✗ ERROR: ${error.message}\n`;
                }

                diagnosticOutput += '\n' + i18n.get('testVersion') + '\n';
                diagnosticOutput += `   URL: ${ollamaUrl}/api/version\n`;
                try {
                    const versionResponse = await fetch(`${ollamaUrl}/api/version`);
                    diagnosticOutput += `   Status: ${versionResponse.status} ${versionResponse.statusText}\n`;
                    
                    if (versionResponse.ok) {
                        const data = await versionResponse.json();
                        diagnosticOutput += `   ✓ SUCCESS - Ollama version: ${data.version || i18n.get('unknownVersion')}\n`;
                    } else {
                        diagnosticOutput += `   ` + i18n.get('versionNotAvailable') + `\n`;
                    }
                } catch (error) {
                    diagnosticOutput += `   ✗ ERROR: ${error.message}\n`;
                }

                diagnosticOutput += '\n' + i18n.get('testPullEndpoint') + '\n';
                diagnosticOutput += `   URL: ${ollamaUrl}/api/pull\n`;
                diagnosticOutput += '   ' + i18n.get('pullEndpointNote') + '\n';

                diagnosticOutput += '\n' + '='.repeat(50) + '\n';
                diagnosticOutput += i18n.get('diagnosticsSummary') + '\n\n';
                
                if (diagnosticOutput.includes('✓ SUCCESS - Found')) {
                    diagnosticOutput += i18n.get('ollamaRunningOk') + '\n';
                    diagnosticOutput += i18n.get('diagnosticsApiUrl', [ollamaUrl]) + '\n';
                    ollamaDiagnostics.className = 'diagnostics-result success';
                } else {
                    diagnosticOutput += i18n.get('cannotConnectOllama') + '\n';
                    diagnosticOutput += '\n' + i18n.get('troubleshootingLabel') + '\n';
                    diagnosticOutput += i18n.get('troubleshootRunning') + '\n';
                    diagnosticOutput += i18n.get('troubleshootStart') + '\n';
                    diagnosticOutput += i18n.get('troubleshootTest', [ollamaUrl]) + '\n';
                    diagnosticOutput += i18n.get('troubleshootPort') + '\n';
                    ollamaDiagnostics.className = 'diagnostics-result error';
                }
                
            } catch (error) {
                diagnosticOutput += '\n' + i18n.get('criticalError') + '\n';
                diagnosticOutput += error.message + '\n';
                ollamaDiagnostics.className = 'diagnostics-result error';
            }
            
            ollamaDiagnostics.textContent = diagnosticOutput;
        });
    }

    if (listOllamaModelsButton) {
        listOllamaModelsButton.addEventListener('click', async () => {
            const ollamaUrl = ollamaUrlInput.value.trim() || 'http://localhost:11434';
            
            try {
                ollamaTestResult.textContent = i18n.get('fetchingModelsStatus');
                ollamaTestResult.className = 'api-test-result';
                
                const response = await fetch(`${ollamaUrl}/api/tags`);
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.models && data.models.length > 0) {
                        const modelNames = data.models.map(m => m.name).join(', ');
                        ollamaTestResult.textContent = i18n.get('availableModels', [modelNames]);
                        ollamaTestResult.className = 'api-test-result success';
                    } else {
                        ollamaTestResult.textContent = i18n.get('noModelsInstalledHint');
                        ollamaTestResult.className = 'api-test-result error';
                    }
                } else {
                    ollamaTestResult.textContent = i18n.get('failedFetchModelsSimple');
                    ollamaTestResult.className = 'api-test-result error';
                }
            } catch (error) {
                ollamaTestResult.textContent = i18n.get('ollamaConnectionFailedSimple', [error.message]);
                ollamaTestResult.className = 'api-test-result error';
            }
        });
    }

    if (downloadOllamaModelButton) {
        downloadOllamaModelButton.addEventListener('click', async () => {
            const ollamaUrl = (ollamaUrlInput.value.trim() || 'http://localhost:11434').replace(/\/$/, '');
            const modelName = ollamaDownloadModelInput.value.trim();
            const token = ollamaAuthTokenInput && ollamaAuthTokenInput.value.trim();
            if (!modelName) {
                ollamaDownloadStatus.textContent = i18n.get('enterModelDownload');
                ollamaDownloadStatus.className = 'api-test-result error';
                ollamaDownloadStatus.style.display = 'block';
                return;
            }
            try {
                downloadOllamaModelButton.disabled = true;
                ollamaDownloadStatus.textContent = i18n.get('startingDownload', [modelName]);
                ollamaDownloadStatus.className = 'api-test-result';
                ollamaDownloadStatus.style.display = 'block';

                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                await browser.runtime.sendMessage({
                    action: 'startOllamaPull',
                    ollamaUrl,
                    model: modelName,
                    headers
                });
            } catch (e) {
                ollamaDownloadStatus.textContent = i18n.get('failedStart', [e.message]);
                ollamaDownloadStatus.className = 'api-test-result error';
            } finally {
                downloadOllamaModelButton.disabled = false;
            }
        });
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
                    ollamaDownloadStatus.textContent = i18n.get('downloadComplete');
                    ollamaDownloadStatus.className = 'api-test-result success';
                } else {
                    ollamaDownloadStatus.textContent = i18n.get('downloadFailed', [msg.error || i18n.get('unknownError')]);
                    ollamaDownloadStatus.className = 'api-test-result error';
                }
                ollamaDownloadStatus.style.display = 'block';
            }
        });
    }
    
    addLabelButton.addEventListener('click', () => {
        const instructionMsg = labelsContainer.querySelector('.instruction-message');
        if (instructionMsg) {
            labelsContainer.innerHTML = '';
        }
        addLabelInput('');
        updateSaveButtonState();
    });

    saveButton.addEventListener('click', () => {
        const labels = Array.from(document.querySelectorAll('.label-input'))
            .map(input => input.value.trim())
            .filter(label => label !== '');
        
        const apiKey = apiKeyInput.value.trim();
        const provider = aiProviderSelect.value;

        const batchChunkSizeEl = document.getElementById('batch-chunk-size');
        const batchChunkSize = Math.max(1, Math.min(20, parseInt(batchChunkSizeEl?.value) || 5));

        const autoSortCheckbox = document.getElementById('enable-auto-sort');
        const autoSortEnabled = autoSortCheckbox ? autoSortCheckbox.checked : false;

        const customPromptTextarea = document.getElementById('custom-prompt-text');
        const customPrompt = customPromptTextarea ? customPromptTextarea.value.trim() : '';

        if (labels.length === 0) {
            showMessage(i18n.get('addFolderBeforeSave'), false);
            return;
        }

        if (provider === 'gemini') {
            const validGeminiKeys = geminiKeys.filter(key => key && key.trim() !== '');
            
            if (validGeminiKeys.length === 0) {
                showMessage(i18n.get('addGeminiKeyBeforeSave'), false);
                return;
            }

            const uniqueKeys = new Set(validGeminiKeys.map(key => key.trim().toLowerCase()));
            if (uniqueKeys.size !== validGeminiKeys.length) {
                showMessage(i18n.get('duplicateApiKeys'), false);
                return;
            }
            
            const settings = {
                labels: labels,
                geminiApiKeys: validGeminiKeys,
                currentGeminiKeyIndex: 0, // Start with first key
                aiProvider: provider,
                enableAi: document.getElementById('enable-ai').checked,
                geminiPaidPlan: geminiPaidCheckbox.checked,
                debugMode: enableDebugCheckbox ? enableDebugCheckbox.checked : false,
                batchChunkSize: batchChunkSize,
                autoSortEnabled: autoSortEnabled,
                customPrompt: customPrompt
            };

            browser.storage.local.get(['geminiRateLimits']).then(result => {
                if (!result.geminiRateLimits || result.geminiRateLimits.length !== validGeminiKeys.length) {
                    settings.geminiRateLimits = validGeminiKeys.map(() => ({
                        requests: [],
                        dailyCount: 0,
                        dailyResetTime: Date.now() + (24 * 60 * 60 * 1000)
                    }));
                }
                
                browser.storage.local.set(settings).then(() => {
                    showMessage(i18n.get('settingsSavedMultiKey'), true);
                    updateSaveButtonState();
                }).catch(error => {
                    showMessage(i18n.get('errorSavingSettings', [error]), false);
                });
            });
        } else if (provider === 'ollama') {
            // Ollama doesn't need API key, just save URL and model
            let ollamaModel = ollamaModelSelect.value;
            if (ollamaModel === 'custom') {
                ollamaModel = ollamaCustomModelInput.value.trim();
                if (!ollamaModel) {
                    showMessage(i18n.get('enterOllamaModel'), false);
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
                debugMode: enableDebugCheckbox ? enableDebugCheckbox.checked : false,
                batchChunkSize: batchChunkSize,
                autoSortEnabled: autoSortEnabled,
                customPrompt: customPrompt
            };

            browser.storage.local.set(settings).then(() => {
                const cpuMode = ollamaCpuOnlyCheckbox.checked ? ' (' + i18n.get('ollamaCpuOnly') + ')' : '';
                showMessage(i18n.get('settingsSavedOllama', [cpuMode]), true);
                updateSaveButtonState();
            }).catch(error => {
                showMessage('Error saving settings: ' + error, false);
            });
        } else if (provider === 'openai-compatible') {
            // OpenAI-Compatible endpoint needs base URL and model
            const baseUrl = customBaseUrlInput ? customBaseUrlInput.value.trim() : '';
            let model = customModelSelect ? customModelSelect.value : '';
            const apiKey = customApiKeyInput ? customApiKeyInput.value.trim() : '';

            if (model === 'custom' && customModelCustomInput) {
                model = customModelCustomInput.value.trim();
            }

            if (!baseUrl) {
                showMessage(i18n.get('enterCustomBaseUrl'), false);
                return;
            }
            if (!model) {
                showMessage(i18n.get('enterCustomModel'), false);
                return;
            }

            const settings = {
                labels: labels,
                aiProvider: provider,
                enableAi: document.getElementById('enable-ai').checked,
                customBaseUrl: baseUrl.replace(/\/$/, ''),
                customModel: model,
                apiKey: apiKey,
                debugMode: enableDebugCheckbox ? enableDebugCheckbox.checked : false,
                batchChunkSize: batchChunkSize,
                autoSortEnabled: autoSortEnabled,
                customPrompt: customPrompt
            };

            browser.storage.local.set(settings).then(() => {
                showMessage(i18n.get('settingsSavedCustomEndpoint'), true);
                updateSaveButtonState();
            }).catch(error => {
                showMessage('Error saving settings: ' + error, false);
            });
        } else {
            // Other providers use single key
            if (!apiKey) {
                showMessage(i18n.get('enterApiKeyBeforeSave'), false);
                return;
            }

            const settings = {
                labels: labels,
                apiKey: apiKey,
                aiProvider: provider,
                enableAi: document.getElementById('enable-ai').checked,
                debugMode: enableDebugCheckbox ? enableDebugCheckbox.checked : false,
                batchChunkSize: batchChunkSize,
                autoSortEnabled: autoSortEnabled,
                customPrompt: customPrompt
            };

            browser.storage.local.set(settings).then(() => {
                showMessage(i18n.get('settingsSavedSuccess'), true);
                updateSaveButtonState();
            }).catch(error => {
                showMessage('Error saving settings: ' + error, false);
            });
        }
    });

    function addLabelInput(value = '') {
        const labelItem = document.createElement('div');
        labelItem.className = 'label-item';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'label-input';
        input.placeholder = i18n.get('labelInputPlaceholder');
        input.value = value;
        input.addEventListener('input', updateSaveButtonState);

        const removeButton = document.createElement('button');
        removeButton.className = 'remove-label';
        removeButton.textContent = '×';
        removeButton.addEventListener('click', () => {
            labelItem.remove();
            updateSaveButtonState();

            const remainingLabels = document.querySelectorAll('.label-input');
            if (remainingLabels.length === 0) {
                labelsContainer.innerHTML = '<div class="instruction-message">' + i18n.get('noFoldersInstruction') + '</div>';
            }
        });

        labelItem.appendChild(input);
        labelItem.appendChild(removeButton);
        labelsContainer.appendChild(labelItem);
    }

    function showApiTestResult(message, isSuccess) {
        apiTestResult.textContent = message;
        apiTestResult.className = `api-test-result ${isSuccess ? 'success' : 'error'}`;
    }

    async function fetchModelsViaTab(baseUrl, apiKey) {
        const tab = await browser.tabs.create({ url: baseUrl, active: false });

        try {
            await new Promise(resolve => setTimeout(resolve, 500));
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

        let result = null;
            for (let i = 0; i < 40; i++) { // 10 seconds max (250ms intervals)
                await new Promise(resolve => setTimeout(resolve, 250));
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
            try { await browser.tabs.remove(tab.id); } catch (e) { console.warn('[Options] Failed to close tab:', e.message); }
        }
    }

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

    function formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString();
    }

    async function updateHistoryTable() {
        const historyBody = document.getElementById('history-body');
        const data = await browser.storage.local.get('moveHistory');
        const history = data.moveHistory || [];
        
        historyBody.innerHTML = history.map(entry => `
            <tr>
                <td class="timestamp">${formatTimestamp(entry.timestamp)}</td>
                <td>${escapeHtml(entry.subject)}</td>
                <td class="${escapeHtml(entry.status.toLowerCase())}">${escapeHtml(entry.status)}</td>
                <td>${escapeHtml(entry.destination)}</td>
            </tr>
        `).join('');
    }

    async function clearHistory() {
        if (confirm(i18n.get('clearHistoryConfirm'))) {
            await browser.storage.local.set({ moveHistory: [] });
            await updateHistoryTable();
        }
    }

    await updateHistoryTable();

    document.getElementById('clear-history').addEventListener('click', clearHistory);
    document.getElementById('refresh-history').addEventListener('click', updateHistoryTable);

    // ── Batch Progress Panel ───────────────────────────────────────────────

    const batchPanel      = document.getElementById('batch-status-panel');
    const batchFill       = document.getElementById('batch-progress-fill');
    const batchText       = document.getElementById('batch-progress-text');
    const batchBadge      = document.getElementById('batch-provider-badge');
    const batchPauseBtn   = document.getElementById('batch-pause-btn');
    const batchResumeBtn  = document.getElementById('batch-resume-btn');
    const batchCancelBtn  = document.getElementById('batch-cancel-btn');

    let _batchHideTimer = null;

    /**
     * Update the batch panel UI from a progress payload.
     * @param {{ status, total, completed, failed, skipped, provider, chunkIndex, totalChunks }} payload
     */
    function applyBatchProgress(payload) {
        if (!batchPanel || !payload) return;

        // Use defaults for safety
        const {
            status = 'running',
            total = 0,
            completed = 0,
            failed = 0,
            skipped = 0,
            provider = '',
            chunkIndex = 0,
            totalChunks = 0
        } = payload;

        const done = (completed || 0) + (failed || 0) + (skipped || 0);
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        batchPanel.style.display = 'block';
        batchPanel.dataset.status = status;

        if (batchBadge && provider) {
            batchBadge.textContent = provider;
        }

        if (batchFill) {
            batchFill.style.width = pct + '%';
        }

        const displayChunk = chunkIndex || 0;
        const displayTotal = totalChunks || 0;

        if (batchText) {
            if (status === 'paused') {
                if (displayTotal > 0) {
                    batchText.textContent = i18n.get('batchPausedChunk', [displayChunk, displayTotal, done, total]);
                } else {
                    batchText.textContent = i18n.get('batchPausedSimple', [done, total]);
                }
            } else if (status === 'done') {
                batchText.textContent = i18n.get('batchDone', [completed, skipped, failed]);
            } else if (status === 'cancelled') {
                if (displayTotal > 0) {
                    batchText.textContent = i18n.get('batchCancelledChunk', [displayChunk, displayTotal]);
                } else {
                    batchText.textContent = i18n.get('batchCancelledSimple', [done, total]);
                }
            } else {
                if (displayTotal > 0) {
                    batchText.textContent = i18n.get('batchRunningChunk', [displayChunk, displayTotal, done, total, completed, failed]);
                } else {
                    batchText.textContent = i18n.get('batchRunningSimple', [done, total, completed, failed]);
                }
            }
        }

        if (batchPauseBtn && batchResumeBtn) {
            if (status === 'paused') {
                batchPauseBtn.style.display  = 'none';
                batchResumeBtn.style.display = '';
            } else {
                batchPauseBtn.style.display  = '';
                batchResumeBtn.style.display = 'none';
            }
        }

        if (batchCancelBtn) {
            batchCancelBtn.style.display = (status === 'done' || status === 'cancelled') ? 'none' : '';
        }

        if (status === 'done' || status === 'cancelled') {
            clearTimeout(_batchHideTimer);
            _batchHideTimer = setTimeout(() => {
                if (batchPanel) batchPanel.style.display = 'none';
            }, 5000);
        }
    }

    browser.storage.local.get('currentBatch').then(result => {
        if (result.currentBatch && result.currentBatch.status === 'running') {
            applyBatchProgress(result.currentBatch);
        }
    });

    browser.runtime.onMessage.addListener(msg => {
        if (msg.action === 'batchProgress') {
            applyBatchProgress(msg);
        }
    });

    if (batchPauseBtn) {
        batchPauseBtn.addEventListener('click', () => {
            browser.runtime.sendMessage({ action: 'batchControl', command: 'pause' }).catch(() => {});
            if (batchPanel) batchPanel.dataset.status = 'paused';
            if (batchText)  batchText.textContent = i18n.get('batchPausing');
            if (batchPauseBtn)  batchPauseBtn.style.display  = 'none';
            if (batchResumeBtn) batchResumeBtn.style.display = '';
        });
    }

    if (batchResumeBtn) {
        batchResumeBtn.addEventListener('click', () => {
            browser.runtime.sendMessage({ action: 'batchControl', command: 'resume' }).catch(() => {});
            if (batchPanel) batchPanel.dataset.status = 'running';
            if (batchPauseBtn)  batchPauseBtn.style.display  = '';
            if (batchResumeBtn) batchResumeBtn.style.display = 'none';
        });
    }

    if (batchCancelBtn) {
        batchCancelBtn.addEventListener('click', () => {
            if (!confirm(i18n.get('batchCancelConfirm'))) return;
            browser.runtime.sendMessage({ action: 'batchControl', command: 'cancel' }).catch(() => {});
            if (batchText) batchText.textContent = i18n.get('batchCancelling');
            if (batchCancelBtn) batchCancelBtn.disabled = true;
        });
    }
}); 
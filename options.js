document.addEventListener('DOMContentLoaded', async function() {
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
    
    let loadedFolders = [];
    
    // AI Provider configurations
    const aiProviders = {
        gemini: {
            name: 'Google Gemini',
            signupUrl: 'https://aistudio.google.com/app/apikey',
            info: '✓ Free tier: 15 requests/minute, 1500/day<br>✓ Best for: General use, multilingual support<br>✓ Models: Gemini 2.5 Flash',
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
        }
    };
    
    // Update provider info when selection changes
    function updateProviderInfo() {
        const provider = aiProviderSelect.value;
        const config = aiProviders[provider];
        
        // Show/hide Gemini paid plan option
        if (provider === 'gemini') {
            geminiPaidContainer.style.display = 'block';
        } else {
            geminiPaidContainer.style.display = 'none';
        }
        
        providerInfo.innerHTML = `
            <div class="provider-details">
                <strong>${config.name}</strong> ${config.isFree ? '<span class="free-badge">FREE</span>' : '<span class="paid-badge">PAID</span>'}
                <p>${config.info}</p>
            </div>
        `;
        
        apiKeyInput.placeholder = `Enter your ${config.name} API key`;
    }
    
    // Initialize provider info
    updateProviderInfo();
    aiProviderSelect.addEventListener('change', updateProviderInfo);
    
    // Get API Key button
    getApiKeyButton.addEventListener('click', async () => {
        const provider = aiProviderSelect.value;
        const config = aiProviders[provider];
        
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
        
        const apiKey = apiKeyInput.value.trim();
        
        if (labels.length === 0 || !apiKey) {
            saveButton.disabled = true;
            saveButton.classList.add('disabled');
            
            let missingItems = [];
            if (labels.length === 0) missingItems.push('folders/labels');
            if (!apiKey) missingItems.push('API key');
            
            saveButton.title = `Please configure: ${missingItems.join(' and ')}`;
        } else {
            saveButton.disabled = false;
            saveButton.classList.remove('disabled');
            saveButton.title = '';
        }
    }

    // Load saved settings
    browser.storage.local.get(['labels', 'apiKey', 'aiProvider', 'enableAi', 'geminiPaidPlan']).then(result => {
        if (result.labels && result.labels.length > 0) {
            result.labels.forEach(label => {
                addLabelInput(label);
            });
        } else {
            // Show instruction if no labels
            labelsContainer.innerHTML = '<div class="instruction-message">No folders/labels configured. Click "Load Folders from Mail Account" above or add custom labels below.</div>';
        }
        if (result.apiKey) {
            apiKeyInput.value = result.apiKey;
        }
        if (result.aiProvider) {
            aiProviderSelect.value = result.aiProvider;
            updateProviderInfo();
        }
        // Set enableAi to true by default if not set
        document.getElementById('enable-ai').checked = result.enableAi !== false;
        
        // Set gemini paid plan checkbox
        geminiPaidCheckbox.checked = result.geminiPaidPlan === true;
        
        updateSaveButtonState();
    });
    
    // Add input listeners for validation
    apiKeyInput.addEventListener('input', updateSaveButtonState);
    labelsContainer.addEventListener('input', updateSaveButtonState);

    // Test API connection
    testApiButton.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        const provider = aiProviderSelect.value;
        
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
        
        // Validation
        if (labels.length === 0) {
            showMessage('Please add at least one folder/label before saving. Use "Load Folders from Mail Account" or add custom labels.', false);
            return;
        }
        
        if (!apiKey) {
            showMessage('Please enter your API key before saving. Click "Get API Key" to obtain one.', false);
            return;
        }

        const settings = {
            labels: labels,
            apiKey: apiKey,
            aiProvider: aiProviderSelect.value,
            enableAi: document.getElementById('enable-ai').checked,
            geminiPaidPlan: geminiPaidCheckbox.checked
        };

        browser.storage.local.set(settings).then(() => {
            showMessage('✓ Settings saved successfully! You can now use AutoSort+ to analyze emails.', true);
            updateSaveButtonState();
        }).catch(error => {
            showMessage('Error saving settings: ' + error, false);
        });
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
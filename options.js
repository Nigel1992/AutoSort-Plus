document.addEventListener('DOMContentLoaded', function() {
    const labelsContainer = document.getElementById('labels-container');
    const addLabelButton = document.getElementById('add-label');
    const saveButton = document.getElementById('save-settings');
    const bulkMoveCheckbox = document.getElementById('bulk-move');
    const geminiApiKeyInput = document.getElementById('gemini-api-key');
    const enableAiCheckbox = document.getElementById('enable-ai');
    const testApiButton = document.getElementById('test-api');
    const apiTestResult = document.getElementById('api-test-result');
    const importLabelsButton = document.getElementById('import-labels');
    const bulkImportTextarea = document.getElementById('bulk-import-text');

    // Load saved settings
    browser.storage.local.get(['labels', 'bulkMove', 'geminiApiKey', 'enableAi']).then(result => {
        if (result.labels) {
            result.labels.forEach(label => {
                addLabelInput(label);
            });
        }
        if (result.bulkMove !== undefined) {
            bulkMoveCheckbox.checked = result.bulkMove;
        }
        if (result.geminiApiKey) {
            geminiApiKeyInput.value = result.geminiApiKey;
        }
        if (result.enableAi !== undefined) {
            enableAiCheckbox.checked = result.enableAi;
        }
    });

    // Test API connection
    testApiButton.addEventListener('click', async () => {
        const apiKey = geminiApiKeyInput.value.trim();
        if (!apiKey) {
            showApiTestResult('Please enter an API key', false);
            return;
        }

        try {
            const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: "Test connection"
                        }]
                    }]
                })
            });

            if (response.ok) {
                showApiTestResult('API connection successful!', true);
            } else {
                const error = await response.json();
                showApiTestResult(`API Error: ${error.error?.message || 'Unknown error'}`, false);
            }
        } catch (error) {
            showApiTestResult(`Connection Error: ${error.message}`, false);
        }
    });

    // Import labels in bulk
    importLabelsButton.addEventListener('click', () => {
        const labelsText = bulkImportTextarea.value.trim();
        if (!labelsText) {
            showMessage('Please enter labels to import', false);
            return;
        }

        // Clear existing labels
        labelsContainer.innerHTML = '';

        // Split by newlines and filter out empty lines
        const labels = labelsText.split('\n')
            .map(label => label.trim())
            .filter(label => label !== '');

        // Add each label
        labels.forEach(label => {
            addLabelInput(label);
        });

        showMessage(`Imported ${labels.length} labels`, true);
        bulkImportTextarea.value = ''; // Clear the textarea
    });

    // Add new label input
    addLabelButton.addEventListener('click', () => {
        addLabelInput('');
    });

    // Save settings
    saveButton.addEventListener('click', () => {
        const labels = Array.from(document.querySelectorAll('.label-input'))
            .map(input => input.value.trim())
            .filter(label => label !== '');

        const settings = {
            labels: labels,
            bulkMove: bulkMoveCheckbox.checked,
            geminiApiKey: geminiApiKeyInput.value,
            enableAi: enableAiCheckbox.checked
        };

        browser.storage.local.set(settings).then(() => {
            showMessage('Settings saved successfully!');
        }).catch(error => {
            showMessage('Error saving settings: ' + error);
        });
    });

    // Add label input field
    function addLabelInput(value = '') {
        const labelItem = document.createElement('div');
        labelItem.className = 'label-item';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'label-input';
        input.placeholder = 'Enter label name';
        input.value = value;

        const removeButton = document.createElement('button');
        removeButton.className = 'remove-label';
        removeButton.textContent = '×';
        removeButton.addEventListener('click', () => {
            labelItem.remove();
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
}); 
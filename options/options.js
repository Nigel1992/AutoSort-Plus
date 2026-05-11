// options.js — thin entry point
document.addEventListener('DOMContentLoaded', async function() {
  if (typeof applyTranslations === 'function') applyTranslations();
  if (window.debugLogger) window.debugLogger.init();

  // Global updater for save button state
  window.AutoSortPlusSaveButtonUpdater = () => {
    const saveBtn = document.getElementById('save-settings');
    if (!saveBtn) return;
    const labels = Array.from(document.querySelectorAll('.label-input')).map(i => i.value.trim()).filter(l => l);
    let hasValidConfig = labels.length > 0;
    const provider = document.getElementById('ai-provider')?.value;
    if (provider === 'gemini') hasValidConfig = hasValidConfig && document.querySelectorAll('.gemini-api-key-input').length > 0;
    else if (provider === 'ollama') hasValidConfig = hasValidConfig && !!document.getElementById('ollama-url')?.value.trim();
    else if (provider === 'openai-compatible') hasValidConfig = hasValidConfig && !!document.getElementById('custom-base-url')?.value.trim();
    else hasValidConfig = hasValidConfig && !!document.getElementById('api-key')?.value.trim();

    saveBtn.disabled = !hasValidConfig;
    saveBtn.classList.toggle('disabled', !hasValidConfig);
  };

  // Wire up the "add label" button (still needed for manual label addition)
  const labelsContainer = document.getElementById('labels-container');
  const addLabelButton = document.getElementById('add-label');
  if (addLabelButton && labelsContainer) {
    addLabelButton.addEventListener('click', () => {
      const instructionMsg = labelsContainer.querySelector('.instruction-message');
      if (instructionMsg) labelsContainer.innerHTML = '';
      const labelItem = document.createElement('div');
      labelItem.className = 'label-item';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'label-input';
      input.placeholder = i18n.get('labelInputPlaceholder');
      input.addEventListener('input', window.AutoSortPlusSaveButtonUpdater);
      const removeButton = document.createElement('button');
      removeButton.className = 'remove-label';
      removeButton.textContent = '×';
      removeButton.addEventListener('click', () => {
        labelItem.remove();
        window.AutoSortPlusSaveButtonUpdater();
        const remaining = document.querySelectorAll('.label-input');
        if (remaining.length === 0) {
          labelsContainer.innerHTML = '<div class="instruction-message">' + i18n.get('noFoldersInstruction') + '</div>';
        }
      });
      labelItem.appendChild(input);
      labelItem.appendChild(removeButton);
      labelsContainer.appendChild(labelItem);
      window.AutoSortPlusSaveButtonUpdater();
    });
  }

  // Wire up Ollama model select → show/hide custom model input
  const ollamaModelSelect = document.getElementById('ollama-model');
  const ollamaCustomModelInput = document.getElementById('ollama-custom-model');
  if (ollamaModelSelect) {
    ollamaModelSelect.addEventListener('change', () => {
      if (ollamaModelSelect.value === 'custom') {
        if (ollamaCustomModelInput) ollamaCustomModelInput.style.display = 'block';
      } else {
        if (ollamaCustomModelInput) ollamaCustomModelInput.style.display = 'none';
      }
      if (window.AutoSortPlusSaveButtonUpdater) window.AutoSortPlusSaveButtonUpdater();
    });
  }
  if (ollamaCustomModelInput) {
    ollamaCustomModelInput.addEventListener('input', window.AutoSortPlusSaveButtonUpdater);
  }

  // Wire up custom model select → show/hide custom model input
  const customModelSelect = document.getElementById('custom-model-select');
  const customModelCustomInput = document.getElementById('custom-model-custom');
  if (customModelSelect) {
    customModelSelect.addEventListener('change', () => {
      if (customModelSelect.value === 'custom') {
        if (customModelCustomInput) customModelCustomInput.style.display = 'block';
      } else {
        if (customModelCustomInput) customModelCustomInput.style.display = 'none';
      }
      if (window.AutoSortPlusSaveButtonUpdater) window.AutoSortPlusSaveButtonUpdater();
    });
  }

  // Wire up debug checkbox
  const enableDebugCheckbox = document.getElementById('enable-debug');
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

  // Wire up reset prompt button
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

  // Initialize modules
  const modules = {};
  modules.collapsible = new CollapsibleManager();
  await modules.collapsible.init();
  await modules.collapsible.restoreState();
  modules.providerUI = new ProviderUI();
  modules.providerUI.update();
  modules.apiTest = new APITester(modules.providerUI);
  modules.geminiKeys = new GeminiKeyManager();
  modules.ollamaUI = new OllamaUI();
  modules.customEndpointUI = new CustomEndpointUI();
  modules.folderManager = new FolderManager();
  modules.historyPanel = new HistoryPanel();
  modules.batchPanel = new BatchPanel();
  modules.saveHandler = new SaveHandler(modules);
  modules.saveHandler.bindSaveButton();

  // Load saved settings
  await modules.saveHandler.load();
  window.AutoSortPlusSaveButtonUpdater();

  // Wire up Gemini counter reset and refresh usage buttons (not fully module-scoped)
  const resetGeminiCounterBtn = document.getElementById('reset-gemini-counter');
  if (resetGeminiCounterBtn) {
    resetGeminiCounterBtn.addEventListener('click', async () => {
      if (confirm(i18n.get('resetCounterConfirm'))) {
        await browser.storage.local.set({
          geminiRateLimit: { requests: [], dailyCount: 0, dailyResetTime: Date.now() + (24 * 60 * 60 * 1000) }
        });
        if (modules.geminiKeys) modules.geminiKeys.render();
        const usageMessage = document.getElementById('usage-message');
        if (usageMessage) { usageMessage.className = 'usage-message info'; usageMessage.textContent = i18n.get('counterResetMsg'); }
      }
    });
  }

  const refreshUsageBtn = document.getElementById('refresh-usage');
  if (refreshUsageBtn) {
    refreshUsageBtn.addEventListener('click', async () => {
      // Trigger a re-render of gemini keys which also refreshes usage display
      if (modules.geminiKeys) modules.geminiKeys.render();
      const usageMessage = document.getElementById('usage-message');
      if (usageMessage) {
        usageMessage.className = 'usage-message info';
        usageMessage.textContent = i18n.get('usageRefreshed');
        setTimeout(() => { if (usageMessage.classList.contains('info')) usageMessage.style.display = 'none'; }, 3000);
      }
    });
  }

  const refreshAllUsageBtn = document.getElementById('refresh-all-usage');
  if (refreshAllUsageBtn) {
    refreshAllUsageBtn.addEventListener('click', async () => {
      if (modules.geminiKeys) modules.geminiKeys.render();
    });
  }

  // Wire up get API key button
  const getApiKeyButton = document.getElementById('get-api-key');
  if (getApiKeyButton) {
    getApiKeyButton.addEventListener('click', async () => {
      const provider = modules.providerUI.getCurrentProvider();
      const config = modules.providerUI.aiProviders[provider];
      if (!config.signupUrl) { showMessage(i18n.get('noSignupUrl'), false); return; }
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
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    for (const mod of Object.values(modules)) mod.destroy?.();
  });
});

/** Show a temporary message toast. Extracted from original options.js. */
function showMessage(message, isSuccess = true) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message';
  messageDiv.textContent = message;
  messageDiv.style.backgroundColor = isSuccess ? 'var(--success-color)' : 'var(--error-color)';
  document.body.appendChild(messageDiv);
  setTimeout(() => { messageDiv.remove(); }, 3000);
}

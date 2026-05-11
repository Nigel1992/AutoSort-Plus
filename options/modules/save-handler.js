class SaveHandler {
  constructor(modules) {
    this.modules = modules;
    this.saveButton = document.getElementById('save-settings');
    this.batchChunkSizeInput = document.getElementById('batch-chunk-size');
    this.autoSortCheckbox = document.getElementById('enable-auto-sort');
    this.debugCheckbox = document.getElementById('enable-debug');
    this.customPromptTextarea = document.getElementById('custom-prompt-text');
    this.geminiPaidCheckbox = document.getElementById('gemini-paid-plan');
    this.ollamaModelSelect = document.getElementById('ollama-model');
    this.ollamaCustomModelInput = document.getElementById('ollama-custom-model');
    this.ollamaUrlInput = document.getElementById('ollama-url');
    this.ollamaAuthTokenInput = document.getElementById('ollama-auth-token');
    this.ollamaCpuOnlyCheckbox = document.getElementById('ollama-cpu-only');
    this.customBaseUrlInput = document.getElementById('custom-base-url');
    this.customModelSelect = document.getElementById('custom-model-select');
    this.customModelCustomInput = document.getElementById('custom-model-custom');
    this.customApiKeyInput = document.getElementById('custom-api-key');
    this.apiKeyInput = document.getElementById('api-key');
    this.aiProviderSelect = document.getElementById('ai-provider');
    this.enableAiCheckbox = document.getElementById('enable-ai');
  }

  bindSaveButton() {
    if (this.saveButton) this.saveButton.addEventListener('click', () => this.save());
  }

  async save() {
    for (const [name, mod] of Object.entries(this.modules)) {
      if (mod.validate) {
        const result = mod.validate();
        if (!result.valid) { showMessage(result.error, false); return; }
      }
    }

    const labels = this.modules.folderManager ? this.modules.folderManager.getConfig().labels : [];
    if (labels.length === 0) { showMessage(i18n.get('addFolderBeforeSave'), false); return; }

    const provider = this.modules.providerUI?.getCurrentProvider() || 'gemini';
    const batchChunkSizeEl = document.getElementById('batch-chunk-size');
    const batchChunkSize = Math.max(1, Math.min(20, parseInt(batchChunkSizeEl?.value) || 5));
    const autoSortEnabled = this.autoSortCheckbox ? this.autoSortCheckbox.checked : false;
    const customPrompt = this.customPromptTextarea ? this.customPromptTextarea.value.trim() : '';
    const debugMode = this.debugCheckbox ? this.debugCheckbox.checked : false;
    const enableAi = this.enableAiCheckbox ? this.enableAiCheckbox.checked : true;

    if (provider === 'gemini') {
      const validGeminiKeys = (this.modules.geminiKeys?.keys || []).filter(k => k && k.trim() !== '');
      if (validGeminiKeys.length === 0) { showMessage(i18n.get('addGeminiKeyBeforeSave'), false); return; }
      const uniqueKeys = new Set(validGeminiKeys.map(k => k.trim().toLowerCase()));
      if (uniqueKeys.size !== validGeminiKeys.length) { showMessage(i18n.get('duplicateApiKeys'), false); return; }

      const settings = {
        labels,
        geminiApiKeys: validGeminiKeys,
        currentGeminiKeyIndex: 0,
        aiProvider: provider,
        enableAi,
        geminiPaidPlan: this.geminiPaidCheckbox?.checked === true,
        debugMode,
        batchChunkSize,
        autoSortEnabled,
        customPrompt
      };

      const rateResult = await browser.storage.local.get(['geminiRateLimits']);
      if (!rateResult.geminiRateLimits || rateResult.geminiRateLimits.length !== validGeminiKeys.length) {
        settings.geminiRateLimits = validGeminiKeys.map(() => ({ requests: [], dailyCount: 0, dailyResetTime: Date.now() + (24 * 60 * 60 * 1000) }));
      }

      await browser.storage.local.set(settings);
      showMessage(i18n.get('settingsSavedMultiKey'), true);
    } else if (provider === 'ollama') {
      let ollamaModel = this.ollamaModelSelect?.value || '';
      if (ollamaModel === 'custom') {
        ollamaModel = this.ollamaCustomModelInput?.value.trim() || '';
        if (!ollamaModel) { showMessage(i18n.get('enterOllamaModel'), false); return; }
      }

      await browser.storage.local.set({
        labels,
        aiProvider: provider,
        enableAi,
        ollamaUrl: this.ollamaUrlInput?.value.trim() || 'http://localhost:11434',
        ollamaModel,
        ollamaCustomModel: this.ollamaCustomModelInput?.value.trim() || '',
        ollamaAuthToken: this.ollamaAuthTokenInput?.value.trim() || '',
        ollamaCpuOnly: this.ollamaCpuOnlyCheckbox?.checked === true,
        debugMode,
        batchChunkSize,
        autoSortEnabled,
        customPrompt
      });
      const cpuMode = this.ollamaCpuOnlyCheckbox?.checked ? ' (' + i18n.get('ollamaCpuOnly') + ')' : '';
      showMessage(i18n.get('settingsSavedOllama', [cpuMode]), true);
    } else if (provider === 'openai-compatible') {
      const baseUrl = this.customBaseUrlInput?.value.trim() || '';
      let model = this.customModelSelect ? this.customModelSelect.value : '';
      const apiKey = this.customApiKeyInput?.value.trim() || '';
      if (model === 'custom' && this.customModelCustomInput) model = this.customModelCustomInput.value.trim();
      if (!baseUrl) { showMessage(i18n.get('enterCustomBaseUrl'), false); return; }
      if (!model) { showMessage(i18n.get('enterCustomModel'), false); return; }

      await browser.storage.local.set({
        labels,
        aiProvider: provider,
        enableAi,
        customBaseUrl: baseUrl.replace(/\/$/, ''),
        customModel: model,
        apiKey,
        debugMode,
        batchChunkSize,
        autoSortEnabled,
        customPrompt
      });
      showMessage(i18n.get('settingsSavedCustomEndpoint'), true);
    } else {
      const apiKey = this.apiKeyInput?.value.trim() || '';
      if (!apiKey) { showMessage(i18n.get('enterApiKeyBeforeSave'), false); return; }

      await browser.storage.local.set({
        labels,
        apiKey,
        aiProvider: provider,
        enableAi,
        debugMode,
        batchChunkSize,
        autoSortEnabled,
        customPrompt
      });
      showMessage(i18n.get('settingsSavedSuccess'), true);
    }

    if (window.AutoSortPlusSaveButtonUpdater) window.AutoSortPlusSaveButtonUpdater();
  }

  async load() {
    try {
      const data = await browser.storage.local.get([
        'aiProvider', 'enableAi', 'batchChunkSize', 'autoSortEnabled',
        'debugMode', 'customPrompt', 'geminiPaidPlan'
      ]);

      if (this.enableAiCheckbox) this.enableAiCheckbox.checked = data.enableAi !== false;
      if (this.batchChunkSizeInput && data.batchChunkSize) this.batchChunkSizeInput.value = data.batchChunkSize;
      if (this.autoSortCheckbox) this.autoSortCheckbox.checked = data.autoSortEnabled === true;
      if (this.debugCheckbox) this.debugCheckbox.checked = data.debugMode === true;
      if (this.customPromptTextarea) this.customPromptTextarea.value = data.customPrompt || '';
      if (this.geminiPaidCheckbox) this.geminiPaidCheckbox.checked = data.geminiPaidPlan === true;

      for (const [name, mod] of Object.entries(this.modules)) {
        if (mod.setConfig) mod.setConfig(data);
      }

      if (data.aiProvider && this.modules.providerUI) {
        const sel = document.getElementById('ai-provider');
        if (sel) sel.value = data.aiProvider;
        this.modules.providerUI.update();
      }
    } catch (e) { console.error('Failed to load settings:', e); }
  }

  destroy() {}
}

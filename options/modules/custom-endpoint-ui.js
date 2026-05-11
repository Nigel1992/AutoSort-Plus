class CustomEndpointUI {
  constructor() {
    this._bindButtons();
  }

  _bindButtons() {
    const fetchBtn = document.getElementById('fetch-custom-models');
    if (fetchBtn) fetchBtn.addEventListener('click', () => this.fetchModels());

    const urlInput = document.getElementById('custom-base-url');
    if (urlInput) urlInput.addEventListener('input', () => { if (window.AutoSortPlusSaveButtonUpdater) window.AutoSortPlusSaveButtonUpdater(); });
  }

  async fetchModels() {
    const baseUrl = (document.getElementById('custom-base-url')?.value.trim() || '').replace(/\/$/, '');
    const apiKey = document.getElementById('custom-api-key')?.value.trim();
    const select = document.getElementById('custom-model-select');
    if (!baseUrl) { showMessage(i18n.get('enterBaseUrlFirst'), false); return; }
    try {
      showMessage(i18n.get('fetchingModels'), true);
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const response = await fetch(baseUrl + '/models', { headers });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const models = data.data || data.models || [];
      if (models.length === 0) { showMessage(i18n.get('noModelsEndpoint'), false); return; }

      if (select) {
        select.innerHTML = `<option value="">-- ${i18n.get('openaiCompatibleModelSelect')} --</option>`;
        models.forEach(m => { const modelId = m.id || m.name || m; const opt = document.createElement('option'); opt.value = modelId; opt.textContent = modelId; select.appendChild(opt); });
        const customOpt = document.createElement('option'); customOpt.value = 'custom'; customOpt.textContent = i18n.get('openaiCompatibleModelCustom'); select.appendChild(customOpt);
      }
      showMessage(i18n.get('foundModelsMsg', [models.length]), true);
    } catch (e) { showMessage(i18n.get('failedFetchModels', [e.message]), false); }
  }

  destroy() {}
}

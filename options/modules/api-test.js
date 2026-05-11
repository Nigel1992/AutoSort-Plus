class APITester {
  constructor(providerUI) {
    this.providerUI = providerUI;
    this._bindTestButtons();
  }

  _bindTestButtons() {
    const testBtn = document.getElementById('test-api');
    if (testBtn) testBtn.addEventListener('click', () => this.testProvider());

    const ollamaBtn = document.getElementById('test-ollama');
    if (ollamaBtn) ollamaBtn.addEventListener('click', () => this.testOllama());

    const customBtn = document.getElementById('test-custom-endpoint');
    if (customBtn) customBtn.addEventListener('click', () => this.testCustomEndpoint());
  }

  async testProvider() {
    const apiKey = document.getElementById('api-key').value.trim();
    const provider = this.providerUI.getCurrentProvider();

    if (provider === 'ollama') { showMessage(i18n.get('useOllamaTestButton'), false); return; }
    if (provider === 'openai-compatible') { showMessage(i18n.get('useCustomTestButton'), false); return; }
    if (!apiKey) { showMessage(i18n.get('enterApiKey'), false); return; }

    const resultEl = document.getElementById('api-test-result');
    if (resultEl) { resultEl.textContent = i18n.get('testingConnection'); resultEl.className = 'api-test-result'; }

    try {
      let response;
      const headers = { 'Content-Type': 'application/json' };
      const body = { messages: [{ role: 'user', content: 'Test' }], max_tokens: 10 };

      if (provider === 'gemini') {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, { method: 'POST', headers, body: JSON.stringify({ contents: [{ parts: [{ text: 'Test' }] }], generationConfig: { maxOutputTokens: 10 } }) });
      } else if (provider === 'openai') {
        headers['Authorization'] = `Bearer ${apiKey}`;
        body.model = 'gpt-4o-mini';
        response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers, body: JSON.stringify(body) });
      } else if (provider === 'anthropic') {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        body.model = 'claude-3-haiku-20240307';
        response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) });
      } else if (provider === 'groq') {
        headers['Authorization'] = `Bearer ${apiKey}`;
        body.model = 'llama-3.3-70b-versatile';
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers, body: JSON.stringify(body) });
      } else if (provider === 'mistral') {
        headers['Authorization'] = `Bearer ${apiKey}`;
        body.model = 'mistral-small-latest';
        response = await fetch('https://api.mistral.ai/v1/chat/completions', { method: 'POST', headers, body: JSON.stringify(body) });
      }

      if (response.ok) showMessage(i18n.get('apiConnectionSuccess'), true);
      else { const err = await response.json(); showMessage(i18n.get('apiError', [err.error?.message || 'Unknown']), false); }
    } catch (e) { showMessage(i18n.get('connectionError', [e.message]), false); }
  }

  async testOllama() {
    const url = (document.getElementById('ollama-url').value.trim()) || 'http://localhost:11434';
    const result = document.getElementById('ollama-test-result');
    if (!result) return;
    result.textContent = i18n.get('testingConnectionModels');
    result.className = 'api-test-result';
    try {
      const res = await fetch(`${url}/api/tags`);
      if (res.ok) { const data = await res.json(); showMessage(i18n.get('availableModels', [data.models?.map(m => m.name).join(', ') || 'none']), true); }
      else showMessage(i18n.get('ollamaConnectionFailed', [res.status]), false);
    } catch (e) { showMessage(i18n.get('ollamaConnectionFailed', [e.message]), false); }
  }

  async testCustomEndpoint() {
    const baseUrl = (document.getElementById('custom-base-url')?.value.trim() || '').replace(/\/$/, '');
    const modelSelect = document.getElementById('custom-model-select');
    let model = modelSelect ? modelSelect.value : '';
    if (model === 'custom') model = document.getElementById('custom-model-custom')?.value.trim() || '';
    const apiKey = document.getElementById('custom-api-key')?.value.trim();
    if (!baseUrl) { showMessage(i18n.get('enterBaseUrl'), false); return; }
    if (!model) { showMessage(i18n.get('enterModelName'), false); return; }

    const resultEl = document.getElementById('custom-test-result');
    if (resultEl) { resultEl.textContent = i18n.get('testingConnection'); resultEl.className = 'api-test-result'; }

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      const res = await fetch(`${baseUrl}/v1/chat/completions`, { method: 'POST', headers, body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Test' }], max_tokens: 10 }) });
      if (res.ok) showMessage(i18n.get('connectedSuccessfully', [model, baseUrl]), true);
      else { const err = await res.json(); showMessage(i18n.get('apiError', [err.error?.message || `HTTP ${res.status}`]), false); }
    } catch (e) { showMessage(i18n.get('connectionError', [e.message]), false); }
  }

  destroy() {}
}

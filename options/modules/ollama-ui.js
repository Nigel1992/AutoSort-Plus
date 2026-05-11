class OllamaUI {
  constructor() {
    this._bindButtons();
  }

  _bindButtons() {
    const listBtn = document.getElementById('list-ollama-models');
    if (listBtn) listBtn.addEventListener('click', () => this.listModels());

    const diagBtn = document.getElementById('diagnose-ollama');
    if (diagBtn) diagBtn.addEventListener('click', () => this.diagnostics());

    const downloadBtn = document.getElementById('download-ollama-model');
    if (downloadBtn) downloadBtn.addEventListener('click', () => this.downloadModel());
  }

  async listModels() {
    const url = (document.getElementById('ollama-url').value.trim()) || 'http://localhost:11434';
    const result = document.getElementById('ollama-test-result');
    if (!result) return;
    result.textContent = i18n.get('fetchingModelsStatus'); result.className = 'api-test-result';
    try {
      const res = await fetch(`${url}/api/tags`);
      if (res.ok) { const data = await res.json(); showMessage(i18n.get('availableModels', [data.models?.map(m => m.name).join(', ') || 'none']), true); }
      else showMessage(i18n.get('failedFetchModelsSimple'), false);
    } catch (e) { showMessage(i18n.get('ollamaConnectionFailedSimple', [e.message]), false); }
  }

  async diagnostics() {
    const url = (document.getElementById('ollama-url').value.trim()) || 'http://localhost:11434';
    const output = document.getElementById('ollama-diagnostics');
    if (!output) return;
    output.style.display = 'block';
    let text = i18n.get('diagnosticsTitle') + '\n' + '='.repeat(50) + '\n\n';
    output.textContent = text;

    text += i18n.get('testListModels') + '\n   URL: ' + url + '/api/tags\n';
    try {
      const res = await fetch(`${url}/api/tags`);
      text += `   Status: ${res.status} ${res.statusText}\n`;
      if (res.ok) { const data = await res.json(); text += `   ✓ Found ${data.models?.length || 0} models\n`; }
      else text += '   ✗ FAILED\n';
    } catch (e) { text += `   ✗ ERROR: ${e.message}\n`; }

    text += '\n' + i18n.get('testVersion') + '\n   URL: ' + url + '/api/version\n';
    try {
      const res = await fetch(`${url}/api/version`);
      text += `   Status: ${res.status} ${res.statusText}\n`;
      if (res.ok) { const data = await res.json(); text += `   ✓ Ollama version: ${data.version || i18n.get('unknownVersion')}\n`; }
      else text += '   ⚠️ Not available\n';
    } catch (e) { text += `   ✗ ERROR: ${e.message}\n`; }

    text += '\n' + '='.repeat(50) + '\n';
    output.textContent = text;
    output.className = 'diagnostics-result success';
  }

  async downloadModel() {
    const url = (document.getElementById('ollama-url').value.trim() || 'http://localhost:11434').replace(/\/$/, '');
    const model = document.getElementById('ollama-download-model')?.value.trim();
    const status = document.getElementById('ollama-download-status');
    if (!model) { if (status) { status.textContent = i18n.get('enterModelDownload'); status.className = 'api-test-result error'; status.style.display = 'block'; } return; }
    try {
      const btn = document.getElementById('download-ollama-model');
      if (btn) btn.disabled = true;
      if (status) { status.textContent = i18n.get('startingDownload', [model]); status.className = 'api-test-result'; status.style.display = 'block'; }

      await browser.runtime.sendMessage({ action: 'startOllamaPull', ollamaUrl: url, model, headers: {} });

      const listener = (msg) => {
        if (msg.action === 'ollamaPullProgress') {
          const parts = [];
          if (msg.status) parts.push(msg.status);
          if (typeof msg.percent === 'number') parts.push(`${msg.percent}%`);
          if (status) status.textContent = parts.join(' — ');
        } else if (msg.action === 'ollamaPullComplete') {
          browser.runtime.onMessage.removeListener(listener);
          if (status) {
            status.textContent = msg.ok ? i18n.get('downloadComplete') : i18n.get('downloadFailed', [msg.error || '']);
            status.className = `api-test-result ${msg.ok ? 'success' : 'error'}`;
            status.style.display = 'block';
          }
          if (btn) btn.disabled = false;
        }
      };
      browser.runtime.onMessage.addListener(listener);
    } catch (e) { if (status) { status.textContent = i18n.get('failedStart', [e.message]); status.className = 'api-test-result error'; } }
  }

  destroy() {}
}

class GeminiKeyManager {
  constructor() {
    this.keys = [];
    this.container = document.getElementById('gemini-keys-list');
    this.addButton = document.getElementById('add-gemini-key');
    if (this.addButton) this.addButton.addEventListener('click', () => this.addKey());
    this._restoreFromStorage();
  }

  async _restoreFromStorage() {
    try {
      const data = await browser.storage.local.get(['geminiApiKeys', 'apiKey']);
      if (data.geminiApiKeys && data.geminiApiKeys.length > 0) {
        this.keys = data.geminiApiKeys;
      } else if (data.apiKey) {
        this.keys = [data.apiKey];
      }
      this.render();
    } catch (e) { this.render(); }
  }

  addKey(value = '') {
    this.keys.push(value);
    this.render();
  }

  removeKey(index) {
    if (this.keys.length <= 1) { showMessage(i18n.get('mustHaveOneKey'), false); return; }
    if (confirm(i18n.get('removeApiKeyConfirm', [index + 1]))) {
      this.keys.splice(index, 1);
      this.render();
    }
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';
    this.keys.forEach((key, index) => {
      const item = document.createElement('div');
      item.className = 'gemini-key-item';
      const idxSpan = document.createElement('span'); idxSpan.className = 'key-index'; idxSpan.textContent = `#${index + 1}`;
      const input = document.createElement('input'); input.type = 'password'; input.className = 'gemini-api-key-input'; input.value = key; input.placeholder = i18n.get('geminiKeyInputPlaceholder');
      input.addEventListener('input', (e) => { this.keys[index] = e.target.value.trim(); if (window.AutoSortPlusSaveButtonUpdater) window.AutoSortPlusSaveButtonUpdater(); });
      const testBtn = document.createElement('button'); testBtn.className = 'button'; testBtn.textContent = i18n.get('testButton');
      testBtn.addEventListener('click', () => this.testKey(key, index, item));
      const removeBtn = document.createElement('button'); removeBtn.className = 'button'; removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => this.removeKey(index));
      const status = document.createElement('span'); status.className = 'key-test-result'; status.dataset.index = index;
      item.append(idxSpan, input, testBtn, removeBtn, status);
      this.container.appendChild(item);
    });
  }

  async testKey(apiKey, index, itemEl) {
    const statusSpan = itemEl.querySelector('.key-test-result');
    if (!apiKey) { statusSpan.textContent = i18n.get('enterKeyFirst'); statusSpan.className = 'key-test-result error'; return; }
    try {
      statusSpan.textContent = i18n.get('testingStatus'); statusSpan.className = 'key-test-result testing';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Test' }] }], generationConfig: { maxOutputTokens: 10 } })
      });
      if (response.ok) { statusSpan.textContent = i18n.get('validKey'); statusSpan.className = 'key-test-result success'; }
      else if (response.status === 429) { statusSpan.textContent = i18n.get('limitReachedGemini'); statusSpan.className = 'key-test-result error'; }
      else { statusSpan.textContent = i18n.get('testFailed', [response.status]); statusSpan.className = 'key-test-result error'; }
    } catch (e) { statusSpan.textContent = i18n.get('errorStatus'); statusSpan.className = 'key-test-result error'; }
  }

  getConfig() { return { geminiApiKeys: this.keys.filter(k => k.trim()) }; }
  setConfig(config) { if (config.geminiApiKeys) { this.keys = [...config.geminiApiKeys]; this.render(); } }
  validate() { const valid = this.keys.filter(k => k.trim()).length > 0; return { valid, error: valid ? '' : 'At least one Gemini API key required' }; }
  destroy() {}
}

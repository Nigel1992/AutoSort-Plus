class ProviderUI {
  constructor() {
    this.providerSelect = document.getElementById('ai-provider');
    this.providerInfo = document.getElementById('provider-info');
    this.aiProviders = {
      gemini: { name: i18n.get('providerGemini'), signupUrl: 'https://aistudio.google.com/app/apikey', info: i18n.get('providerInfoGemini'), isFree: true },
      openai: { name: i18n.get('providerOpenAI'), signupUrl: 'https://platform.openai.com/signup', info: i18n.get('providerInfoOpenai'), isFree: false },
      anthropic: { name: i18n.get('providerAnthropic'), signupUrl: 'https://console.anthropic.com/', info: i18n.get('providerInfoAnthropic'), isFree: true },
      groq: { name: i18n.get('providerGroq'), signupUrl: 'https://console.groq.com/', info: i18n.get('providerInfoGroq'), isFree: true },
      mistral: { name: i18n.get('providerMistral'), signupUrl: 'https://console.mistral.ai/', info: i18n.get('providerInfoMistral'), isFree: true },
      ollama: { name: i18n.get('providerOllama'), signupUrl: 'https://ollama.ai/', info: i18n.get('providerInfoOllama'), isFree: true },
      'openai-compatible': { name: i18n.get('providerOpenAICompatible'), signupUrl: '', info: i18n.get('providerInfoOpenaiCompatible'), isFree: true }
    };
    this._setupPanels();
    this._bindEvents();
  }

  _setupPanels() {
    this.panels = {
      ollama: document.getElementById('ollama-settings-subsection'),
      apiKey: document.getElementById('api-key-subsection'),
      geminiMultiKeys: document.getElementById('gemini-multi-keys-subsection'),
      geminiUsage: document.getElementById('gemini-usage-subsection'),
      geminiPaid: document.getElementById('gemini-paid-container'),
      openaiCompat: document.getElementById('openai-compatible-settings-subsection')
    };
  }

  _bindEvents() {
    if (this.providerSelect) this.providerSelect.addEventListener('change', () => this.update());
  }

  update() {
    const provider = this.providerSelect.value;
    const config = this.aiProviders[provider];
    const p = this.panels;

    if (p.ollama) p.ollama.style.display = provider === 'ollama' ? 'block' : 'none';
    if (p.apiKey) p.apiKey.style.display = (provider !== 'gemini' && provider !== 'ollama' && provider !== 'openai-compatible') ? 'block' : 'none';
    if (p.geminiMultiKeys) p.geminiMultiKeys.style.display = provider === 'gemini' ? 'block' : 'none';
    if (p.geminiUsage) p.geminiUsage.style.display = provider === 'gemini' ? 'block' : 'none';
    if (p.geminiPaid) p.geminiPaid.style.display = provider === 'gemini' ? 'block' : 'none';
    if (p.openaiCompat) p.openaiCompat.style.display = provider === 'openai-compatible' ? 'block' : 'none';

    if (this.providerInfo) {
      this.providerInfo.innerHTML = `<div class="provider-details"><strong>${config.name}</strong> ${config.isFree ? '<span class="free-badge">' + i18n.get('freeBadge') + '</span>' : '<span class="paid-badge">' + i18n.get('paidBadge') + '</span>'}<p>${config.info}</p></div>`;
    }

    if (window.AutoSortPlusSaveButtonUpdater) window.AutoSortPlusSaveButtonUpdater();
  }

  getCurrentProvider() { return this.providerSelect.value; }
  destroy() {}
}

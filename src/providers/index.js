(function() {
  if (!window.AutoSortPlus || !window.AutoSortPlus.providers) return;

  window.AutoSortPlus.providers.getProvider = function(name) {
    const p = window.AutoSortPlus.providers;
    switch (name) {
      case p.PROVIDERS.GEMINI: return p.geminiProvider;
      case p.PROVIDERS.OPENAI: return p.openaiProvider;
      case p.PROVIDERS.ANTHROPIC: return p.anthropicProvider;
      case p.PROVIDERS.GROQ: return p.groqProvider;
      case p.PROVIDERS.MISTRAL: return p.mistralProvider;
      case p.PROVIDERS.OLLAMA: return p.ollamaProvider;
      case p.PROVIDERS.OPENAI_COMPATIBLE: return p.openaiCompatProvider;
      default: throw new Error(`Unknown provider: ${name}`);
    }
  };
})();

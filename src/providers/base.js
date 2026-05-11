if (!window.AutoSortPlus) window.AutoSortPlus = {};

window.AutoSortPlus.providers = {
  PROVIDERS: {
    GEMINI: 'gemini',
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
    GROQ: 'groq',
    MISTRAL: 'mistral',
    OLLAMA: 'ollama',
    OPENAI_COMPATIBLE: 'openai-compatible'
  },

  PROVIDER_BATCH_CONFIG: {
    gemini:              { concurrency: 1, delayMs: 0 },
    openai:              { concurrency: 3, delayMs: 500 },
    anthropic:           { concurrency: 2, delayMs: 500 },
    groq:                { concurrency: 5, delayMs: 200 },
    mistral:             { concurrency: 2, delayMs: 500 },
    ollama:              { concurrency: 1, delayMs: 0 },
    'openai-compatible': { concurrency: 2, delayMs: 500 }
  }
};

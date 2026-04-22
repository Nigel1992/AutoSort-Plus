/**
 * Provider Registry - Centralized configuration for all AI providers
 */

const PROVIDERS = {
    GEMINI: 'gemini',
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
    GROQ: 'groq',
    MISTRAL: 'mistral',
    OLLAMA: 'ollama',
    OPENAI_COMPATIBLE: 'openai-compatible'
};

const PROVIDER_CONFIG = {
    [PROVIDERS.GEMINI]: {
        name: 'Google Gemini',
        signupUrl: 'https://aistudio.google.com/app/apikey',
        isFree: true,
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        requiresAuth: 'query',
        batchConfig: { concurrency: 1, delayMs: 0 }
    },

    [PROVIDERS.OPENAI]: {
        name: 'OpenAI (ChatGPT)',
        signupUrl: 'https://platform.openai.com/api-keys',
        isFree: false,
        endpoint: 'https://api.openai.com/v1/chat/completions',
        requiresAuth: 'header',
        batchConfig: { concurrency: 3, delayMs: 500 }
    },

    [PROVIDERS.ANTHROPIC]: {
        name: 'Anthropic Claude',
        signupUrl: 'https://console.anthropic.com/',
        isFree: false,
        endpoint: 'https://api.anthropic.com/v1/messages',
        requiresAuth: 'header',
        batchConfig: { concurrency: 2, delayMs: 500 }
    },

    [PROVIDERS.GROQ]: {
        name: 'Groq (Fast & Free)',
        signupUrl: 'https://console.groq.com/keys',
        isFree: true,
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        requiresAuth: 'header',
        batchConfig: { concurrency: 5, delayMs: 200 }
    },

    [PROVIDERS.MISTRAL]: {
        name: 'Mistral AI',
        signupUrl: 'https://console.mistral.ai/',
        isFree: false,
        endpoint: 'https://api.mistral.ai/v1/chat/completions',
        requiresAuth: 'header',
        batchConfig: { concurrency: 2, delayMs: 500 }
    },

    [PROVIDERS.OLLAMA]: {
        name: 'Ollama (Local)',
        signupUrl: null,
        isFree: true,
        endpoint: null,
        requiresAuth: 'optional',
        batchConfig: { concurrency: 1, delayMs: 0 },
        isLocal: true
    },

    [PROVIDERS.OPENAI_COMPATIBLE]: {
        name: 'OpenAI-Compatible',
        signupUrl: null,
        isFree: true,
        endpoint: null,
        requiresAuth: 'optional',
        batchConfig: { concurrency: 2, delayMs: 500 },
        isLocal: true
    }
};

function getProviderBatchConfig(provider) {
    return PROVIDER_CONFIG[provider]?.batchConfig || { concurrency: 1, delayMs: 0 };
}

function isValidProvider(provider) {
    return Object.values(PROVIDERS).includes(provider);
}

function getProviderInfo(provider) {
    return PROVIDER_CONFIG[provider] || null;
}

// Export for use in other contexts
if (typeof window !== 'undefined') {
    window.providersConfig = {
        PROVIDERS,
        PROVIDER_CONFIG,
        getProviderBatchConfig,
        isValidProvider,
        getProviderInfo
    };
}
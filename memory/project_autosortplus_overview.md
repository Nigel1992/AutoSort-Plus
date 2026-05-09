---
name: AutoSort+ project overview
description: Complete architecture and feature overview of the AutoSort+ Thunderbird extension
type: project
---

AutoSort+ is a Thunderbird WebExtension (Manifest V2, min v78.0) for AI-powered email sorting. Version 1.2.3.3.

## Core files
- `manifest.json` - MV2 extension config, permissions (messagesRead/Modify/Move, accountsRead, storage, menus, tabs, activeTab), host permissions for Google API + localhost
- `background.js` - Main engine: email analysis, batch processing, Gemini rate limiting, auto-sort listener, context menu, folder operations (~2000 lines)
- `options.js` - Settings UI: provider config, API key management, Gemini multi-key, Ollama/OpenAI-compatible settings, batch progress panel, folder import, move history (~1800 lines)
- `options.html` - Settings page with collapsible sections
- `content.js` - Content script for localhost tab injection (Ollama CORS workaround, ~144 lines)
- `styles.css` - UI styling with batch processing animations

## JS modules
- `js/i18n.js` - Lightweight i18n helper using browser.i18n.getMessage()
- `js/logger.js` - DebugLogger class with cross-context sync via storage
- `js/ollama.js` - Ollama API client class
- `js/providers-config.js` - Centralized provider registry with batch configs
- `js/tab-fetch-utils.js` - Tab injection fetch utility for localhost endpoints
- `js/workers/ollama-worker.js` - Web Worker for Ollama streaming

## AI providers (7 total)
1. **Gemini** - gemini-2.5-flash, free 20/day per key, multi-key rotation
2. **OpenAI** - gpt-4o-mini, paid
3. **Anthropic** - claude-3-haiku-20240307
4. **Groq** - llama-3.3-70b-versatile, free 30/min
5. **Mistral** - mistral-small-latest
6. **Ollama** - local, any model, tab-injection for CORS
7. **OpenAI-Compatible** - custom endpoint, tab-injection for localhost

## Key architecture patterns
- **Tab injection**: Thunderbird background scripts can't fetch localhost directly. Workaround: open hidden tab, inject JS via executeScript, poll window for result, close tab
- **Batch engine**: Chunk-based processing with per-provider concurrency limits, pause/resume/cancel via shared _batchState
- **Gemini rate limiting**: Mutex-chained storage operations, per-key tracking, 12s min interval, 20/day limit, auto-rotation across keys
- **Auto-sort**: Listens to browser.messages.onNewMailReceived, processes Inbox with concurrency-limited parallel processor, handles pagination via continueList
- **Folder caching**: Builds Map keyed by "accountId:folderName" to avoid N+1 recursive searches

## Storage keys
apiKey, aiProvider, labels, enableAi, geminiPaidPlan, geminiApiKeys, currentGeminiKeyIndex, geminiRateLimits, geminiRateLimit (legacy), debugMode, batchChunkSize, autoSortEnabled, customPrompt, ollamaUrl, ollamaModel, ollamaCustomModel, ollamaAuthToken, ollamaCpuOnly, ollamaNumCtx, customBaseUrl, customModel, moveHistory, currentBatch

## i18n
Full coverage in English (en) and Simplified Chinese (zh_CN). Uses data-i18n attributes on HTML elements.

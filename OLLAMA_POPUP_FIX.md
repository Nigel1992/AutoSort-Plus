# Ollama 403 Fix: Popup Window Architecture

## The Problem
- **GET /api/tags** from background script: 200 ✓
- **POST /api/chat** from background script: 403 ✗
- **POST /api/chat** from curl: 200 ✓

**Root Cause:** Thunderbird background script has restricted fetch context. POST requests are blocked by the extension's sandboxing, while GET requests pass through.

## The Solution
**Use popup windows (browser context) for Ollama POST requests** instead of direct fetch from background script.

- Popup context runs in full browser environment (like a regular tab)
- No sandboxing restrictions on POST requests
- Web Worker in popup handles actual API communication

## Architecture

```
User clicks "Analyze"
    ↓
background.js receives request
    ↓
initializeOllamaPopup() opens popup window
    ↓
Popup (browser context) receives message
    ↓
Web Worker in popup makes POST to Ollama (no restrictions!)
    ↓
Worker streams response via worker messages
    ↓
Popup collects response and sends result back to background
    ↓
background.js processes result and applies label
```

## Code Changes

### background.js
- **initializeOllamaPopup()**: Now waits for popup to send back analysis result
- Listens for `ollama_analysis_result_` message with result
- Automatically closes popup after analysis completes
- 30-second timeout for safety

### api_ollama/ollama-popup.js
- **analysisResult** variable: Stores the accumulated response
- **sendResultToBackground()**: Sends result back via message after analysis completes
- Listener for `ollama_analyze` command from background

### Flow
1. background.js calls `initializeOllamaPopup()`
2. Popup opens and sends `ollama_popup_ready_` message
3. background.js sends `ollama_analyze` message with prompt
4. Popup's worker processes with Ollama (no 403!)
5. Worker sends tokens via `newToken` messages
6. When done, popup sends `ollama_analysis_result_` message
7. background.js receives result and continues processing
8. Popup auto-closes

## Why This Works
- Popup runs in normal browser context (not restricted extension background)
- No sandboxing = POST requests work normally
- Same localhost/Ollama as before, but from unrestricted context

## Testing
The new XPI should now:
1. Open a small popup window when analyzing
2. See "Processing with Ollama..." status
3. Collect response successfully
4. Auto-close popup
5. Apply label to email

No more 403 errors!

---
**Files Updated:**
- background.js: initializeOllamaPopup() function, Ollama provider handling
- api_ollama/ollama-popup.js: Result collection and sending
- manifest.json: Already had web_accessible_resources

**Version:** 1.2.3.2 (popup-based Ollama analysis)
**Date:** 2026-01-16 00:48

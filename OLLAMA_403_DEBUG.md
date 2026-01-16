# Ollama 403 Error Fix - Investigation & Updates

## Status
**Issue Identified:** POST requests to Ollama from Thunderbird extension background context return HTTP 403, while GET requests (test connection) work fine.

## Changes Made

### 1. Enhanced Error Handling (background.js)
- Fixed JSON.parse error when response body is empty
- Now gracefully handles non-JSON error responses
- Specific 403 auth error message for better debugging
- Attempts to parse error response body safely regardless of content-type

### 2. Updated Ollama Class (js/ollama.js)
- Added `authToken` parameter to constructor
- Created `getHeaders()` method that includes Authorization header if token is provided
- Both `fetchModels()` and `fetchResponse()` now use the auth-aware headers

### 3. Worker & Popup Updates
- **js/workers/ollama-worker.js**: Now accepts and passes `ollama_auth_token` to Ollama class
- **api_ollama/ollama-popup.js**: Updated to receive auth token from background message

## Root Cause Analysis

### Why Test Works But Analysis Fails
- **Test Connection**: Uses GET `/api/tags` → Returns 200 ✓
- **Analysis**: Uses POST `/api/chat` → Returns 403 ✗

### Possible Causes (in priority order)
1. **Ollama server configured with access restrictions** - Some Ollama deployments have security policies that allow reads but restrict writes
2. **Different network context** - Background.js may have different network permissions than popup
3. **Missing or incorrect auth token** - POST requests might require explicit authentication
4. **CORS/Security Headers** - Extension context might trigger server-side security policies
5. **OPTIONS preflight handling** - Browser might be sending OPTIONS request before POST

## Next Steps to Debug

### Option A: Test with curl (already done - works!)
```bash
curl -X POST http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"tinyllama","messages":[{"role":"user","content":"test"}],"stream":false}'
# Result: 200 OK, proper response ✓
```

### Option B: Check if Auth Token is Set
Go to **AutoSort+ Settings** → **Ollama** → Check if "Auth Token" field has a value
- If empty: Try adding a test token or clearing it completely
- Look at browser console for: "Using Ollama at http://localhost:11434..."

### Option C: Check Ollama Logs
```bash
# If Ollama running in terminal, check for 403/auth errors
# Or if using container: docker logs <container-id>
```

### Option D: Test Direct Fetch from Extension
Try adding this to background.js console temporarily:
```javascript
const res = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        model: 'tinyllama',
        messages: [{role:'user', content:'test'}],
        stream: false
    })
});
console.log('Direct fetch status:', res.status);
const data = await res.json();
console.log('Response:', data);
```

## Files Changed
1. background.js - Better error handling, removed broken tab proxy
2. js/ollama.js - Added auth token support
3. js/workers/ollama-worker.js - Passes auth token to class
4. api_ollama/ollama-popup.js - Receives auth token from message
5. manifest.json - Added web_accessible_resources

## Architecture Now
```
Email Analysis Request
    ↓
background.js analyzeEmailContent()
    ↓  
Direct fetch() to http://localhost:11434/api/chat
    ↓ (includes Authorization header if token is set)
Ollama Server (local)
    ↓
Response with label
```

## Key Code Changes

### Error Handling (lines 697-735 in background.js)
Now tries multiple approaches to parse error:
1. Check if response is JSON (by content-type header)
2. Fall back to text() for error pages
3. Gracefully handle parse errors
4. Specific message for 403: "Ollama authentication failed (403). Check your API key/token if Ollama requires authentication."

### Auth Token in Ollama Class
```javascript
constructor({host='', model='', stream=false, num_ctx=0, authToken=''}) {
    this.authToken = authToken || '';
}

getHeaders = () => {
    const headers = {"Content-Type": "application/json"};
    if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
}
```

## Recommended Testing Flow
1. Ensure Ollama server is running: `curl http://localhost:11434/api/tags`
2. Check Settings → Ollama → "Test Connection" (should work)
3. Try analyzing an email and check console for detailed error
4. Check if Auth Token needs to be set/cleared
5. Review Ollama server logs for 403 details

## Files Verified in XPI
- ✓ manifest.json - Updated with web_accessible_resources
- ✓ background.js - Error handling + fetch calls
- ✓ js/ollama.js - Auth token support
- ✓ js/workers/ollama-worker.js - Auth token forwarding
- ✓ api_ollama/index.html - Popup UI
- ✓ api_ollama/ollama-popup.js - Popup handler with auth

---
Last Updated: 2026-01-16 00:44
XPI: autosortplus.xpi (58K)

---
name: 🐛 Bug Report - Ollama Integration
about: Report a bug with AutoSort+ Ollama integration or general issues
title: '[BUG] '
labels: 'bug'
assignees: ''

---

## 🐛 Bug Description
A clear and concise description of what the bug is.

## 📋 Steps to Reproduce
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '...'
3. Select email with '...'
4. See error

## ❌ Expected Behavior
What you expected to happen.

## 👀 Actual Behavior
What actually happened instead.

## 📸 Console Output
**Browser Console Log (Ctrl+Shift+J in Thunderbird):**
```
[Paste console output here - look for [Ollama] messages]
```

---

## 🔧 Environment Details

### Thunderbird
- **Version:** (e.g., 115.0, 128.0)
- **OS:** (Windows / macOS / Linux)
- **OS Version:** (e.g., Ubuntu 22.04, Windows 11, macOS 14)

### Ollama Setup
- **Ollama Version:** (run: `ollama --version`)
- **Model Used:** (e.g., tinyllama, gemma, phi, llama3.2)
- **Running on:** CPU / GPU (which GPU model?)
- **Memory Available:** (e.g., 8GB, 16GB)

### AutoSort+
- **Extension Version:** (e.g., 1.2.3.1-ollama-test)
- **Install Method:** XPI / Built from source

---

## ✅ Debugging Checklist

- [ ] **Ollama is running:** `curl http://localhost:11434/api/tags` returns models
- [ ] **Model installed:** `ollama list` shows your model
- [ ] **Test connection passes:** Settings → Test Connection works
- [ ] **Thunderbird restarted** after AutoSort+ install
- [ ] **Console logs checked** (Ctrl+Shift+J shows [Ollama] messages)
- [ ] **Email is plaintext** (not HTML-only)
- [ ] **Model responds locally:** `ollama run tinyllama "test"`

---

## 🔍 Manual Testing Steps

**1. Verify Ollama API works:**
```bash
curl http://localhost:11434/api/tags
```
Should list your installed models.

**2. Test direct API call:**
```bash
curl -X POST http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "tinyllama",
    "messages": [{"role": "user", "content": "What is email classification?"}],
    "stream": false
  }'
```
Should return a response from the model.

**3. Check model performance:**
```bash
ollama run tinyllama "Classify this email: [subject line here]"
```

**4. Enable verbose logging:**
- Ctrl+Shift+J in Thunderbird
- Analyze an email
- Copy all `[Ollama]` log entries

---

## 📝 Error Message (if applicable)
```
[Paste the full error message here]
```

## 🎯 Additional Context
- What were you trying to do?
- Does it happen consistently or randomly?
- Have you tried other models?
- Any recent Thunderbird or Ollama updates?

---

## 📌 For Developers
**How to investigate tab injection issues:**
- Check if hidden tab at `http://localhost:11434` opens and closes
- Verify `window.__ollama_result` is populated
- Check network tab for POST to `/api/chat`
- Inspect returned JSON structure from Ollama API

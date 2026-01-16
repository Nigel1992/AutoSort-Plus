# AutoSort+ v1.2.3.1-ollama-test - Ollama Support (Test Release)

## 🧪 Test Release - Ollama Local AI Integration

This is a **test release** with experimental Ollama support for local AI email classification. Please report any issues!

## ✨ What's New

**Local Ollama Support:**
- 🏠 Run AI email classification completely locally with Ollama
- 🔒 No data sent to external APIs
- 🆓 No API keys or rate limits
- 🎯 Support for any Ollama model (tinyllama, llama3.2, phi, gemma, etc.)
- ⚙️ CPU-only mode option for systems without GPU

## 🚀 Quick Start with Ollama

### Prerequisites
1. Install Ollama: https://ollama.com/download
2. Pull a model: `ollama pull tinyllama` (or llama3.2, phi, gemma, etc.)
3. Verify it's running: `ollama list`

### Setup in Extension
1. Open AutoSort+ settings
2. Select **Ollama** as AI provider
3. Leave URL as `http://localhost:11434` (default)
4. Select your model from dropdown
5. Click **Test Connection** - should show your installed models
6. Click **Save Settings**

### Test It
1. Select an email
2. Right-click → **Analyze with AI**
3. Watch as Ollama classifies it locally!

## 🐛 Known Issues & Debugging

### If you get errors:
1. **Check Ollama is running:**
   ```bash
   curl http://localhost:11434/api/tags
   ```
   Should return list of models

2. **Test chat directly:**
   ```bash
   curl -X POST http://localhost:11434/api/chat \
     -H "Content-Type: application/json" \
     -d '{"model":"tinyllama","messages":[{"role":"user","content":"test"}],"stream":false}'
   ```
   Should return a response

3. **Enable debug logging:**
   - Open Browser Console (Ctrl+Shift+J)
   - Watch for `[Ollama]` messages during analysis
   - Look for any error messages

4. **Common issues:**
   - 403 errors: Fixed in this release with tab injection approach
   - Timeout: Increase wait time or use faster model
   - Model not found: Run `ollama pull <model-name>`

### Report Issues
Please include:
- Thunderbird version
- Ollama version (`ollama --version`)
- Model used
- Console logs showing the error

## 📝 Technical Details

This release uses a **tab injection approach** to bypass Thunderbird's fetch restrictions:
1. Opens hidden tab at Ollama origin
2. Injects script to make POST request
3. Retrieves result and closes tab
4. Works like curl - no special permissions needed

## 🔄 Upgrading from Previous Version

If you tested earlier Ollama builds:
1. Uninstall old version
2. Install this XPI
3. Reconfigure Ollama settings
4. Test connection again

## ⚠️ Disclaimer

This is a **test release**. The Ollama integration is experimental and may have bugs. Please backup your settings before installing.

---

**Installation:** Download `autosortplus.xpi` and drag into Thunderbird Add-ons page

**Feedback:** Open an issue on GitHub with your results!

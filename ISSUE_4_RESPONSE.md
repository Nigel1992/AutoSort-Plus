## ✅ Fixed in v1.2.3.4

Hi @wisepass2000! Thanks for the detailed bug report - this has been fixed in **version 1.2.3.4**.

### 🔧 What Was Fixed

The issue was caused by how custom Ollama model names were being saved and restored:

1. **Custom Model Persistence**: When you entered a custom model like `qwen2.5:7b-instruct`, the extension saved the actual model name but didn't properly restore the UI state. Now the dropdown correctly shows "Custom" and your model name is populated when reopening settings.

2. **Auth Token Not Loading**: The `ollamaAuthToken` was being saved but not loaded back into the UI on restart.

3. **Missing Settings**: AI temperature and rule fallback preferences weren't persisting between sessions.

### 📥 Download & Install

**[Download autosortplus-1.2.3.4.xpi](https://github.com/Nigel1992/AutoSort-Plus/releases/tag/v1.2.3.4)**

Installation:
1. Download the XPI file
2. In Thunderbird: Menu → Add-ons and Themes
3. Click the gear icon → Install Add-on From File
4. Select the downloaded XPI

### ✅ What Now Works

After installing v1.2.3.4:
- ✅ Custom Ollama models persist correctly
- ✅ Settings UI accurately shows the active model
- ✅ Auth token is remembered
- ✅ AI temperature setting persists
- ✅ Rule fallback preference persists
- ✅ No more confusion about which model is in use

### 🧪 Testing

Please test with your `qwen2.5:7b-instruct` setup:
1. Configure your custom model
2. Save settings
3. Restart Thunderbird
4. Open AutoSort+ settings
5. Verify the UI shows "Custom" in dropdown with your model name visible

Let me know if you encounter any issues!

---

Thanks again for the detailed report and the helpful suggestions about using folder names as prompts. That's excellent advice for other users! 🙌

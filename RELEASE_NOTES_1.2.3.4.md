# AutoSort+ v1.2.3.4 Release Notes

**Release Date:** February 3, 2026

## 🐛 Bug Fixes

### Ollama Settings Persistence Issue Fixed

This release addresses a critical bug where Ollama AI configuration settings were not properly persisting when Thunderbird was restarted.

#### Issues Resolved:

1. **Custom Model Names Not Persisting** 
   - Custom Ollama models (e.g., `qwen2.5:7b-instruct`) now correctly persist and display in the settings UI
   - The dropdown properly shows "Custom" and the model input field is populated with your custom model name
   - No more confusion about whether the extension reverted to a default model

2. **Auth Token Not Loading**
   - Ollama authentication tokens now properly load when reopening settings
   - Previously, the token was saved but not restored to the UI

3. **AI Settings Not Persisting**
   - AI temperature slider setting now persists correctly
   - Rule-based fallback preference now saves and restores properly

#### Technical Details:

The root cause was in the settings loading logic in `options.js`:
- Custom model names were being saved but the UI restoration logic didn't properly handle non-preset model names
- The settings loader was missing `ollamaAuthToken` from the retrieval list
- Temperature and fallback settings were being saved but not loaded back into the UI elements

#### Fixes GitHub Issue:
- [#4 - BUG: Ollama model settings UI doesn't reflect actual model in use after restart](https://github.com/Nigel1992/AutoSort-Plus/issues/4)

## 📥 Installation

1. Download `autosortplus-1.2.3.4.xpi` from the [releases page](https://github.com/Nigel1992/AutoSort-Plus/releases/tag/v1.2.3.4)
2. Open Thunderbird
3. Go to: Menu → Add-ons and Themes
4. Click the gear icon → Install Add-on From File
5. Select the downloaded XPI file
6. Restart Thunderbird if prompted

## 🧪 Testing

After upgrading to v1.2.3.4:
1. Configure your Ollama settings (custom model, auth token, temperature, etc.)
2. Click "Save settings"
3. Restart Thunderbird
4. Open AutoSort+ settings again
5. Verify all your settings are preserved and correctly displayed

## 📝 Files Changed

- `options.js` - Fixed settings loading and saving logic for Ollama configuration
- `manifest.json` - Version bump to 1.2.3.4
- `CHANGELOG_OLLAMA.md` - Added changelog entry
- `README.md` - Updated version badge

## 🙏 Credits

Special thanks to [@wisepass2000](https://github.com/wisepass2000) for the detailed bug report and reproduction steps!

---

**Full Changelog:** https://github.com/Nigel1992/AutoSort-Plus/blob/main/CHANGELOG_OLLAMA.md

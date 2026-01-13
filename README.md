# AutoSort+ - AI-Powered Email Organization for Thunderbird

<img width="96" height="96" alt="icon-96" src="https://github.com/user-attachments/assets/32e8e1fb-7cb0-4b65-9bcc-e1cf693bf5e5" />



[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Development Status](https://img.shields.io/badge/status-active-green)](https://github.com/Nigel1992/AutoSort-Plus)

**Automatically sort and label your emails with AI intelligence**

AutoSort+ is a powerful Thunderbird addon that uses artificial intelligence to automatically classify and organize your emails. Select an AI provider, configure your email labels, and let the addon handle the rest.

## ✨ Features

### 🤖 Multi-Provider AI Support
- **Google Gemini** - Latest gemini-2.5-flash model
- **OpenAI** - gpt-4o-mini (excellent reasoning)
- **Anthropic Claude** - claude-3-haiku (nuanced understanding)
- **Groq** - llama-3.3-70b (fastest free option - 30 req/min)
- **Mistral AI** - mistral-small-latest (GDPR-friendly)

### 📁 Smart Folder Discovery
- Automatically load folders from IMAP mail accounts
- Choose between system folders or custom labels
- Bulk import with confirmation dialogs
- Recursive folder traversal

### 🎯 Intelligent Email Classification
- Analyzes email content using AI
- Matches emails to your configured labels
- Respects your existing folder structure
- Move history tracking

### 💾 Persistent Settings
- API keys stored securely in browser storage
- Settings survive addon restarts
- 100-entry move history
- Easy settings restoration

### 🎨 Professional UI
- Clean, modern settings interface
- Provider information cards with capabilities
- Real-time validation
- Helpful instruction messages

## 📦 Installation

### From Release File
1. Download `autosortplus.xpi` from [Latest Release](https://github.com/Nigel1992/AutoSort-Plus/releases)
2. In Thunderbird: **Tools → Add-ons and Extensions**
3. Click gear icon (⚙️) → **Install Add-on From File**
4. Select `autosortplus.xpi`

### Build from Source
```bash
git clone https://github.com/Nigel1992/AutoSort-Plus.git
cd AutoSort-Plus
zip -r autosortplus.xpi manifest.json background.js options.js options.html styles.css content.js icons/
```

## 🚀 Setup Guide

### Step 1: Choose Your AI Provider
1. Open AutoSort+ settings (Tools → Add-ons → AutoSort+ → Preferences)
2. Select your AI provider from the dropdown
3. Read provider info card to understand its strengths

### Step 2: Get an API Key

| Provider | Link | Free? | Notes |
|----------|------|-------|-------|
| **Gemini** | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Yes | No credit card required |
| **OpenAI** | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | Paid | $5-10 startup credit |
| **Anthropic** | [console.anthropic.com](https://console.anthropic.com/) | Yes | Limited free tier |
| **Groq** | [console.groq.com](https://console.groq.com/) | Yes | 30 requests/minute |
| **Mistral** | [console.mistral.ai](https://console.mistral.ai/) | Yes | EU-focused |

Click **"Get API Key"** in AutoSort+ settings to open signup page instantly.

### Step 3: Add Your API Key
1. Paste API key into the **"API Key"** field
2. Click **"Test API Connection"** to verify
3. You should see a ✓ success message

### Step 4: Configure Labels/Folders

#### Option A: Load from Mail Account (Recommended)
1. Click **"Load Folders from Mail Account"**
2. Select your email account
3. AutoSort+ discovers folders automatically
4. Review folder list
5. Click **"Use These Folders"**

#### Option B: Add Custom Labels
1. Click **"Add Label"** button
2. Enter label names (one per field)
3. These become your email categories

### Step 5: Save Settings
1. Review your configuration
2. Click **"Save Settings"**
3. ✅ You're ready to go!

## 💡 How to Use

### Manual Email Analysis
1. Select one or more emails in Thunderbird
2. The addon will analyze and auto-organize them
3. Monitor move history to verify classifications

### View Move History
1. Open AutoSort+ settings
2. Scroll to **"Move History"** section
3. See timestamps, subjects, and destinations
4. Last 100 moves stored

## 🎯 Recommended Providers

**Best Overall:** Gemini - Free, fast, accurate
**Most Capable:** OpenAI - Superior reasoning
**Privacy-Focused:** Claude (Anthropic) - Strong safety guardrails
**Fastest:** Groq - 30+ requests per minute free
**Europe-Friendly:** Mistral - GDPR compliant

## 🔧 Technical Details

### Architecture
- **background.js** - Email analysis engine, AI provider routing
- **options.js** - Settings UI and configuration management
- **content.js** - Message extraction from Thunderbird
- **manifest.json** - Addon metadata and permissions

### Storage Format
```javascript
// Settings stored in browser.storage.local
{
  apiKey: "your-api-key",
  aiProvider: "groq",  // or: gemini, openai, anthropic, mistral
  labels: ["Work", "Personal", "Archive"],
  enableAi: true,
  moveHistory: [ /* array of moves */ ]
}
```

### Supported Models
| Provider | Model | Context | Speed | Free Tier |
|----------|-------|---------|-------|-----------|
| Gemini | gemini-2.5-flash | 1M tokens | ⚡⚡⚡ | Yes |
| OpenAI | gpt-4o-mini | 128K tokens | ⚡⚡ | Limited |
| Claude | claude-3-haiku | 200K tokens | ⚡⚡⚡ | Yes |
| Groq | llama-3.3-70b | 8K tokens | ⚡⚡⚡⚡ | Yes (30/min) |
| Mistral | mistral-small | 32K tokens | ⚡⚡⚡ | Yes |

## 🔒 Privacy & Security

- ✅ API keys stored in browser storage (OS-encrypted)
- ✅ Email content never stored permanently
- ✅ Analysis requests sent directly to AI providers
- ✅ No telemetry or tracking
- ✅ No external dependencies
- ✅ Open source for transparency

## ⚠️ Troubleshooting

### Settings Page Won't Load
```bash
# Clear cache and reload addon
1. Thunderbird → Settings → Privacy → Cookies and Site Data → Clear Data
2. Tools → Add-ons → AutoSort+ → Reload
```

### "API Key Not Configured"
- Paste your API key in the settings page
- Click **"Test API Connection"**
- Ensure key is from the correct provider

### Email Analysis Fails
- ✓ Check internet connection
- ✓ Verify API key is valid (use Test button)
- ✓ Check provider's status page
- ✓ Ensure API hasn't hit rate limits
- ✓ Review error message for guidance

### Wrong Labels Applied
- Verify labels match exactly (case-sensitive)
- Check folders don't have special characters
- Ensure labels saved (green checkmark visible)

## 📋 Requirements

- **Thunderbird** 78.0+
- **Internet connection** (for API calls)
- **Valid API key** from your chosen provider

## 📝 Version History

### v1.2.0 (2026-01-13) - Multi-Provider Release ⭐
- ✅ Multi-provider AI support (Gemini, OpenAI, Anthropic, Groq, Mistral)
- ✅ Groq API updated to llama-3.3-70b (Mixtral deprecated)
- ✅ IMAP folder discovery with recursive traversal
- ✅ Professional UI with provider info cards
- ✅ Settings validation and state management
- ✅ Move history tracking (last 100 entries)
- ✅ Professional funnel/envelope icons
- ✅ Bulk label import
- ✅ Fixed syntax errors in options.js
- ✅ Unified API key storage

### v1.0.0 (2026-01-10)
- Initial release with Gemini support

## 🐛 Known Issues

None currently known. Please report any issues on GitHub.

## 💬 Support

- **Questions?** Check [Troubleshooting](#troubleshooting) above
- **Found a bug?** Open an issue on [GitHub](https://github.com/Nigel1992/AutoSort-Plus/issues)
- **Feature request?** Create a discussion or issue

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

## 🎨 Credits

Icon Attribution: <a href="https://www.flaticon.com/free-icons/email-filtering" title="email filtering icons">Email filtering icons created by Fantasyou - Flaticon</a>

## 🙏 Contributing

Pull requests welcome! For major changes, please open an issue first to discuss.

---

**Made with ❤️ to help you organize email faster**

[GitHub](https://github.com/Nigel1992/AutoSort-Plus) • [Issues](https://github.com/Nigel1992/AutoSort-Plus/issues) • [Latest Release](https://github.com/Nigel1992/AutoSort-Plus/releases)

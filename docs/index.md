---
layout: default
title: AutoSort+ - AI-Powered Email Organization for Thunderbird
---

<style>
body {
  background: #181a1b;
  color: #e0e0e0;
}

h1, h2, h3, h4, h5, h6, strong {
  color: #fff;
}

code, pre {
  background: #23272e;
  color: #b5e853;
}

a, a:visited {
  color: #7abaff;
}

.table-striped tr:nth-child(even) {
  background: #23272e;
}

blockquote {
  border-left: 4px solid #7abaff;
  background: #23272e;
  color: #b5e853;
  padding: 0.5em 1em;
}

.warning {
  background: #ff9800;
  color: #181a1b;
  padding: 0.5em 1em;
  border-radius: 6px;
  margin: 1em 0;
  font-weight: bold;
}
</style>

<div align="center">

# 🎯 AutoSort+ for Thunderbird

### AI-Powered Email Organization with Multi-Provider Support

<a href="https://github.com/Nigel1992/AutoSort-Plus/releases"><img src="https://img.shields.io/badge/Version-1.2.3.3-blue?style=for-the-badge" alt="Version"></a>
<a href="https://www.thunderbird.net/"><img src="https://img.shields.io/badge/Thunderbird-78.0+-0A84FF?style=for-the-badge&logo=thunderbird&logoColor=white" alt="Thunderbird"></a>
<a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License"></a>

[📦 Download](https://github.com/Nigel1992/AutoSort-Plus/releases) • [📖 Full README](https://github.com/Nigel1992/AutoSort-Plus) • [🐛 Report Issue](https://github.com/Nigel1992/AutoSort-Plus/issues)

</div>

---

## 🌟 What is AutoSort+?

AutoSort+ transforms your email workflow by automatically organizing messages into your custom folder structure using cutting-edge AI. Unlike rigid rule-based systems, AutoSort+ understands context, learns your preferences, and adapts to your unique organizational needs.

### ✨ Why Choose AutoSort+?

| Feature | Traditional Filters | AutoSort+ |
|---------|---------------------|------------|
| **Setup Time** | Hours of rule configuration | Minutes with AI |
| **Flexibility** | Static rules, breaks easily | Adaptive AI, learns patterns |
| **Context Understanding** | Basic keyword matching | Full content comprehension |
| **Multi-Provider** | N/A | 5 AI providers to choose from |
| **Smart Limits** | N/A | Built-in rate limit management |
| **History Tracking** | Manual logging | Automatic 100-move history |

---

## 🎉 Latest Release: v1.2.0

<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; color: white; margin: 20px 0;">

### 🚀 Multi-Provider AI Release

**Released:** January 13, 2026

#### 🆕 Major Features
- ✅ **5 AI Providers**: Gemini, OpenAI, Anthropic, Groq, Mistral
- ✅ **Gemini Rate Limiting**: Automatic 5/min, 20/day enforcement
- ✅ **Usage Dashboard**: Real-time tracking with smart warnings
- ✅ **IMAP Auto-Discovery**: Recursive folder detection
- ✅ **Bulk Import**: Load labels from text lists
- ✅ **Move History**: Last 100 emails with full details
- ✅ **Professional UI**: Provider info cards and validation

#### 🔧 Improvements
- ✅ Updated Groq to llama-3.3-70b
- ✅ Enhanced error handling
- ✅ Auto-create missing folders
- ✅ Better batch processing
- ✅ Settings validation system

</div>

---

## 🎯 Key Features

### 🤖 Multi-Provider AI Support

Choose the best AI provider for your needs:

| Provider | Model | Free Tier | Speed | Best For |
|----------|-------|-----------|-------|----------|
| **Gemini** | gemini-2.5-flash | 20/day/key | ⚡⚡⚡ | General use, fast processing |
| **OpenAI** | gpt-4o-mini | - | ⚡⚡ | Premium quality |
| **Claude** | claude-3-haiku | 1000/day | ⚡⚡⚡ | Long emails, nuanced content |
| **Groq** | llama-3.3-70b | Generous | ⚡⚡⚡⚡ | Ultra-fast, free |
| **Mistral** | mistral-small | Free tier | ⚡⚡⚡ | European privacy focus |

### 📊 Smart Rate Limit Management (Gemini)

- **Automatic Enforcement**: 5 requests/minute, 20/day
- **Real-Time Tracking**: See usage in settings dashboard
- **Smart Warnings**: Alerts at 15/20 limit
- **Multi-Key Support**: Switch keys when limit reached
- **Paid Plan Bypass**: Disable limits with paid plan checkbox

### 📁 Flexible Folder Management

- **IMAP Discovery**: Auto-load your existing folder structure
- **Bulk Import**: Paste lists of labels
- **Custom Categories**: Create unlimited folder categories
- **Auto-Create**: Missing folders created automatically
- **Smart Navigation**: Recursive folder traversal

### 📜 Move History & Tracking

- **Last 100 Moves**: Full audit trail
- **Timestamps**: Precise move timing
- **Status Tracking**: Success/failure indicators
- **Subject Lines**: Quick identification
- **Destination Folders**: See where emails went
- **Clear History**: Fresh start anytime

---

## 🚀 Quick Start Guide

### 1️⃣ Installation

**Option 1: Direct Download**
```bash
# Download the latest XPI from releases
wget https://github.com/Nigel1992/AutoSort-Plus/releases/latest/download/autosortplus.xpi
```

**Option 2: Build from Source**
```bash
git clone https://github.com/Nigel1992/AutoSort-Plus.git
cd AutoSort-Plus
# Install in Thunderbird: Tools → Add-ons → Install Add-on From File
```

### 2️⃣ Get Your API Key

Choose your preferred AI provider:

- **Gemini** (Free): [Get API Key](https://aistudio.google.com/app/apikey) - 20 requests/day per key
- **OpenAI** (Paid): [Get API Key](https://platform.openai.com/api-keys)
- **Anthropic** (Free/Paid): [Get API Key](https://console.anthropic.com/) - 1000/day free
- **Groq** (Free): [Get API Key](https://console.groq.com/keys) - Generous limits
- **Mistral** (Free/Paid): [Get API Key](https://console.mistral.ai/)

### 3️⃣ Configure AutoSort+

1. Open Thunderbird → **Tools → Add-ons**
2. Find **AutoSort+** → Click **Options**
3. **Select AI Provider** and paste your API key
4. Click **"Test API Connection"** ✅
5. **Load folders** from IMAP or add custom labels
6. Save settings and you're ready!

### 4️⃣ Start Organizing

You have two options:

**Option 1: AI-Powered Sorting**
- Select emails → Right-click → **AutoSort+ → Analyze with AI**
- The AI will analyze and move emails to the best folder/category.

**Option 2: Manual Labeling**
- Select emails → Right-click → **AutoSort+ → AutoSort Label → [Pick any label]**
- The selected label/category will be applied instantly to all selected emails.
<div class="warning">If you add or change labels in the settings menu, you must restart Thunderbird for the new labels to appear in the right-click menu.</div>

---

## 📖 Usage Guides

### Managing Gemini Rate Limits

If using Gemini's free tier:

1. **Monitor Usage**: Check settings for real-time count (X/20)
2. **Watch Warnings**: Yellow alert at 15, red at 20
3. **Create More Keys**: Generate multiple API keys in different projects
4. **Switch Keys**: Paste new key when limit reached, click Reset Counter
5. **Upgrade**: Enable "Gemini paid plan" if you have one

### Creating Multiple Gemini Keys

```
1. Go to Google AI Studio: https://aistudio.google.com/
2. Create a new project
3. Generate API key for that project
4. Each project = new 20/day limit
5. Switch keys in AutoSort+ settings as needed
```

### Setting Up Custom Folders

**Method 1: IMAP Discovery**
- Click "Load Folders from IMAP"
- Select your account
- All folders appear automatically

**Method 2: Bulk Import**
```
Work
Personal  
Finance
Projects
Family
```
- Paste list (one per line) → Click Import

**Method 3: Manual Entry**
- Type label name → Click "Add Label" → See green checkmark

---

## 🔒 Privacy & Security

| Aspect | Details |
|--------|----------|
| **Email Storage** | ❌ Never stored, analyzed in memory only |
| **API Keys** | 🔐 OS-level encryption via browser storage |
| **Data Transmission** | ✅ Direct to your chosen AI provider |
| **Telemetry** | ❌ None - zero tracking |
| **Open Source** | ✅ Full transparency, audit anytime |
| **Third Parties** | ❌ No intermediary servers |

**Your privacy is paramount.** All analysis happens directly between Thunderbird and your chosen AI provider. We don't have servers because we don't want your data!

---

## 🛠️ Advanced Configuration

### Provider-Specific Settings

**Gemini Users:**
- Enable "Paid Plan" checkbox to bypass rate limits
- Use Reset Counter when switching API keys
- Monitor daily reset time in usage panel

**All Providers:**
- Test connection before first use
- Save settings after changes
- Check move history for troubleshooting

### Folder Organization Tips

- **Keep categories broad**: "Work", "Personal", "Finance"
- **Avoid special characters**: Use alphanumeric names
- **Case-sensitive matching**: Labels must match exactly
- **Use examples**: More context = better AI understanding

---

## ⚠️ Troubleshooting

### API Key Issues

**Problem**: "API Key Not Configured" error

**Solution**:
1. Verify key is from correct provider
2. No spaces before/after key
3. Click "Test API Connection"
4. Check provider's usage dashboard for validity

### Rate Limit Errors

**Problem**: "Rate limit exceeded" for Gemini

**Solution**:
1. Check usage counter in settings (X/20)
2. Wait for daily reset (time shown in settings)
3. Create new API key in different project
4. Switch key and click "Reset Counter"
5. Or enable "Paid Plan" if applicable

### Settings Page Won't Load

**Solution**:
```bash
1. Thunderbird → Settings → Privacy → Cookies and Site Data
2. Click "Clear Data"
3. Tools → Add-ons → AutoSort+ → Reload
```

### Emails Not Moving

**Check**:
- ✓ API key is valid (test it)
- ✓ Labels are saved (green checkmark)
- ✓ Folders exist (or auto-create enabled)
- ✓ Internet connection active
- ✓ No rate limit reached

---

## 📊 System Architecture

```
┌─────────────────────────────────────────┐
│         Thunderbird Email Client        │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│        AutoSort+ Extension              │
│                                         │
│  ┌──────────┐  ┌──────────┐           │
│  │ UI Layer │  │ Background│           │
│  │(options) │◄─┤  Script   │           │
│  └──────────┘  └─────┬─────┘           │
│                      │                  │
│              ┌───────▼────────┐        │
│              │  Rate Limiter  │        │
│              │  (Gemini only) │        │
│              └───────┬────────┘        │
└──────────────────────┼─────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
    ┌────▼────┐  ┌────────┐  ┌─────▼─────┐
    │ Gemini  │  │  Groq  │  │  Claude   │
    │   API   │  │  API   │  │   API     │
    └─────────┘  └────────┘  └───────────┘
```

---

## 🤝 Support & Community

<div align="center">

| 💡 Have Questions? | 🐛 Found a Bug? | ✨ Feature Ideas? |
|-------------------|-----------------|-------------------|
| [Discussions](https://github.com/Nigel1992/AutoSort-Plus/discussions) | [Issues](https://github.com/Nigel1992/AutoSort-Plus/issues) | [Feature Requests](https://github.com/Nigel1992/AutoSort-Plus/issues) |

</div>

**Before reporting an issue:**
1. Check troubleshooting section above
2. Search existing issues
3. Include: Thunderbird version, AutoSort+ version, AI provider, error message

---

## 🙏 Contributing

We ❤️ contributions! Here's how to help:

### Ways to Contribute

- 🐛 **Report bugs** with detailed reproduction steps
- 💡 **Suggest features** that would improve your workflow  
- 📖 **Improve docs** with clearer explanations
- 🧪 **Test releases** with different providers
- 💻 **Submit code** via pull requests

### Development Setup

```bash
# Clone repository
git clone https://github.com/Nigel1992/AutoSort-Plus.git
cd AutoSort-Plus

# Make changes
# Test in Thunderbird: Tools → Add-ons → Debug Add-ons → Load Temporary Add-on

# Submit PR
git checkout -b feature/amazing-feature
git commit -m "Add amazing feature"
git push origin feature/amazing-feature
```

---

## 📄 License

**MIT License** - Free to use, modify, and distribute.

See [LICENSE](https://github.com/Nigel1992/AutoSort-Plus/blob/main/LICENSE) for full text.

---

## 🎨 Credits

**Icon Design:** [Fantasyou - Flaticon](https://www.flaticon.com/free-icons/email-filtering)

**AI Providers:**
- [Google Gemini](https://ai.google.dev/)
- [OpenAI](https://openai.com/)
- [Anthropic](https://www.anthropic.com/)
- [Groq](https://groq.com/)
- [Mistral AI](https://mistral.ai/)

**Built with:**
- [Thunderbird WebExtension APIs](https://webextension-api.thunderbird.net/)
- JavaScript ES6+
- Love ❤️

---

<div align="center">

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Nigel1992/AutoSort-Plus&type=Date)](https://star-history.com/#Nigel1992/AutoSort-Plus&Date)

---

**Made with ❤️ to help you organize email faster**

[⬆ Back to Top](#-autosort-for-thunderbird) • [GitHub](https://github.com/Nigel1992/AutoSort-Plus) • [Latest Release](https://github.com/Nigel1992/AutoSort-Plus/releases)

---

![Thunderbird](https://img.shields.io/badge/Thunderbird-78.0+-0A84FF?style=flat-square&logo=thunderbird&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![Version](https://img.shields.io/badge/Version-1.2.3.3-blue?style=flat-square)

</div>
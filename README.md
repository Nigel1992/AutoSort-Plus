<div align="center">

# 🎯 AutoSort+ 

### AI-Powered Email Organization for Thunderbird

<img width="120" height="120" alt="AutoSort+ Logo" src="https://github.com/user-attachments/assets/32e8e1fb-7cb0-4b65-9bcc-e1cf693bf5e5" />

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.2.3-blue.svg)](https://github.com/Nigel1992/AutoSort-Plus/releases)
[![Thunderbird](https://img.shields.io/badge/Thunderbird-78.0%2B-0a84ff.svg)](https://www.thunderbird.net/)
[![Development Status](https://img.shields.io/badge/status-active-success)](https://github.com/Nigel1992/AutoSort-Plus)

**Stop manually sorting emails. Let AI do it for you.**

[📥 Download](https://github.com/Nigel1992/AutoSort-Plus/releases) • [📖 Documentation](#-setup-guide) • [🐛 Report Bug](https://github.com/Nigel1992/AutoSort-Plus/issues) • [💡 Request Feature](https://github.com/Nigel1992/AutoSort-Plus/issues)

</div>

---

## 📌 Table of Contents

- [✨ Features](#-features)
- [📥 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [⚙️ AI Provider Setup](#️-ai-provider-setup)
- [💡 Usage](#-usage)
- [🔧 Technical Details](#-technical-details)
- [⚠️ Troubleshooting](#️-troubleshooting)
- [📝 Changelog](#-changelog)
- [🤝 Contributing](#-contributing)

---

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🤖 Multi-Provider AI
Choose from **5 leading AI providers**:
- **Google Gemini** - Best free tier + **Multi-key support**
- **OpenAI** - Superior accuracy  
- **Anthropic Claude** - Privacy-focused
- **Groq** - Fastest processing
- **Mistral AI** - GDPR compliant

</td>
<td width="50%">

### 🔑 Multiple API Keys (Gemini)
- Add keys from multiple projects
- Automatic rotation on limit
- Per-key usage tracking
- 5 keys = 100 requests/day

</td>
</tr>
<tr>
<td width="50%">

### 📁 Smart Folder Management
- IMAP folder auto-discovery
- Bulk label import
- Custom folder creation
- Recursive traversal

</td>
<td width="50%">

### 🎯 Intelligent Classification
- Content analysis
- Context-aware sorting
- Multi-label support
- 100-entry history

</td>
</tr>
</table>

<details>
<summary><b>🔥 Additional Features</b></summary>

- ✅ **Secure Storage** - Encrypted API key storage
- ✅ **Batch Processing** - Sort multiple emails at once
- ✅ **Rate Limiting** - Built-in quota management (Gemini)
- ✅ **Professional UI** - Clean, intuitive interface
- ✅ **Move History** - Track all email movements
- ✅ **Real-time Validation** - Instant feedback
- ✅ **Open Source** - Transparent, auditable code

</details>

---

---

## 📥 Installation

### Option 1: Download Release (Recommended)

```bash
1. Visit: https://github.com/Nigel1992/AutoSort-Plus/releases
2. Download: autosortplus.xpi
3. Thunderbird: Tools → Add-ons and Extensions
4. Click: ⚙️ → Install Add-on From File
5. Select: autosortplus.xpi
6. Restart Thunderbird
```

### Option 2: Build from Source

```bash
git clone https://github.com/Nigel1992/AutoSort-Plus.git
cd AutoSort-Plus
zip -r autosortplus.xpi manifest.json background.js options.js options.html styles.css content.js icons/
```

<div align="center">

**[📥 Download Latest Release](https://github.com/Nigel1992/AutoSort-Plus/releases) • [📖 View Changelog](#-changelog)**

</div>

---

## 🚀 Quick Start

### 1️⃣ Choose AI Provider
Open settings and select from Gemini, OpenAI, Claude, Groq, or Mistral

### 2️⃣ Get API Key
Click "Get API Key" button → Create free account → Copy key

### 3️⃣ Configure Folders
Load folders from IMAP or add custom labels

### 4️⃣ Start Sorting
Select emails → Let AI categorize them automatically

---

## ⚙️ AI Provider Setup

## ⚙️ AI Provider Setup

<table>
<tr>
<th>Provider</th>
<th>Get API Key</th>
<th>Free Tier</th>
<th>Best For</th>
</tr>
<tr>
<td><b>🔹 Gemini</b></td>
<td><a href="https://aistudio.google.com/apikey">Get Key</a></td>
<td>✅ 20/day per key</td>
<td>Best overall free option</td>
</tr>
<tr>
<td><b>🔹 Groq</b></td>
<td><a href="https://console.groq.com">Get Key</a></td>
<td>✅ 30/min</td>
<td>Speed & high limits</td>
</tr>
<tr>
<td><b>🔹 Claude</b></td>
<td><a href="https://console.anthropic.com">Get Key</a></td>
<td>✅ Limited</td>
<td>Privacy & safety</td>
</tr>
<tr>
<td><b>🔹 OpenAI</b></td>
<td><a href="https://platform.openai.com/api-keys">Get Key</a></td>
<td>⚠️ $5 credit</td>
<td>Highest accuracy</td>
</tr>
<tr>
<td><b>🔹 Mistral</b></td>
<td><a href="https://console.mistral.ai">Get Key</a></td>
<td>✅ Limited</td>
<td>GDPR compliance</td>
</tr>
</table>

### 📊 Usage Limits & Recommendations

> **⚠️ IMPORTANT:** Free tiers are limited for email processing due to large text content.

| Provider | Free Limit | Recommendation |
|----------|-----------|----------------|
| **Gemini** | 20 emails/day per API key | ⭐ Create multiple keys in different projects |
| **Groq** | 20-30 emails/day | ⭐ Best free tier overall |
| **Claude** | 10-15 emails/day | Good for privacy-conscious users |
| **OpenAI** | 5-10 emails/day | Consider paid plan ($5-20/mo) |
| **Mistral** | 10-15 emails/day | Best for EU users |

<details>
<summary><b>💡 Tips for Managing Free Tier Limits</b></summary>

**For Gemini users (NEW in v1.2.1!):**
- 🆕 **Multiple API Keys**: Add keys from different Google Cloud projects
- 🔄 **Automatic Rotation**: Extension switches keys when limits are reached
- 📊 **Per-Key Tracking**: Monitor usage for each key independently
- ✨ **Example**: 5 keys = 100 requests/day total (20 per key)
- 🔧 **How to add**: Settings → Add Another Gemini Key
- Check usage: [AI Studio Usage](https://aistudio.google.com/usage)

**For all providers:**
- Process emails in small batches
- Use "Gemini paid plan" checkbox to disable limits (if you have paid tier)
- Consider paid plans for daily use ($5-20/month)

</details>

---

## 💡 Usage

### Basic Operation

1. **Select Emails** - Click one or more emails in Thunderbird
2. **Auto-Analyze** - Addon analyzes content automatically
3. **Smart Sorting** - Emails moved to appropriate folders
4. **Track History** - View last 100 moves in settings

### Advanced Features

**� Multiple API Keys (Gemini - NEW!)**
- Add unlimited keys from different projects
- Automatic rotation when limits reached
- Individual testing and status tracking
- Visual indicators (Active, Ready, Near Limit)
- Combined quota = keys × 20 requests/day

**📊 Usage Monitoring (Gemini)**
- Real-time usage display in settings
- Per-key usage statistics
- Automatic warnings at 15/20 limit
- Smart key rotation

**📁 Folder Management**
- Load folders from IMAP accounts
- Bulk import from text list
- Create custom categories
- Auto-create missing folders

**🔍 Move History**
- Last 100 email moves
- Timestamps and destinations
- Success/failure status
- Clear history option

---

<details>
<summary><strong>📚 Example Folder Categories</strong></summary>

**Work & Professional:**
- Meetings
- Project Updates
- Invoices
- HR & Benefits

**Financial:**
- Bills & Payments
- Bank Statements
- Receipts
- Tax Documents

**Personal:**
- Family
- Friends
- Health
- Travel

**Online Services:**
- Shopping Confirmations
- Social Media Notifications
- Subscriptions
- Password Resets

**Promotions:**
- Newsletters
- Sales & Discounts
- Offers
- Marketing

**Support:**
- Tickets & Help
- Documentation
- Updates
- Complaints

</details>

---

## 🔧 Technical Details

### System Architecture

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

### File Structure

| File | Purpose | Key Functions |
|------|---------|---------------|
| `background.js` | AI analysis engine | `analyzeEmailContent()`, rate limiting |
| `options.js` | Settings UI | Provider config, usage display |
| `content.js` | Email extraction | Message content parsing |
| `manifest.json` | Extension config | Permissions, metadata |

### Storage Schema

```javascript
{
  // User Configuration
  apiKey: "string",
  aiProvider: "gemini|openai|anthropic|groq|mistral",
  labels: ["Work", "Personal", ...],
  enableAi: boolean,
  geminiPaidPlan: boolean,
  
  // Rate Limiting (Gemini)
  geminiRateLimit: {
    requests: [timestamp, ...],
    dailyCount: number,
    dailyResetTime: timestamp
  },
  
  // History
  moveHistory: [
    {
      timestamp: string,
      subject: string,
      status: string,
      destination: string
    },
    ...
  ]
}
```

### Supported AI Models

| Provider | Model | Context Window | Speed | Cost |
|----------|-------|----------------|-------|------|
| Gemini | gemini-2.5-flash | 1M tokens | ⚡⚡⚡ | Free/Paid |
| OpenAI | gpt-4o-mini | 128K tokens | ⚡⚡ | Paid |
| Claude | claude-3-haiku | 200K tokens | ⚡⚡⚡ | Free/Paid |
| Groq | llama-3.3-70b | 8K tokens | ⚡⚡⚡⚡ | Free |
| Mistral | mistral-small-latest | 32K tokens | ⚡⚡⚡ | Free/Paid |

---

## 🔒 Privacy & Security

| Feature | Status | Details |
|---------|--------|---------|
| **🔐 API Key Storage** | ✅ Encrypted | OS-level encryption via browser storage |
| **📧 Email Content** | ✅ Not Stored | Analyzed in memory, never persisted |
| **🌐 Data Transmission** | ✅ Direct to AI | No intermediary servers |
| **📊 Telemetry** | ✅ None | Zero tracking or analytics |
| **🔍 Open Source** | ✅ Auditable | Full transparency |
| **🛡️ Permissions** | ✅ Minimal | Only required APIs |

**Your privacy matters:** All email analysis happens directly between your Thunderbird and chosen AI provider. No data passes through our servers because we don't have any!

---

## ⚠️ Troubleshooting

<details>
<summary><b>🔧 Settings Page Won't Load</b></summary>

```bash
1. Thunderbird → Settings → Privacy → Cookies and Site Data
2. Click "Clear Data"
3. Tools → Add-ons → AutoSort+ → Reload
```

</details>

<details>
<summary><b>🔑 API Key Not Working</b></summary>

- Verify key is copied correctly (no spaces)
- Click "Test API Connection" button
- Check key is from correct provider
- Ensure API key has proper permissions
- For Gemini: Check [usage page](https://aistudio.google.com/usage)

</details>

<details>
<summary><b>❌ Email Analysis Fails</b></summary>

**Check:**
- ✓ Internet connection active
- ✓ API key is valid
- ✓ Provider status page for outages
- ✓ Rate limits not exceeded
- ✓ Email content isn't empty

**For Gemini users:**
- Check usage counter in settings
- Verify daily limit not reached (20/day)
- Switch to new API key if needed

</details>

<details>
<summary><b>📁 Wrong Labels Applied</b></summary>

- Ensure labels are case-sensitive matches
- Avoid special characters in folder names
- Verify labels are saved (green checkmark)
- Check move history for patterns

</details>

<details>
<summary><b>⏱️ Rate Limit Errors</b></summary>

**Gemini (20/day per key):**
- Create new API key in different project
- Reset counter after switching keys
- Enable "paid plan" option if you have one

**Other Providers:**
- Wait for rate limit window to reset
- Consider upgrading to paid tier
- Use provider's usage dashboard

</details>

---

## 📋 System Requirements

| Component | Requirement |
|-----------|-------------|
| **Thunderbird** | 78.0 or later |
| **Internet** | Active connection for API calls |
| **API Key** | Valid key from chosen provider |
| **Storage** | ~1MB for extension data |
| **OS** | Windows, macOS, Linux |

---

## 📝 Changelog

### 🎉 v1.2.0 (2026-01-13) - Multi-Provider Release

<details open>
<summary><b>🆕 New Features</b></summary>

- ✅ Multi-provider AI support (5 providers)
- ✅ Gemini rate limiting (5/min, 20/day enforcement)
- ✅ Real-time usage tracking dashboard
- ✅ IMAP folder auto-discovery
- ✅ Bulk label import
- ✅ Move history (last 100 entries)
- ✅ Professional UI redesign
- ✅ Provider info cards

</details>

<details>
<summary><b>🔧 Improvements</b></summary>

- ✅ Groq updated to llama-3.3-70b
- ✅ Better error handling and validation
- ✅ Auto-create missing folders
- ✅ Skip null categories
- ✅ Batch email processing fixes
- ✅ Professional funnel/envelope icons
- ✅ Example folder categories

</details>

<details>
<summary><b>⚙️ Technical Changes</b></summary>

- ✅ Unified API key storage
- ✅ Settings validation system
- ✅ Recursive folder traversal
- ✅ Fixed syntax errors in options.js
- ✅ Improved state management

</details>

### v1.0.0 (2026-01-10) - Initial Release
- Initial release with Gemini support

---

## 🚧 Roadmap & TODO

<table>
<tr>
<th>Priority</th>
<th>Feature</th>
<th>Status</th>
</tr>
<tr>
<td>🔴 High</td>
<td><strong>Detailed Logging</strong> - Debug mode with console output</td>
<td>📋 Planned</td>
</tr>
<tr>
<td>🔴 High</td>
<td><strong>API Response Headers</strong> - Extract rate limit info from API</td>
<td>📋 Planned</td>
</tr>
<tr>
<td>🟡 Medium</td>
<td><strong>Smart Key Switching</strong> - Auto-suggest when to switch keys</td>
<td>💡 Proposed</td>
</tr>
<tr>
<td>🟡 Medium</td>
<td><strong>Scheduled Processing</strong> - Auto-sort at specific times</td>
<td>💡 Proposed</td>
</tr>
<tr>
<td>🟢 Low</td>
<td><strong>Custom Rules</strong> - User-defined sorting logic</td>
<td>💡 Proposed</td>
</tr>
<tr>
<td>🟢 Low</td>
<td><strong>Statistics Dashboard</strong> - Email sorting analytics</td>
<td>💡 Proposed</td>
</tr>
</table>

---

## 🐛 Known Issues

**None currently reported!** 🎉

If you encounter any issues, please [open an issue on GitHub](https://github.com/Nigel1992/AutoSort-Plus/issues).

---

## 💬 Support & Community

<div align="center">

| 💡 Questions | 🐛 Bug Reports | ✨ Feature Requests |
|--------------|----------------|---------------------|
| [Discussions](https://github.com/Nigel1992/AutoSort-Plus/discussions) | [Issues](https://github.com/Nigel1992/AutoSort-Plus/issues) | [Issues](https://github.com/Nigel1992/AutoSort-Plus/issues) |

</div>

**Before reporting:**
1. Check [Troubleshooting](#troubleshooting) section
2. Search existing issues
3. Include Thunderbird version and extension version

---

## 🙏 Contributing

We welcome contributions! Here's how to help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to branch (`git push origin feature/amazing`)
5. **Open** a Pull Request

**Guidelines:**
- Follow existing code style
- Add comments for complex logic
- Test with multiple AI providers
- Update README for new features

---

## 📄 License

```
MIT License

Copyright (c) 2026 Nigel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

See [LICENSE](LICENSE) file for full text.

---

## 🎨 Credits & Acknowledgments

**Icon Design:**  
[Email filtering icons created by Fantasyou - Flaticon](https://www.flaticon.com/free-icons/email-filtering)

**AI Providers:**
- [Google Gemini](https://ai.google.dev/)
- [OpenAI](https://openai.com/)
- [Anthropic Claude](https://www.anthropic.com/)
- [Groq](https://groq.com/)
- [Mistral AI](https://mistral.ai/)

**Built with:**
- [Thunderbird WebExtension APIs](https://webextension-api.thunderbird.net/)
- JavaScript ES6+
- Manifest v2

---

<div align="center">

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Nigel1992/AutoSort-Plus&type=Date)](https://star-history.com/#Nigel1992/AutoSort-Plus&Date)

---

**Made with ❤️ to help you organize email faster**

[⬆ Back to Top](#autosort) • [🏠 GitHub](https://github.com/Nigel1992/AutoSort-Plus) • [📦 Latest Release](https://github.com/Nigel1992/AutoSort-Plus/releases) • [📖 Documentation](https://nigel1992.github.io/AutoSort-Plus/)

---

![Thunderbird](https://img.shields.io/badge/Thunderbird-78.0+-0A84FF?style=for-the-badge&logo=thunderbird&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![Version](https://img.shields.io/badge/Version-1.2.0-blue?style=for-the-badge)

</div>


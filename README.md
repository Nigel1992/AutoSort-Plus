[![Discord](https://img.shields.io/discord/1468295714961494029?color=7289da&label=Join%20Our%20Discord&logo=discord&logoColor=white&style=for-the-badge)]([![Discord](https://img.shields.io/discord/1468295714961494029?color=7289da&label=Join%20Our%20Discord&logo=discord&logoColor=white&style=for-the-badge)](https://discord.gg/9F2NZuydXT))


[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Nigel1992)

<div align="center">

# 🎯 AutoSort+ 

[![Vibe Coded](https://img.shields.io/badge/Vibe_Coded-✨-8A2BE2?style=for-the-badge)](https://github.com)

### AI-Powered Email Organization for Thunderbird

<img width="120" height="120" alt="AutoSort+ Logo" src="https://github.com/user-attachments/assets/32e8e1fb-7cb0-4b65-9bcc-e1cf693bf5e5" />

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.4.1-blue.svg)](https://github.com/Nigel1992/AutoSort-Plus/releases)
[![Thunderbird](https://img.shields.io/badge/Thunderbird-78.0%2B-0a84ff.svg)](https://www.thunderbird.net/)
[![Development Status](https://img.shields.io/badge/status-active-success)](https://github.com/Nigel1992/AutoSort-Plus)

**Let AI help you organize your emails intelligently.**

> ⚠️ **Not yet in Thunderbird Add-on Store** - Manual installation required. Official store submission in progress.

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
Choose from **5 leading cloud AI providers** or run a **local Ollama** model:
- **Google Gemini** - Best free tier + **Multi-key support**
- **OpenAI** - Superior accuracy  
- **Anthropic Claude** - Privacy-focused
- **Groq** - Fastest processing
- **Mistral AI** - GDPR compliant
- **Ollama (Local)** - Run LLMs locally (llama3.2, tinyllama, phi, gemma). No API key required; supports model download and CPU-only mode

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
- ✅ **Batch Processing** - Sort many emails in parallel with a live progress panel (cancel / retry failed)
- ✅ **Bulk Key Import** - Add many Gemini keys at once with duplicate detection
- ✅ **Toolbar Popup** - Quick API usage summary with shortcuts to Settings and Batch Panel
- ✅ **Dark Mode** - Full dark-theme support across all screens
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
Open settings and select from Gemini, OpenAI, Claude, Groq, Mistral, or Ollama (Local LLM)

### 2️⃣ Get API Key (or install local Ollama)
Click "Get API Key" button → Create free account → Copy key. For Ollama (local): install Ollama from https://ollama.ai/download and pull a model (e.g., `ollama pull llama3.2`). No API key required for Ollama.

### 3️⃣ Configure Folders
Load folders from IMAP or add custom labels

### 4️⃣ Sort Emails (Two Options)

**Option 1: AI-Powered Sorting**
- Select emails → Right-click → **AutoSort+ → Batch Analyze with AI**
- The AI will analyze and move emails to the best folder/category.

**Option 2: Manual Labeling**
- Select emails → Right-click → **AutoSort+ → AutoSort Label → [Pick any label]**
- The selected label/category will be applied instantly to all selected emails.

> ⚠️ **Warning:** If you add or change labels in the settings menu, you must restart Thunderbird for the new labels to appear in the right-click menu.

> 📌 **Note:** Currently requires manual selection and right-click. Automatic background sorting coming in future update!

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
<tr>
<td><b>🔹 Ollama</b></td>
<td><a href="https://ollama.ai/download">Install Ollama</a></td>
<td>✅ Local (no external usage)</td>
<td>Run local LLMs (llama3.2, tinyllama, phi, gemma). No API keys required; supports model downloads and CPU-only mode.</td>
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
2. **Right-Click Menu** - Right-click → **AutoSort+ → Batch Analyze with AI**
3. **Smart Sorting** - A **Batch Panel** tab opens with a live progress bar; the AI analyzes and moves each email to the appropriate folder. You can **Cancel** at any time, or **Retry Failed** emails when it finishes
4. **Track History** - View last 100 moves in settings

> 🔄 **Coming Soon:** Automatic background sorting (currently manual via right-click)

### Advanced Features

**� Multiple API Keys (Gemini)**
- Add unlimited keys from different projects
- **Bulk import** many keys at once (one per line) with duplicate detection
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

**🗂️ Batch Processing**
- Right-click → **Batch Analyze with AI** to sort many emails
- Live progress panel with per-email results
- Parallel analysis — **Parallel batch size** is configurable (1–20) in Settings
- Cancel anytime, or retry only the failed emails

### Manual Labeling (Right-Click)

You can also manually label emails without AI analysis:

1. **Select Emails** - Click one or more emails in Thunderbird.
2. **Right-Click Menu** - Right-click → **AutoSort+ → AutoSort Label → [Pick any label]**
3. **Label Applied** - The selected label/category will be applied to all selected emails instantly.

> **Note:** If you add or change labels in the settings menu, you must restart Thunderbird for the new labels to appear in the right-click menu.

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
  geminiModel: "string",   // e.g. "gemini-3.5-flash-lite"
  providerModel: "string", // optional model override for non-Gemini providers
  
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

### 🎉 v1.4.1 (2026-10-19) - Gemini Quota Handling, Key Tools & Completion Sound

- ✅ Gemini 429 responses now honor Google's retry delay and retry up to five times; failed API responses don't increment local usage counters
- ✅ Increased Gemini output-token budget and preserve returned label text when a response reaches `MAX_TOKENS`
- ✅ Gemini usage counters refresh automatically every 10 seconds; Settings has a live per-key countdown and optional reset notifications
- ✅ Each key's 24-hour countdown starts only when that key reaches the add-on's 20-request cap; other keys have independent counters and countdowns
- ✅ Parallel requests reserve each key's remaining daily slots before sending, so concurrent batches cannot push the counter above 20/20; failed requests release their reservations
- ✅ Test all Gemini keys sequentially, reveal/hide keys individually, and remove keys from usage cards immediately
- ✅ Optional longer, more audible completion chime after batch sorting finishes

### 🎉 v1.4.0 (2026-10-17) - Batch Panel, Bulk Key Import, Dark Mode & Quick Popup

<details open>
<summary><b>🆕 New Features</b></summary>

- ✅ **Batch progress panel** - "Batch Analyze with AI" opens a dedicated panel with a live progress bar, per-email results (sorted / skipped / failed), running counts, and live per-key API usage cards. Includes **Cancel** and **Retry Failed only** controls, and re-syncs automatically if you reopen the tab
- ✅ **Parallel batch processing** - Emails are analyzed concurrently in chunks (**5 at a time** by default, configurable **1–20** in **Settings → General Settings**) so large batches finish much faster, with per-key usage counting kept correct
- ✅ **Bulk import Gemini API keys** - Paste many keys at once (one per line) into **Settings → Multiple Gemini API Keys → Bulk Import** with duplicate detection, instead of adding them one at a time
- ✅ **Toolbar popup** - Click the AutoSort+ toolbar icon for an at-a-glance API usage summary (aggregated across all Gemini keys) with quick buttons to open **Settings** and the **Batch Panel**
- ✅ **Dark mode** - Full dark-theme support across Settings, the popup, and the Batch Panel (follows your OS/Thunderbird color scheme)

</details>

<details>
<summary><b>🐛 Bug Fixes</b></summary>

- ✅ **Accurate AI call counting** - One email now uses exactly **one** API request; retries no longer re-analyze the same email (previously batches could over-consume quota)
- ✅ **More reliable email content extraction** - HTML bodies are now properly converted to text (the conversion is awaited) and messages without MIME parts are handled, so fewer emails are skipped
- ✅ **Fixed `rateLimit is undefined`** - Per-key Gemini usage is now normalized with safe defaults
- ✅ **Fixed usage race condition** - Concurrent requests could clobber the per-key daily counter; a lock now serializes reads/writes so batch usage is counted correctly

</details>

## 💖 Support the Project

I build this project in my free time and don't need donations for myself. If you'd like to give something back, I'd kindly ask you to donate to a charity of your choice instead — they need it far more than I do. If you still prefer to support me directly in private, thank you so much; it's genuinely appreciated, and I'll be happy to list you as a donor on GitHub and, where applicable, in a donors section of the project, as a small thank you.

[![Ko-Fi](https://img.shields.io/badge/Ko--Fi-Support%20me-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/nigel1992)
[![PayPal](https://img.shields.io/badge/PayPal-Donate-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://www.paypal.com/donate/?hosted_button_id=KYV9ARF99ZSCE)

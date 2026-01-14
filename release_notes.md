## AutoSort+ v1.2.3 - January 14, 2026

### ✨ New Features
- **Toolbar Icon** - Quick access button in top-right of Thunderbird
  - Click the AutoSort+ icon to instantly open settings
  - Hover for tooltip "AutoSort+ Settings"
  - No need to navigate through menus anymore

### 🎯 User Experience
- Faster settings access - one click from anywhere in Thunderbird
- Better addon visibility - always accessible in toolbar
- Tooltip provides clear button function

---

## AutoSort+ v1.2.2 - January 14, 2026

### 🐛 Bug Fixes
- **Fixed single-key usage tracking** - Now properly displays "Today's Usage:" when using only 1 Gemini API key
- **Fixed rate limit notification** - Persistent notification now shows when limit is reached on single or multiple keys
- **Improved API test feedback** - Shows specific error messages:
  - 429 error: "⛔ Limit reached" (key has exhausted daily quota)
  - 401/403 error: "✗ Invalid key" (key is invalid or expired)
  - Other errors: "✗ Failed (status code)"
- **Added tooltips** - Hover over test results to see detailed error explanations

### ✨ Improvements
- Better error messaging for API key testing
- More intuitive status indicators with help text
- Cursor changes to "help" icon when hovering over test results
- Single-key configurations now display in new multi-key format

---

## AutoSort+ v1.2.1 - January 14, 2026

### 🆕 New Features
- **Multiple Gemini API Key Support** - Add multiple API keys from different Google Cloud projects
- **Automatic Key Rotation** - Seamlessly switches between keys when rate limits are reached
- **Per-Key Usage Tracking** - Monitor usage statistics for each API key individually
- **Smart Key Management** - Visual indicators show which key is active and available

### 💡 How Multiple Keys Work
Free Gemini tier provides 20 requests/day per project. With multiple keys:
- Add keys from different Google Cloud projects
- Extension automatically rotates to next available key
- Example: 5 keys = 100 requests/day total
- Each key tracks its own rate limit independently

### 🔧 Improvements
- Enhanced UI for multi-key management
- Individual test buttons for each API key
- Real-time status indicators (Active, Ready, Near Limit, Limit Reached)
- Better error messages when all keys are exhausted
- Backward compatible with single-key configurations

### 🐛 Bug Fixes
- Fixed API key test function for Gemini keys
- Fixed test result display to show inline status per key
- Improved key validation feedback

---

## AutoSort+ v1.2.0

### ⚠️ Important Rate Limit Warning
**Free API tiers are severely limited when processing emails!** Email content is large text, which counts heavily against rate limits:

- **Gemini**: ~15-20 emails before hitting limits
- **OpenAI**: ~5-10 emails (very strict on free tier)
- **Anthropic**: ~10-15 emails
- **Groq**: ~20-30 emails (best free option)
- **Mistral**: ~10-15 emails

**For daily email processing, paid API plans are strongly recommended.**

Free tiers are suitable for:
- Occasional use (a few emails per day)
- Testing the addon
- Light personal email management

For regular use, consider:
- Upgrading to paid API tiers ($5-20/month)
- Processing emails in small batches with delays
- Using Groq for the highest free tier limits

### Features
- **Multi-provider AI support** (Gemini, OpenAI, Anthropic, Groq, Mistral)
- **IMAP folder discovery** - Automatically load folders from mail accounts
- **Batch email processing** - Select and sort multiple emails at once
- **Move history tracking** - Last 100 email moves recorded
- **Smart label matching** - Skips null categories, auto-creates custom folders
- **Professional UI** - Provider info cards, real-time validation

### Changes
- Added support for 5 AI providers with easy switching
- Updated Groq to llama-3.3-70b model
- Improved error handling and validation
- Fixed batch email processing bugs
- Enhanced folder management
- Added rate limit guidance

### Installation in Thunderbird
1. Download the autosortplus.xpi file
2. Open Thunderbird
3. Click the Menu button (☰) and select "Add-ons and Themes"
4. Click the gear icon and select "Install Add-on From File..."
5. Select the downloaded autosortplus.xpi file
6. Click "Add" when prompted to install the add-on
7. Restart Thunderbird when prompted

---

## AutoSort+ v1.0.0

### Features
- AI-powered email sorting
- Custom categories/folders management
- Gemini API integration
- Automatic email organization

### Changes
- Removed bulk actions
- Made AI sorting always enabled
- Improved UI with detailed AI description
- Updated terminology from labels to categories/folders

### Installation in Thunderbird
1. Download the autosortplus.xpi file
2. Open Thunderbird
3. Click the Menu button (☰) and select "Add-ons and Themes"
4. Click the gear icon and select "Install Add-on From File..."
5. Select the downloaded autosortplus.xpi file
6. Click "Add" when prompted to install the add-on
7. Restart Thunderbird when prompted 
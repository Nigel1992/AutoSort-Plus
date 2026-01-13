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
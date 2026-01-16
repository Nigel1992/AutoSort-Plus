# GitHub Release Instructions

## Step 1: Push the Tag
```bash
cd /home/nigel/AutoSort-Plus
git push origin v1.2.3.1-ollama-test
```

## Step 2: Create GitHub Release

1. Go to your GitHub repo: https://github.com/[YOUR_USERNAME]/AutoSort-Plus
2. Click **Releases** → **Draft a new release**
3. **Choose tag:** Select `v1.2.3.1-ollama-test`
4. **Release title:** `v1.2.3.1-ollama-test - Ollama Local AI Support (TEST)`
5. **Description:** Copy content from `RELEASE_NOTES_OLLAMA_TEST.md`
6. **Attach binary:** Upload `autosortplus.xpi`
7. ✅ Check **"This is a pre-release"**
8. Click **Publish release**

## Step 3: Get the Link

After publishing, your download link will be:
```
https://github.com/[YOUR_USERNAME]/AutoSort-Plus/releases/download/v1.2.3.1-ollama-test/autosortplus.xpi
```

## Step 4: Update Reddit Post

Replace `[**Download XPI from GitHub**](https://github.com/yourusername/AutoSort-Plus/releases/tag/v1.2.3.1-ollama-test)` with your actual GitHub username and release link.

## Files Ready to Upload:
✅ autosortplus.xpi (58KB)
✅ RELEASE_NOTES_OLLAMA_TEST.md (for release description)
✅ REDDIT_POST.md (ready to post)

---

## Quick Copy-Paste for Reddit Reply:

**Reply to the Ollama request:**

> Hey! Great news - I just added Ollama support in a test release! 🎉
> 
> You can now use **any local Ollama model** (llama3.2, tinyllama, phi, gemma, etc.) for email classification. No API keys, no rate limits, completely private.
> 
> **Download:** https://github.com/[YOUR_USERNAME]/AutoSort-Plus/releases/tag/v1.2.3.1-ollama-test
> 
> Setup is simple:
> 1. Install Ollama: https://ollama.com/download
> 2. Pull a model: `ollama pull tinyllama`
> 3. Install the XPI
> 4. Select "Ollama" in settings
> 
> This is a test release, so please let me know if you hit any issues! Full debugging guide in the release notes.
> 
> Would love to hear what models work best for you!

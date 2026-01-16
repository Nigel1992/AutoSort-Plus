# GitHub Issues Template Guide

This project uses GitHub issue templates to help developers and users report issues effectively for a Thunderbird extension with Ollama integration.

## Available Templates

### 🐛 [bug_ollama.md](bug_ollama.md)
**For:** Bugs related to Ollama integration, AI analysis failures, or general issues

**Includes:**
- Thunderbird version & OS details
- Ollama setup info (version, model, GPU/CPU)
- Console output collection
- Automated debugging checklist
- Manual testing steps (curl commands)
- Tab injection investigation notes

**Best for:**
- "Analysis is failing with error X"
- "403 Forbidden errors"
- "Model not responding"
- "Extension crashes"

---

### ✨ [feature_ollama.md](feature_ollama.md)
**For:** Feature requests for Ollama, AI providers, or Thunderbird extension capabilities

**Includes:**
- Motivation & use case
- Proposed solution
- Provider-specific concerns
- Performance implications
- Thunderbird version requirements

**Best for:**
- "Add streaming support"
- "Support for new model X"
- "Batch email analysis"
- "Custom model parameters"

---

### ❓ [question.md](question.md)
**For:** Setup help, usage questions, troubleshooting guidance

**Includes:**
- Environment details
- Troubleshooting checklist
- Quick Ollama/Thunderbird tests
- Pre-submission checks

**Best for:**
- "How do I set up Ollama?"
- "Which model should I use?"
- "Why isn't test connection working?"

---

## Why These Templates?

### For Thunderbird Extension Development:
1. **Environment tracking** - Thunderbird version compatibility is critical
2. **API context** - Know which Thunderbird APIs are involved
3. **Permission issues** - Track manifest.json changes needed

### For Ollama Integration:
1. **Model specificity** - Different models behave differently
2. **Hardware context** - CPU vs GPU significantly affects performance
3. **API validation** - Can test Ollama directly with curl

### For Better Bug Reports:
1. **Automated checklist** - Ensures basics are tested first
2. **Console logs** - Captures [Ollama] debug messages
3. **Reproduction steps** - Clear steps to recreate issues
4. **Debugging commands** - Ready-to-use testing

---

## How to Use These Templates

### Creating an Issue:
1. Go to **Issues** → **New issue**
2. Click **Choose a template**
3. Select the appropriate template
4. Fill in all sections (red asterisks = required)
5. Include console logs if applicable

### Submitting a Bug Report:
```bash
# First, test these commands:
curl http://localhost:11434/api/tags                    # Check Ollama is running
ollama run tinyllama "test"                              # Test model directly
# Then open browser console (Ctrl+Shift+J) and analyze email
# Copy all [Ollama] messages and include in issue
```

### For Contributors:
When reviewing issues:
1. Check if all environment details are present
2. Ask for console logs if missing
3. Request reproduction steps if unclear
4. Reference Thunderbird version for API compat issues

---

## Template Structure

Each template includes:
- **Clear section headers** for organization
- **Checkboxes** for verification steps
- **Code blocks** for logs and commands
- **Context-specific questions** for the extension type
- **Debugging aids** (curl commands, env info)
- **Examples** of what to include

---

## Customization

To modify templates for your specific needs:
1. Edit `.github/ISSUE_TEMPLATE/bug_ollama.md`
2. Add/remove sections as needed
3. Update labels, assignees, or default title
4. Commit and push - changes apply immediately

---

## Best Practices

✅ **DO:**
- Include full environment details
- Run curl commands to verify Ollama
- Copy console logs with [Ollama] tags
- Test with different models if applicable
- Mention Thunderbird version

❌ **DON'T:**
- Skip the debugging checklist
- Submit without testing curl commands
- Hide Thunderbird or Ollama version
- Include credentials or API keys
- Use screenshot instead of error text

---

## Quick Reference

| Issue Type | Template | When to Use |
|-----------|----------|------------|
| Extension crash | `bug_ollama.md` | Error messages or failed analysis |
| Setup help | `question.md` | "How do I..." or troubleshooting |
| New feature | `feature_ollama.md` | Enhancement ideas |
| General bug | `bug_ollama.md` | Unexpected behavior |

---

## Support

For questions about the templates:
1. Check existing issues
2. Review this guide
3. Ask in a new issue using `question.md`

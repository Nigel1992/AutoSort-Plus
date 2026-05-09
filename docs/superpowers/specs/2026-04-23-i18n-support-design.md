# i18n Support Design

## Overview

Add English and Chinese (zh-CN) localization to AutoSort+ Thunderbird extension using Thunderbird's built-in `_locales/` system.

## Architecture

### Locale Files
- `_locales/en/messages.json` — English (default)
- `_locales/zh_CN/messages.json` — Simplified Chinese

### Manifest
- Added `"default_locale": "en"` to enable Thunderbird i18n
- Manifest strings (description, default_title) use `__MSG_key__` syntax

### HTML Translation
- All user-facing text in `options.html` uses `data-i18n="key"` attributes for text content
- `data-i18n-placeholder="key"` for input placeholders
- `data-i18n-title="key"` for title attributes
- Translation applied at page load via `applyTranslations()` helper

### JavaScript Translation Helper
- `js/i18n.js` — lightweight wrapper around `browser.i18n.getMessage()`
- `i18n.get(key)` — returns localized string, falls back to key if missing
- `applyTranslations()` — scans DOM for `data-i18n*` attributes and replaces text

### Dynamic Strings
- Provider info, test results, status messages use `i18n.get('key', 'fallback')` inline
- Console.log messages left untranslated (developer-facing)

## Scope

**Translated**: HTML labels, buttons, headers, placeholders, status messages, provider names, help text
**Not Translated**: console.log output, internal error messages, code identifiers

## Language Detection

Thunderbird auto-detects browser locale. No manual language switch in UI. Users change language via Thunderbird settings.

## Files Changed
- `_locales/en/messages.json` (new)
- `_locales/zh_CN/messages.json` (new)
- `js/i18n.js` (new)
- `manifest.json` (added default_locale, MSG placeholders)
- `options.html` (added data-i18n attributes, included i18n.js)
- `options.js` (added applyTranslations() call, i18n.get() for dynamic strings)

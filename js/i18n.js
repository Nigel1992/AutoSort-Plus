/**
 * Lightweight i18n helper for Thunderbird extensions.
 * Uses browser.i18n.getMessage() for localized strings.
 */
const i18n = {
    /**
     * Get a localized string by message key.
     * Falls back to the key itself if message not found.
     */
    get(key, substitutions) {
        try {
            const msg = browser.i18n.getMessage(key, substitutions);
            return msg || key;
        } catch (e) {
            return key;
        }
    }
};

/**
 * Translate all elements with data-i18n attributes on page load.
 * - data-i18n="key" → sets textContent
 * - data-i18n-placeholder="key" → sets placeholder
 * - data-i18n-title="key" → sets title
 */
function applyTranslations() {
    // Translate text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = i18n.get(key);
    });

    // Translate placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = i18n.get(key);
    });

    // Translate titles
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = i18n.get(key);
    });
}

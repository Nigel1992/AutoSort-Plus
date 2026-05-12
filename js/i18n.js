/**
 * Lightweight i18n helper for Thunderbird extensions.
 * Uses browser.i18n.getMessage() for localized strings with manual {key} substitution.
 * browser.i18n.getMessage only supports $1/$2 positional syntax — our messages use {key}.
 */
const i18n = {
    /** Placeholder name → array-index mapping for every key with placeholders.
     *  Generated from messages.json placeholder definitions. */
    _placeholders: {
        andMore: ['count'],
        apiError: ['error'],
        availableModels: ['models'],
        batchCancelledChunk: ['current', 'total', 'done', 'totalItems'],
        batchCancelledSimple: ['done', 'totalItems'],
        batchDone: ['completed', 'skipped', 'failed'],
        batchPausedChunk: ['current', 'total', 'done', 'totalItems'],
        batchPausedSimple: ['done', 'totalItems'],
        batchRunningChunk: ['current', 'total', 'done', 'totalItems', 'completed', 'failed'],
        batchRunningSimple: ['done', 'totalItems', 'completed', 'failed'],
        connectedModelReady: ['model', 'available'],
        connectedSuccessfully: ['model', 'url'],
        connectionError: ['error'],
        customConnectionFailed: ['error'],
        customPromptEmailLabel: ['body'],
        customPromptTip: ['subject', 'attachments'],
        diagnosticsApiUrl: ['url'],
        downloadFailed: ['error'],
        errorLoadingFolders: ['error'],
        errorSavingSettings: ['error'],
        failedFetchModels: ['error'],
        failedStart: ['error'],
        folderFoundText: ['count'],
        foundModelsMsg: ['count'],
        geminiDailyCount: ['count'],
        genericErrorLabel: ['error'],
        hoursAgo: ['count', 'plural'],
        hoursAgoShort: ['count'],
        importedFoldersMsg: ['count'],
        inHours: ['count', 'plural'],
        inHoursShort: ['count'],
        keyLabel: ['number'],
        loadedFoldersMsg: ['count'],
        minutesAgo: ['count', 'plural'],
        minutesAgoShort: ['count'],
        modelNotInstalled: ['model', 'available'],
        ollamaConnectionFailed: ['error'],
        ollamaConnectionFailedSimple: ['error'],
        ollamaCurlTest: ['url'],
        ollamaErrorLabel: ['error'],
        pleaseConfigure: ['items'],
        pleaseVisit: ['url'],
        removeApiKeyConfirm: ['number'],
        replaceExistingConfirm: ['existing', 'new'],
        replaceFoldersConfirm: ['count'],
        settingsSavedOllama: ['cpuMode'],
        startingDownload: ['model'],
        testFailed: ['status'],
        troubleshootTest: ['url'],
        urlCopied: ['url'],
    },

    /**
     * Get a localized string by message key.
     * @param {string} key - message key
     * @param {Object|Array} [substitutions] - named {key:value} or positional array
     */
    get(key, substitutions) {
        try {
            // Get raw message template (no substitution — we handle {key} ourselves)
            let msg = browser.i18n.getMessage(key);
            if (!msg) return key;

            // Convert array → object using known placeholder mapping
            if (Array.isArray(substitutions)) {
                const names = this._placeholders[key];
                if (names) {
                    substitutions = Object.fromEntries(
                        names.map((name, i) => [name, substitutions[i]])
                    );
                }
            }

            // Replace {key} → value
            if (substitutions && typeof substitutions === 'object') {
                msg = msg.replace(/\{(\w+)\}/g, (_, k) => substitutions[k] ?? `{${k}}`);
            }

            return msg;
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

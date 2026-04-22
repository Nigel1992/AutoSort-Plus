/**
 * DebugLogger - Centralized debug logging for AutoSort+
 * Uses browser.storage.local for cross-context synchronization
 */

class DebugLogger {
    constructor() {
        this.enabled = false;
        this.isReady = false;
        this.queue = [];
        this.listenForChanges();
    }

    async init() {
        try {
            const result = await browser.storage.local.get('debugMode');
            this.enabled = !!result.debugMode;
            this.isReady = true;
            this.flushQueue();
        } catch (e) {
            this.isReady = true;
        }
    }

    listenForChanges() {
        if (typeof browser !== 'undefined' && browser.storage && browser.storage.onChanged) {
            browser.storage.onChanged.addListener((changes, area) => {
                if (area === 'local' && changes.debugMode !== undefined) {
                    this.enabled = !!changes.debugMode.newValue;
                }
            });
        }
    }

    async enable() {
        this.enabled = true;
        if (typeof browser === 'undefined' || !browser.storage) return;
        try {
            await browser.storage.local.set({ debugMode: true });
        } catch (e) {}
    }

    async disable() {
        this.enabled = false;
        if (typeof browser === 'undefined' || !browser.storage) return;
        try {
            await browser.storage.local.set({ debugMode: false });
        } catch (e) {}
    }

    flushQueue() {
        if (this.enabled && this.queue.length > 0) {
            this.queue.forEach(log => {
                const style = this.getTagStyle(log.tag);
                console[log.type](`%c${log.tag}`, style, log.message, log.data || '');
            });
        }
        this.queue = [];
    }

    getTagStyle(tag) {
        if (tag.includes('Error') || tag.includes('error')) {
            return 'color: white; background: #F44336; padding: 2px 6px; border-radius: 4px;';
        }
        if (tag.includes('API')) {
            return 'color: white; background: #9C27B0; padding: 2px 6px; border-radius: 4px;';
        }
        if (tag.includes('RateLimit') || tag.includes('warn') || tag.includes('Warning')) {
            return 'color: #333; background: #FFC107; padding: 2px 6px; border-radius: 4px;';
        }
        if (tag.includes('Folder')) {
            return 'color: white; background: #009688; padding: 2px 6px; border-radius: 4px;';
        }
        return 'color: white; background: #2196F3; padding: 2px 6px; border-radius: 4px;';
    }

    enqueueOrLog(type, tag, message, data) {
        if (!this.isReady) {
            this.queue.push({ type, tag, message, data });
            return;
        }
        if (this.enabled) {
            const style = this.getTagStyle(tag);
            if (data !== null && data !== undefined) {
                console[type](`%c${tag}`, style, message, data);
            } else {
                console[type](`%c${tag}`, style, message);
            }
        }
    }

    info(tag, message, data = null) {
        this.enqueueOrLog('info', tag, message, data);
    }

    warn(tag, message, data = null) {
        this.enqueueOrLog('warn', tag, message, data);
    }

    error(tag, message, data = null) {
        if (!this.isReady) {
            this.queue.push({ type: 'error', tag, message, data });
            return;
        }
        const style = 'color: white; background: #F44336; padding: 2px 6px; border-radius: 4px;';
        console.error(`%c${tag}`, style, message, data !== null && data !== undefined ? data : '');
    }

    apiRequest(provider, url, requestBody) {
        if (!this.isReady) return; // Skip queue - API logs are immediate-only
        if (this.enabled) {
            console.groupCollapsed(`%c[API: ${provider}] Request`, 'color: #9C27B0; font-weight: bold;');
            console.log('URL:', url);
            console.log('Request Body:', requestBody);
            console.groupEnd();
        }
    }

    apiResponse(provider, status, data) {
        if (!this.isReady) return; // Skip queue - API logs are immediate-only
        if (this.enabled) {
            const isSuccess = status >= 200 && status < 300;
            const color = isSuccess ? '#4CAF50' : '#F44336';
            const icon = isSuccess ? '✅' : '❌';
            console.groupCollapsed(`%c[API: ${provider}] ${icon} Response (${status})`, `color: ${color}; font-weight: bold;`);
            console.log('Response Data:', data);
            console.groupEnd();
        }
    }

    log(tag, message, data = null) {
        this.info(tag, message, data);
    }
}

const logger = new DebugLogger();

if (typeof window !== 'undefined') {
    window.debugLogger = logger;
}
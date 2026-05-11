/**
 * Simple toast notification helper for AutoSort+
 */

if (!window.AutoSortPlus) window.AutoSortPlus = {};

window.AutoSortPlus.toast = {
    show(message, type = 'info', duration = 3000) {
        const el = document.createElement('div');
        el.className = 'message';
        el.textContent = message;
        const colors = { success: '#4CAF50', error: '#f44336', info: '#0060df' };
        el.style.backgroundColor = colors[type] || colors.info;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), duration);
    },
    success(msg) { this.show(msg, 'success'); },
    error(msg) { this.show(msg, 'error'); },
    info(msg) { this.show(msg, 'info'); }
};

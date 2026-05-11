if (!window.AutoSortPlus) window.AutoSortPlus = {};

window.AutoSortPlus.notification = {
  async show(title, message, type = 'basic') {
    if (window.debugLogger) window.debugLogger.info('[AutoSort+]', `${title}: ${message}`);
    try {
      if (messenger.notifications?.create) {
        const id = `autosort-${Date.now()}`;
        await messenger.notifications.create(id, {
          type, iconUrl: messenger.runtime.getURL('icons/icon-48.png'),
          title, message, eventTime: Date.now(), priority: 2, requireInteraction: true
        });
        return id;
      }
    } catch (e) {}
    return null;
  },

  async update(id, title, message) {
    if (window.debugLogger) window.debugLogger.info('[AutoSort+]', `${title}: ${message}`);
    try { if (messenger.notifications?.clear && id) await messenger.notifications.clear(id); } catch (e) {}
    return this.show(title, message);
  }
};

if (!window.AutoSortPlus) window.AutoSortPlus = {};

window.AutoSortPlus.storage = {
  async get(keys) {
    const result = await messenger.storage.local.get(keys);
    // Migration: default autoSortEnabled to true
    if (Array.isArray(keys) && keys.includes('autoSortEnabled') && result.autoSortEnabled === undefined) {
      result.autoSortEnabled = true;
    } else if (typeof keys === 'object' && !Array.isArray(keys) && keys.autoSortEnabled !== undefined && result.autoSortEnabled === undefined) {
      result.autoSortEnabled = true;
    }
    return result;
  },

  async set(data) {
    await messenger.storage.local.set(data);
  },

  async remove(keys) {
    await messenger.storage.local.remove(keys);
  }
};

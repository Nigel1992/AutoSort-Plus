if (!window.AutoSortPlus) window.AutoSortPlus = {};

window.AutoSortPlus.tabFetch = {
  async fetchViaTab(baseUrl, options) {
    const tab = await messenger.tabs.create({ url: baseUrl, active: false });
    const resultKey = `autosort_fetch_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        messenger.tabs.remove(tab.id).catch(() => {});
        reject(new Error('Tab fetch timeout (30s)'));
      }, 30000);

      const listener = (msg) => {
        if (msg.action === resultKey) {
          messenger.runtime.onMessage.removeListener(listener);
          clearTimeout(timeout);
          messenger.tabs.remove(tab.id).catch(() => {});
          resolve(msg.result);
        }
      };
      messenger.runtime.onMessage.addListener(listener);

      // Step 1: Set config via func+args
      messenger.scripting.executeScript({
        target: { tabId: tab.id },
        func: (cfg) => { window.__autosort_config = cfg; },
        args: [{
          baseUrl,
          endpoint: options.endpoint,
          headers: options.headers,
          body: options.body,
          resultKey,
          stream: options.stream || false
        }]
      }).then(() => {
        // Step 2: Inject execution script
        messenger.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/utils/injected-fetch.js']
        }).catch(reject);
      }).catch(reject);
    });
  }
};

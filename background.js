// background.js (MV3 thin entry)
// Loaded after all src/ modules in manifest.scripts order.
// All dependencies (AutoSortPlus.*) are already available on the global object.

(function() {
  // ── Browser action ──
  if (messenger.action) {
    messenger.action.onClicked.addListener(() => {
      messenger.runtime.openOptionsPage();
    });
  }

  // ── Auto-sort ──
  if (AutoSortPlus.autoSort) AutoSortPlus.autoSort.register();

  // ── Context menus ──
  messenger.menus.create({ id: 'autosort-label', title: 'AutoSort+ Label', contexts: ['message_list'] });
  messenger.menus.create({ id: 'autosort-analyze', title: 'AutoSort+ Analyze with AI', contexts: ['message_list'] });

  // ── Label submenu rebuild ──
  function rebuildLabelSubmenu(labels) {
    // Remove existing label menu items
    messenger.menus.getAll().then(existingItems => {
      for (const item of existingItems) {
        if (item.parentId === 'autosort-label') {
          messenger.menus.remove(item.id);
        }
      }
      // Create new label menu items
      if (labels && labels.length > 0) {
        for (const label of labels) {
          messenger.menus.create({
            id: `label-${label}`, parentId: 'autosort-label',
            title: label, contexts: ['message_list']
          });
        }
      }
    }).catch(() => {});
  }

  // Initial label menu setup
  messenger.storage.local.get(['labels']).then(result => {
    rebuildLabelSubmenu(result.labels);
  });

  // Update menu when labels change
  messenger.storage.onChanged.addListener((changes) => {
    if (changes.labels) rebuildLabelSubmenu(changes.labels.newValue);
  });

  // ── Message handler ──
  messenger.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'applyLabels') {
      if (AutoSortPlus.engine) {
        AutoSortPlus.engine.applyLabels(message.messages, message.label)
          .then(() => sendResponse({ ok: true }))
          .catch(err => sendResponse({ ok: false, error: err.message }));
      } else {
        sendResponse({ ok: false, error: 'Engine not loaded' });
      }
      return true;
    } else if (message.action === 'analyzeEmail') {
      if (AutoSortPlus.engine) {
        AutoSortPlus.engine.analyzeEmail(message.emailContent, message.emailContext).then(label => {
          sendResponse({ label });
        });
      } else {
        sendResponse({ error: 'Engine not loaded' });
      }
      return true;
    } else if (message.action === 'startOllamaPull') {
      (async () => {
        try {
          const { ollamaUrl, model, headers } = message;
          if (AutoSortPlus.tabFetch) {
            const { response } = await AutoSortPlus.tabFetch.fetchViaTab(ollamaUrl, {
              endpoint: '/api/pull', body: { name: model, stream: true }, headers, stream: true
            });
            sendResponse(response || { ok: true });
          }
        } catch (e) { sendResponse({ ok: false, error: e.message }); }
      })();
      return true;
    } else if (message.action === 'batchControl') {
      if (AutoSortPlus.engine && AutoSortPlus.engine._batchState) {
        const state = AutoSortPlus.engine._batchState;
        if (message.command === 'pause') state.paused = true;
        else if (message.command === 'resume') state.paused = false;
        else if (message.command === 'cancel') { state.cancelled = true; state.paused = false; }
      }
      sendResponse({ ok: true });
    }
  });

  // ── Menu click handler ──
  messenger.menus.onClicked.addListener(async (info, tab) => {
    if (info.parentMenuItemId === 'autosort-label') {
      const label = info.menuItemId.replace('label-', '');
      if (window.debugLogger) window.debugLogger.info('[AutoSort+]', `Manual label: ${label}`);
      await AutoSortPlus.notification.show('AutoSort+', `Applying label: ${label}`);
      try {
        const mailTabs = await messenger.mailTabs.query({ active: true, currentWindow: true });
        if (mailTabs && mailTabs.length > 0) {
          const messages = await messenger.mailTabs.getSelectedMessages(mailTabs[0].id);
          if (messages && messages.messages && messages.messages.length > 0) {
            await AutoSortPlus.engine.applyLabels(messages.messages, label);
            if (AutoSortPlus.engine) {
              await AutoSortPlus.engine.recordManualLabel(messages.messages, label);
            }
          } else {
            await AutoSortPlus.notification.show('AutoSort+ Error', 'No messages selected.');
          }
        } else {
          await AutoSortPlus.notification.show('AutoSort+ Error', 'No active mail tab found.');
        }
      } catch (error) {
        await AutoSortPlus.notification.show('AutoSort+ Error', `Error: ${error.message}`);
      }
    } else if (info.menuItemId === 'autosort-analyze') {
      if (window.debugLogger) window.debugLogger.info('[AutoSort+]', 'AI analysis - starting batch');
      try {
        if (AutoSortPlus.engine && !AutoSortPlus.engine._acquireBatchLock()) {
          await AutoSortPlus.notification.show('AutoSort+ Busy', 'A batch is already in progress.');
          return;
        }

        const mailTabs = await messenger.mailTabs.query({ active: true, currentWindow: true });
        if (!mailTabs || mailTabs.length === 0) {
          await AutoSortPlus.notification.show('AutoSort+ Error', 'No active mail tab found');
          if (AutoSortPlus.engine) AutoSortPlus.engine._releaseBatchLock();
          return;
        }

        const selectedMessageList = await messenger.mailTabs.getSelectedMessages(mailTabs[0].id);
        if (!selectedMessageList || !selectedMessageList.messages || selectedMessageList.messages.length === 0) {
          await AutoSortPlus.notification.show('AutoSort+ Error', 'No messages selected');
          if (AutoSortPlus.engine) AutoSortPlus.engine._releaseBatchLock();
          return;
        }

        const messages = selectedMessageList.messages;
        await AutoSortPlus.notification.show('AutoSort+ Batch', `Starting AI analysis of ${messages.length} email(s)...`);

        if (AutoSortPlus.engine) {
          AutoSortPlus.engine.batchAnalyzeEmails(messages).catch(err => {
            console.error('[AutoSort+] Batch analysis failed:', err);
            AutoSortPlus.engine._releaseBatchLock();
          });
        }
      } catch (error) {
        if (AutoSortPlus.engine) AutoSortPlus.engine._releaseBatchLock();
        await AutoSortPlus.notification.show('AutoSort+ Error', `Error: ${error.message}`);
      }
    }
  });
})();

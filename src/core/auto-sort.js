(function() {
  if (!window.AutoSortPlus) window.AutoSortPlus = {};

  async function classifyAndMove(message) {
    try {
      const fullMessage = await messenger.messages.getFull(message.id);
      if (!fullMessage) return;

      const emailContext = await AutoSortPlus.emailExtractor.extract(fullMessage, message);
      const emailContent = emailContext.body;
      if (!emailContent?.trim()) return;

      const label = await AutoSortPlus.engine.analyzeEmail(emailContent, emailContext);
      if (!label || String(label).trim().toLowerCase() === 'null') return;

      await AutoSortPlus.engine.applyLabels([message], label);

      if (window.debugLogger) window.debugLogger.info('[AutoSort]', `Auto-sorted message ${message.id} to ${label}`);
    } catch (err) {
      if (window.debugLogger) window.debugLogger.warn('[AutoSort]', `Failed to auto-sort message ${message.id}: ${err.message}`);
    }
  }

  async function handleNewMail(folder, messageList) {
    if (AutoSortPlus.engine && AutoSortPlus.engine._batchState && AutoSortPlus.engine._batchState.running) return;

    const settings = await AutoSortPlus.storage.get(['autoSortEnabled', 'enableAi', 'aiProvider']);
    if (settings.autoSortEnabled === false) return;
    if (settings.enableAi === false) return;
    if (!folder.specialUse?.includes('inbox')) return;

    const provider = settings.aiProvider || 'gemini';
    const batchConfig = AutoSortPlus.providers.PROVIDER_BATCH_CONFIG?.[provider] || { concurrency: 3 };
    const limit = batchConfig.concurrency || 3;

    if (window.debugLogger) window.debugLogger.info('[AutoSort]', `Processing new mail with concurrency=${limit} for provider=${provider}`);

    let page = messageList;
    while (true) {
      await AutoSortPlus.concurrency.processWithConcurrency(page.messages, classifyAndMove, limit);
      if (!page.id) break;
      page = await messenger.messages.continueList(page.id);
    }
  }

  window.AutoSortPlus.autoSort = {
    register() {
      messenger.messages.onNewMailReceived.addListener(handleNewMail, false);
    }
  };
})();

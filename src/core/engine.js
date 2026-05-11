if (!window.AutoSortPlus) window.AutoSortPlus = {};

window.AutoSortPlus.engine = {
  _batchState: null,
  _geminiRateLimitMutex: Promise.resolve(),

  // ───────────────────────────────────────────────────────────────────────
  // Batch State Management
  // ───────────────────────────────────────────────────────────────────────

  _resetBatchState(total, provider) {
    this._batchState = {
      running: true,
      cancelled: false,
      paused: false,
      total,
      completed: 0,
      failed: 0,
      skipped: 0,
      provider,
      chunkIndex: 0,
      totalChunks: 0,
      startTime: Date.now(),
      chunkTimes: [],
      avgChunkTime: 0
    };
  },

  _acquireBatchLock() {
    if (this._batchState && this._batchState.running) return false;
    if (!this._batchState) {
      this._batchState = { running: true, cancelled: false, paused: false, total: 0, completed: 0, failed: 0, skipped: 0, provider: '', chunkIndex: 0, totalChunks: 0, startTime: Date.now(), chunkTimes: [], avgChunkTime: 0 };
    } else {
      this._batchState.running = true;
    }
    return true;
  },

  _releaseBatchLock() {
    if (this._batchState) this._batchState.running = false;
  },

  async _broadcastBatchProgress(status = 'running') {
    const remainingChunks = this._batchState.totalChunks - this._batchState.chunkIndex;
    const etaMs = remainingChunks * this._batchState.avgChunkTime;
    const payload = {
      action: 'batchProgress',
      status,
      total: this._batchState.total,
      completed: this._batchState.completed,
      failed: this._batchState.failed,
      skipped: this._batchState.skipped,
      provider: this._batchState.provider,
      chunkIndex: this._batchState.chunkIndex,
      totalChunks: this._batchState.totalChunks,
      startTime: this._batchState.startTime,
      chunkTimes: this._batchState.chunkTimes,
      avgChunkTime: this._batchState.avgChunkTime,
      etaMs
    };
    try {
      await AutoSortPlus.storage.set({ currentBatch: { ...payload, startTime: Date.now() } });
      await messenger.runtime.sendMessage(payload).catch(() => {});
    } catch (e) {
      // Ignore - options page may not be open
    }
  },

  async _waitWhilePaused() {
    while (this._batchState.paused && !this._batchState.cancelled) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return !this._batchState.cancelled;
  },

  _nextUtcMidnight() {
    const d = new Date(Date.now());
    d.setUTCHours(24, 0, 0, 0);
    return d.getTime();
  },

  // ───────────────────────────────────────────────────────────────────────
  // Gemini Rate Limiting (free tier: 5/min, 20/day per key)
  // ───────────────────────────────────────────────────────────────────────

  async checkAndTrackGeminiRateLimit(keyIndex = null) {
    this._geminiRateLimitMutex = this._geminiRateLimitMutex.then(async () => {
      const now = Date.now();
      const data = await AutoSortPlus.storage.get([
        'geminiApiKeys', 'geminiRateLimits', 'currentGeminiKeyIndex',
        'geminiPaidPlan', 'geminiRateLimit'
      ]);

      if (data.geminiPaidPlan) {
        return { allowed: true, waitTime: 0, keyIndex: keyIndex ?? 0 };
      }

      // Multi-key mode
      if (data.geminiApiKeys?.length > 0) {
        const keys = data.geminiApiKeys;
        const rateLimits = data.geminiRateLimits || keys.map(() => ({
          requests: [], dailyCount: 0, dailyResetTime: this._nextUtcMidnight()
        }));
        let currentIndex = keyIndex ?? (data.currentGeminiKeyIndex || 0);
        const startIndex = currentIndex;
        let attempts = 0;

        while (attempts < keys.length) {
          const rateLimit = rateLimits[currentIndex];
          if (now > rateLimit.dailyResetTime) {
            rateLimit.dailyCount = 0;
            rateLimit.dailyResetTime = this._nextUtcMidnight();
            rateLimit.requests = [];
          }
          const oneMinuteAgo = now - 60000;
          rateLimit.requests = rateLimit.requests.filter(t => t > oneMinuteAgo);

          if (rateLimit.dailyCount < 20) {
            if (rateLimit.requests.length > 0) {
              const lastRequest = Math.max(...rateLimit.requests);
              const timeSinceLastRequest = now - lastRequest;
              const minInterval = 12000;
              if (timeSinceLastRequest < minInterval) {
                const waitTime = Math.ceil((minInterval - timeSinceLastRequest) / 1000);
                rateLimit.requests.push(now);
                rateLimit.dailyCount += 1;
                await AutoSortPlus.storage.set({ currentGeminiKeyIndex: currentIndex, geminiRateLimits: rateLimits });
                if (window.debugLogger) window.debugLogger.info('[RateLimit]', `Gemini Key #${currentIndex + 1}: ${rateLimit.dailyCount}/20 today, ${rateLimit.requests.length} in last minute`);
                return { allowed: true, waitTime, keyIndex: currentIndex };
              }
            }
            rateLimit.requests.push(now);
            rateLimit.dailyCount += 1;
            await AutoSortPlus.storage.set({ currentGeminiKeyIndex: currentIndex, geminiRateLimits: rateLimits });
            if (window.debugLogger) window.debugLogger.info('[RateLimit]', `Gemini Key #${currentIndex + 1}: ${rateLimit.dailyCount}/20 today, ${rateLimit.requests.length} in last minute`);
            return { allowed: true, waitTime: 0, keyIndex: currentIndex };
          }
          currentIndex = (currentIndex + 1) % keys.length;
          attempts++;
        }
        return { allowed: false, message: `All ${keys.length} Gemini API keys have reached their daily limit (20/day each). Please wait for reset or add more API keys in settings.` };
      }

      // Legacy single-key mode
      const utcReset = this._nextUtcMidnight();
      const rateLimit = data.geminiRateLimit || { requests: [], dailyCount: 0, dailyResetTime: utcReset };
      if (now > rateLimit.dailyResetTime) {
        rateLimit.dailyCount = 0;
        rateLimit.dailyResetTime = utcReset;
        rateLimit.requests = [];
      }
      if (rateLimit.dailyCount >= 20) {
        const hoursUntilReset = Math.ceil((rateLimit.dailyResetTime - now) / (1000 * 60 * 60));
        return { allowed: false, message: `Gemini free tier daily limit reached (20/day). Resets in ${hoursUntilReset} hours. Upgrade to paid plan or add multiple API keys in settings to remove limits.` };
      }
      const oneMinuteAgo = now - 60000;
      rateLimit.requests = rateLimit.requests.filter(t => t > oneMinuteAgo);
      if (rateLimit.requests.length > 0) {
        const lastRequest = Math.max(...rateLimit.requests);
        const timeSinceLastRequest = now - lastRequest;
        const minInterval = 12000;
        if (timeSinceLastRequest < minInterval) {
          const waitTime = Math.ceil((minInterval - timeSinceLastRequest) / 1000);
          rateLimit.requests.push(now);
          rateLimit.dailyCount += 1;
          await AutoSortPlus.storage.set({ geminiRateLimit: rateLimit });
          if (window.debugLogger) window.debugLogger.info('[RateLimit]', `Gemini requests: ${rateLimit.dailyCount}/20 today, ${rateLimit.requests.length} in last minute`);
          return { allowed: true, waitTime, keyIndex: null };
        }
      }
      rateLimit.requests.push(now);
      rateLimit.dailyCount += 1;
      await AutoSortPlus.storage.set({ geminiRateLimit: rateLimit });
      if (window.debugLogger) window.debugLogger.info('[RateLimit]', `Gemini requests: ${rateLimit.dailyCount}/20 today, ${rateLimit.requests.length} in last minute`);
      return { allowed: true, waitTime: 0, keyIndex: null };
    }).catch(err => {
      console.error('[RateLimit] Mutex error, resetting lock:', err.message);
      this._geminiRateLimitMutex = Promise.resolve();
      throw err;
    });
    return this._geminiRateLimitMutex;
  },

  // ───────────────────────────────────────────────────────────────────────
  // Batch Engine
  // ───────────────────────────────────────────────────────────────────────

  async batchAnalyzeEmails(messages) {
    const settingsData = await AutoSortPlus.storage.get(['aiProvider', 'batchChunkSize']);
    const provider = settingsData.aiProvider || 'gemini';
    const chunkSize = settingsData.batchChunkSize || 5;

    this._resetBatchState(messages.length, provider);
    await this._broadcastBatchProgress('running');

    if (window.debugLogger) {
      window.debugLogger.info('[Batch]', `Starting batch: ${messages.length} emails, provider=${provider}, chunkSize=${chunkSize}`);
    }

    const self = this;

    async function processOne(message) {
      if (self._batchState.cancelled) return;
      if (self._batchState.paused) {
        const resumed = await self._waitWhilePaused();
        if (!resumed) return;
      }

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const fullMessage = await messenger.messages.getFull(message.id);
          if (!fullMessage) { self._batchState.skipped++; return; }

          const emailContext = await AutoSortPlus.emailExtractor.extract(fullMessage, message);
          const emailContent = emailContext.body;
          if (!emailContent || !emailContent.trim()) { self._batchState.skipped++; return; }

          const label = await self.analyzeEmail(emailContent, emailContext);
          if (!label || String(label).trim().toLowerCase() === 'null') { self._batchState.skipped++; return; }

          await self.applyLabels([message], label);
          self._batchState.completed++;
          return;
        } catch (err) {
          if (window.debugLogger) window.debugLogger.warn('[Batch]', `Attempt ${attempt} failed for msg ${message.id}: ${err.message}`);
          if (attempt === 2) {
            self._batchState.failed++;
            console.error(`[Batch] Message ${message.id} failed after retry:`, err.message);
          } else {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
      }
    }

    const totalChunks = Math.ceil(messages.length / chunkSize);
    this._batchState.totalChunks = totalChunks;

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (this._batchState.cancelled) break;
      while (this._batchState.paused && !this._batchState.cancelled) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      if (this._batchState.cancelled) break;

      const chunkStart = chunkIndex * chunkSize;
      const chunkEnd = Math.min(chunkStart + chunkSize, messages.length);
      const chunkMessages = messages.slice(chunkStart, chunkEnd);

      if (window.debugLogger) {
        window.debugLogger.info('[Batch]', `Processing chunk ${chunkIndex + 1}/${totalChunks} (emails ${chunkStart + 1}-${chunkEnd} of ${messages.length})`);
      }

      const chunkStartMs = Date.now();
      const chunkPromises = chunkMessages.map(msg => processOne(msg));
      await Promise.allSettled(chunkPromises);
      const chunkElapsed = Date.now() - chunkStartMs;

      this._batchState.chunkTimes.push(chunkElapsed);
      const recentTimes = this._batchState.chunkTimes.slice(-10);
      this._batchState.avgChunkTime = recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length;

      this._batchState.chunkIndex = chunkIndex + 1;
      await this._broadcastBatchProgress('running');
    }

    const finalStatus = this._batchState.cancelled ? 'cancelled' : 'done';
    this._batchState.running = false;
    await this._broadcastBatchProgress(finalStatus);

    setTimeout(async () => {
      await AutoSortPlus.storage.remove('currentBatch').catch(() => {});
    }, 6000);

    if (window.debugLogger) {
      window.debugLogger.info('[Batch]', `Batch ${finalStatus}: completed=${this._batchState.completed}, failed=${this._batchState.failed}, skipped=${this._batchState.skipped}`);
    }

    const { completed, failed, skipped, total } = this._batchState;
    if (finalStatus === 'cancelled') {
      await AutoSortPlus.notification.show('AutoSort+ Batch Cancelled', `Stopped after ${completed + failed + skipped}/${total} emails. Sorted: ${completed}, failed: ${failed}.`);
    } else if (failed === 0 && skipped === 0) {
      await AutoSortPlus.notification.show('AutoSort+ Batch Complete', `Successfully sorted all ${completed} emails.`);
    } else {
      await AutoSortPlus.notification.show('AutoSort+ Batch Complete', `Processed ${total} emails — sorted: ${completed}, skipped: ${skipped}, failed: ${failed}.`);
    }
  },

  // ───────────────────────────────────────────────────────────────────────
  // AI Analysis Dispatch + Response Parsing
  // ───────────────────────────────────────────────────────────────────────

  async analyzeEmail(emailContent, emailContext = null) {
    try {
      // Check for learned corrections first
      const correction = await AutoSortPlus.learning.findMatch(
        emailContext?.subject, emailContext?.author
      );
      if (correction) {
        if (window.debugLogger) {
          window.debugLogger.info('[Learning]', `Using learned correction: "${correction}" for "${emailContext?.subject}"`);
        }
        return correction;
      }

      const notificationId = await AutoSortPlus.notification.show('AutoSort+ AI Analysis', 'Starting email analysis...');

      const settings = await AutoSortPlus.storage.get([
        'apiKey', 'geminiApiKeys', 'currentGeminiKeyIndex', 'aiProvider',
        'labels', 'enableAi', 'geminiPaidPlan', 'geminiRateLimit',
        'geminiRateLimits', 'ollamaUrl', 'ollamaModel', 'ollamaCustomModel',
        'ollamaAuthToken', 'ollamaCpuOnly', 'ollamaNumCtx',
        'customBaseUrl', 'customModel', 'customPrompt'
      ]);
      const provider = settings.aiProvider || 'gemini';

      let keyIndexToUse = null;
      if (provider === 'gemini' && !settings.geminiPaidPlan) {
        const rateLimit = await this.checkAndTrackGeminiRateLimit();
        if (!rateLimit.allowed) {
          const isSingleKey = !settings.geminiApiKeys || settings.geminiApiKeys.length <= 1;
          const notifTitle = isSingleKey ? '⛔ Gemini API Limit Reached' : '⛔ All Gemini Keys at Limit';
          await AutoSortPlus.notification.show(notifTitle, rateLimit.message, 'list');
          if (notificationId) await AutoSortPlus.notification.update(notificationId, 'AutoSort+ Rate Limit', rateLimit.message);
          throw new Error(rateLimit.message);
        }
        if (rateLimit.waitTime > 0) {
          if (notificationId) await AutoSortPlus.notification.update(notificationId, 'AutoSort+ Rate Limit', `Rate limit reached. Waiting ${rateLimit.waitTime} seconds...`);
          await new Promise(resolve => setTimeout(resolve, rateLimit.waitTime * 1000));
        }
        keyIndexToUse = rateLimit.keyIndex;
      }

      if (window.debugLogger) {
        window.debugLogger.info('[AutoSort+]', 'Settings retrieved', {
          hasApiKey: !!(settings.apiKey || (settings.geminiApiKeys && settings.geminiApiKeys.length > 0)),
          provider, labels: settings.labels, enableAi: settings.enableAi !== false
        });
      }

      if (settings.enableAi === false) {
        console.error('AI is disabled');
        if (notificationId) await AutoSortPlus.notification.update(notificationId, 'AutoSort+ Error', 'AI analysis is disabled in settings.');
        return null;
      }

      let apiKeyToUse = null;
      if (provider === 'gemini') {
        if (settings.geminiApiKeys && settings.geminiApiKeys.length > 0) {
          const keyIndex = keyIndexToUse !== null ? keyIndexToUse : (settings.currentGeminiKeyIndex || 0);
          apiKeyToUse = settings.geminiApiKeys[keyIndex];
          if (window.debugLogger) window.debugLogger.info('[Gemini]', `Using API Key #${keyIndex + 1} of ${settings.geminiApiKeys.length}`);
        } else if (settings.apiKey) {
          apiKeyToUse = settings.apiKey;
        }
      } else if (provider !== 'ollama' && provider !== 'openai-compatible') {
        apiKeyToUse = settings.apiKey;
      }

      if (!apiKeyToUse && provider !== 'ollama' && provider !== 'openai-compatible') {
        console.error('Missing API key');
        if (notificationId) await AutoSortPlus.notification.update(notificationId, 'AutoSort+ Error', `${provider.charAt(0).toUpperCase() + provider.slice(1)} API key not configured. Please add your API key in settings.`);
        return null;
      }

      if (provider === 'openai-compatible') {
        const baseUrl = settings.customBaseUrl || '';
        const model = settings.customModel || '';
        if (!baseUrl || !model) {
          console.error('OpenAI-compatible endpoint not configured');
          if (notificationId) await AutoSortPlus.notification.update(notificationId, 'AutoSort+ Error', 'OpenAI-compatible endpoint not configured. Please set base URL and model in settings.');
          return null;
        }
      }

      if (!settings.labels || settings.labels.length === 0) {
        console.error('No labels configured');
        if (notificationId) await AutoSortPlus.notification.update(notificationId, 'AutoSort+ Error', 'No folders/labels configured. Please go to settings and either load folders from your mail account or add custom labels.');
        return null;
      }

      const promptTemplate = (settings.customPrompt && settings.customPrompt.trim()) ? settings.customPrompt.trim() : AutoSortPlus.promptBuilder.DEFAULT_PROMPT;
      let prompt = AutoSortPlus.promptBuilder.build(promptTemplate, settings.labels, emailContent, emailContext);

      if (notificationId) await AutoSortPlus.notification.update(notificationId, 'AutoSort+ AI Analysis', `Sending request to ${provider.charAt(0).toUpperCase() + provider.slice(1)} AI...`);

      const result = await AutoSortPlus.providers.getProvider(provider).analyze(prompt, settings, notificationId, keyIndexToUse);
      let label = null;

      if (result && typeof result === 'string') {
        label = result.trim();
      } else if (result && typeof result === 'object') {
        label = (result.label || result.text || '').toString().trim();
      }

      if (!label) {
        console.error('No label extracted from response:', result);
        if (notificationId) await AutoSortPlus.notification.update(notificationId, 'AutoSort+ Error', 'No response from AI');
        return null;
      }

      if (window.debugLogger) window.debugLogger.info('[AutoSort+]', `Raw generated label: ${label}`);

      // Normalize and match configured labels
      const normalize = s => s.toString().trim().replace(/^['"`]+|['"`]+$/g, '');
      const lower = normalize(label).toLowerCase();

      if (settings.labels.includes(label)) {
        if (notificationId) await AutoSortPlus.notification.update(notificationId, 'AutoSort+ Success', `AI analysis complete. Selected label: ${label}`);
        return label;
      }

      let matched = settings.labels.find(l => l.toLowerCase() === lower);
      if (!matched) {
        matched = settings.labels.find(l => lower.includes(l.toLowerCase()) || l.toLowerCase().includes(lower));
      }

      if (matched) {
        if (window.debugLogger) window.debugLogger.info('[AutoSort+]', `Mapped AI output to configured label: ${matched}`);
        if (notificationId) await AutoSortPlus.notification.update(notificationId, 'AutoSort+ Success', `AI analysis complete. Selected label: ${matched}`);
        return matched;
      }

      if (window.debugLogger) window.debugLogger.warn('[AutoSort+]', `Label not found in configured labels. Generated: ${label}`);
      if (notificationId) await AutoSortPlus.notification.update(notificationId, 'AutoSort+ Warning', `AI suggested: "${label}" but it's not in your configured labels.`);
      return null;
    } catch (error) {
      console.error('Error analyzing email:', error);
      await AutoSortPlus.notification.show('AutoSort+ Error', `Error analyzing email: ${error.message}`);
      return null;
    }
  },

  // ───────────────────────────────────────────────────────────────────────
  // Label Application (folder lookup + move + history)
  // ───────────────────────────────────────────────────────────────────────

  async applyLabels(messages, label) {
    try {
      const messageCount = messages.length;
      const notificationId = await AutoSortPlus.notification.show('AutoSort+ Processing', `Starting to process ${messageCount} message(s)...`);

      let successCount = 0;
      let errorCount = 0;
      const moveResults = [];

      const folderCache = new Map();
      const accountCache = new Map();

      async function getAccount(accountId) {
        if (!accountCache.has(accountId)) {
          const account = await messenger.accounts.get(accountId);
          accountCache.set(accountId, account);
        }
        return accountCache.get(accountId);
      }

      function buildFolderMap(folders, prefix = '', accountId) {
        if (!folders) return;
        for (const folder of folders) {
          const fullName = prefix ? `${prefix}/${folder.name}` : folder.name;
          folderCache.set(`${accountId}:${fullName}`, folder);
          folderCache.set(`${accountId}:${folder.name}`, folder);
          if (folder.subFolders) buildFolderMap(folder.subFolders, fullName, accountId);
        }
      }

      const uniqueAccountIds = [...new Set(messages.map(m => m.folder?.accountId).filter(id => id))];
      for (const accountId of uniqueAccountIds) {
        const account = await getAccount(accountId);
        buildFolderMap(account.folders, '', accountId);
      }

      if (window.debugLogger) window.debugLogger.info('[Folder]', `Built folder cache: ${folderCache.size} entries`);

      for (const message of messages) {
        if (window.debugLogger) {
          window.debugLogger.info('[Folder]', `Processing message: ${message.id}`);
          window.debugLogger.info('[Folder]', `Target label/folder: ${label}`);
        }

        const account = await getAccount(message.folder.accountId);

        if (notificationId) await AutoSortPlus.notification.update(notificationId, 'AutoSort+ Processing', `Finding destination folder for message ${successCount + errorCount + 1}/${messageCount}...`);

        let targetFolder = folderCache.get(`${message.folder.accountId}:${label}`);
        if (!targetFolder && label.includes('/')) {
          targetFolder = folderCache.get(`${message.folder.accountId}:${label}`);
        }

        if (!targetFolder) {
          const looksImported = label.includes('/') || label.includes('\\');
          if (!looksImported) {
            try {
              const parentFolder = account.folders && account.folders.length > 0 ? account.folders[0] : null;
              if (parentFolder && messenger.folders && messenger.folders.create) {
                if (window.debugLogger) window.debugLogger.info('[Folder]', `Creating missing folder "${label}" under ${parentFolder.name || 'root'}`);
                const created = await messenger.folders.create(parentFolder, label);
                if (created) {
                  targetFolder = created;
                  folderCache.set(`${message.folder.accountId}:${label}`, created);
                }
              }
            } catch (createError) {
              console.error(`Failed to create folder "${label}":`, createError);
            }
          }
        }

        if (window.debugLogger) window.debugLogger.info('[Folder]', `Moving message to folder: ${targetFolder ? targetFolder.name : 'not found'}`);

        try {
          if (!targetFolder) {
            console.error(`Folder "${label}" not found in account ${account.name}`);
            if (notificationId) await AutoSortPlus.notification.update(notificationId, 'AutoSort+ Error', `Folder "${label}" not found. Please create it first in Thunderbird.`);
            errorCount++;
            const result = { subject: message.subject || '(No subject)', status: 'Error', destination: 'Folder not found', timestamp: new Date().toISOString() };
            moveResults.push(result);
            await this.storeMoveHistory(result);
            continue;
          }

          if (notificationId) await AutoSortPlus.notification.update(notificationId, 'AutoSort+ Processing', `Moving message ${successCount + errorCount + 1}/${messageCount} to ${targetFolder.name}...`);

          await messenger.messages.move([message.id], targetFolder.id);

          successCount++;
          const result = { subject: message.subject || '(No subject)', status: 'Success', destination: targetFolder.name, timestamp: new Date().toISOString() };
          moveResults.push(result);
          await this.storeMoveHistory(result);
        } catch (moveError) {
          console.error('Error moving message:', moveError);
          errorCount++;
          const result = { subject: message.subject || '(No subject)', status: 'Error', destination: moveError.message, timestamp: new Date().toISOString() };
          moveResults.push(result);
          await this.storeMoveHistory(result);
          if (notificationId) await AutoSortPlus.notification.update(notificationId, 'AutoSort+ Error', `Error moving message: ${moveError.message}`);
        }
      }

      if (errorCount === 0) {
        if (notificationId) await AutoSortPlus.notification.update(notificationId, 'AutoSort+ Success', `Successfully moved ${successCount} message(s) to ${label}`);
      } else {
        if (notificationId) await AutoSortPlus.notification.update(notificationId, 'AutoSort+ Completed with Errors', `Processed ${messageCount} message(s): ${successCount} successful, ${errorCount} failed`);
      }

      await this._showMoveResultsPopup(moveResults);
    } catch (error) {
      console.error('Error applying labels:', error);
      await AutoSortPlus.notification.show('AutoSort+ Error', `Error processing messages: ${error.message}`);
    }
  },

  // ───────────────────────────────────────────────────────────────────────
  // Move History
  // ───────────────────────────────────────────────────────────────────────

  async storeMoveHistory(result) {
    try {
      const data = await AutoSortPlus.storage.get('moveHistory');
      const history = data.moveHistory || [];
      history.unshift({
        timestamp: new Date().toISOString(),
        subject: (result.subject || '').substring(0, 200),
        status: result.status || 'unknown',
        destination: (result.destination || '').substring(0, 200)
      });
      if (history.length > 100) history.pop();
      await AutoSortPlus.storage.set({ moveHistory: history });
    } catch (error) {
      console.error('Error storing move history:', error);
    }
  },

  // ───────────────────────────────────────────────────────────────────────
  // Results Popup
  // ───────────────────────────────────────────────────────────────────────

  async _showMoveResultsPopup(results) {
    try {
      const successCount = results.filter(r => r.status === 'Success').length;
      const errorCount = results.filter(r => r.status === 'Error').length;

      let message = `Processed ${results.length} messages:\n`;
      message += `Successfully moved: ${successCount}\n`;
      message += `Failed to move: ${errorCount}\n\n`;

      results.forEach((result, index) => {
        message += `${index + 1}. ${result.subject}\n`;
        message += `   Status: ${result.status}\n`;
        message += `   Destination: ${result.destination}\n`;
        message += `   Timestamp: ${result.timestamp}\n\n`;
      });

      await AutoSortPlus.notification.show('AutoSort+ Results', message, 'basic');

      if (window.debugLogger) window.debugLogger.info('[AutoSort+]', 'Results popup displayed');
    } catch (error) {
      console.error('Error showing results:', error);
      await AutoSortPlus.notification.show('AutoSort+ Error', 'Failed to show detailed results. Check console for more information.');
    }
  },

  // ───────────────────────────────────────────────────────────────────────
  // Learning Feedback
  // ───────────────────────────────────────────────────────────────────────

  async recordManualLabel(messages, label) {
    // Record correction for each message
    for (const message of messages) {
      try {
        const fullMessage = await messenger.messages.getFull(message.id);
        if (!fullMessage) continue;
        const ctx = await AutoSortPlus.emailExtractor.extract(fullMessage, message);
        await AutoSortPlus.learning.recordCorrection(label, label, ctx.subject, ctx.author);
      } catch (e) {
        if (window.debugLogger) window.debugLogger.warn('[Learning]', `Failed to record correction: ${e.message}`);
      }
    }
  },

  // ───────────────────────────────────────────────────────────────────────
  // Context Menu Rebuild
  // ───────────────────────────────────────────────────────────────────────

  async rebuildLabelSubmenu(labels) {
    try {
      const existingItems = await messenger.menus.getAll();
      for (const item of existingItems) {
        if (item.parentId === 'autosort-label') {
          messenger.menus.remove(item.id);
        }
      }
    } catch (e) {}

    if (labels && labels.length > 0) {
      for (const label of labels) {
        messenger.menus.create({
          id: `label-${label}`,
          parentId: 'autosort-label',
          title: label,
          contexts: ['message_list']
        });
      }
    }
  }
};

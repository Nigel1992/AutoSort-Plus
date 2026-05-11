class BatchPanel {
  constructor() {
    this.panel = document.getElementById('batch-status-panel');
    this.fill = document.getElementById('batch-progress-fill');
    this.text = document.getElementById('batch-progress-text');
    this.badge = document.getElementById('batch-provider-badge');
    this.pauseBtn = document.getElementById('batch-pause-btn');
    this.resumeBtn = document.getElementById('batch-resume-btn');
    this.cancelBtn = document.getElementById('batch-cancel-btn');
    this._hideTimer = null;
    this._boundOnMessage = this._onMessage.bind(this);
    this._bindEvents();
    this._restoreState();
  }

  _bindEvents() {
    browser.runtime.onMessage.addListener(this._boundOnMessage);
    if (this.pauseBtn) this.pauseBtn.addEventListener('click', () => { browser.runtime.sendMessage({ action: 'batchControl', command: 'pause' }).catch(() => {}); this._updatePanel({ status: 'paused' }); });
    if (this.resumeBtn) this.resumeBtn.addEventListener('click', () => { browser.runtime.sendMessage({ action: 'batchControl', command: 'resume' }).catch(() => {}); this._updatePanel({ status: 'running' }); });
    if (this.cancelBtn) this.cancelBtn.addEventListener('click', () => { if (confirm(i18n.get('batchCancelConfirm'))) { browser.runtime.sendMessage({ action: 'batchControl', command: 'cancel' }).catch(() => {}); this.cancelBtn.disabled = true; } });
  }

  _onMessage(msg) {
    if (msg.action === 'batchProgress') { this._updatePanel(msg); this.panel.style.display = 'block'; }
  }

  _updatePanel(payload) {
    if (!this.panel || !payload) return;
    const { status = 'running', total = 0, completed = 0, failed = 0, skipped = 0, provider = '', chunkIndex = 0, totalChunks = 0 } = payload;
    const done = (completed || 0) + (failed || 0) + (skipped || 0);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    this.panel.dataset.status = status;
    if (this.badge && provider) this.badge.textContent = provider;
    if (this.fill) this.fill.style.width = pct + '%';

    if (this.text) {
      if (status === 'paused') this.text.textContent = i18n.get('batchPausedChunk', [chunkIndex || 0, totalChunks, done, total]);
      else if (status === 'done') this.text.textContent = i18n.get('batchDone', [completed, skipped, failed]);
      else if (status === 'cancelled') this.text.textContent = i18n.get('batchCancelledChunk', [chunkIndex || 0, totalChunks]);
      else this.text.textContent = i18n.get('batchRunningChunk', [chunkIndex || 0, totalChunks, done, total, completed, failed]);
    }

    if (this.pauseBtn && this.resumeBtn) {
      this.pauseBtn.style.display = status === 'paused' ? 'none' : '';
      this.resumeBtn.style.display = status === 'paused' ? '' : 'none';
    }
    if (this.cancelBtn) this.cancelBtn.style.display = (status === 'done' || status === 'cancelled') ? 'none' : '';

    if (status === 'done' || status === 'cancelled') {
      clearTimeout(this._hideTimer);
      this._hideTimer = setTimeout(() => { if (this.panel) this.panel.style.display = 'none'; }, 5000);
    }
  }

  async _restoreState() {
    try {
      const { currentBatch } = await browser.storage.local.get('currentBatch');
      if (currentBatch && currentBatch.status === 'running') this._updatePanel(currentBatch);
    } catch (e) {}
  }

  destroy() { browser.runtime.onMessage.removeListener(this._boundOnMessage); }
}

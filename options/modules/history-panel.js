class HistoryPanel {
  constructor() {
    this._bindButtons();
    this.loadHistory();
  }

  _bindButtons() {
    const clearBtn = document.getElementById('clear-history');
    if (clearBtn) clearBtn.addEventListener('click', async () => {
      if (confirm(i18n.get('clearHistoryConfirm'))) {
        await browser.storage.local.set({ moveHistory: [] });
        this.loadHistory();
      }
    });

    const refreshBtn = document.getElementById('refresh-history');
    if (refreshBtn) refreshBtn.addEventListener('click', () => this.loadHistory());
  }

  async loadHistory() {
    const data = await browser.storage.local.get('moveHistory');
    const history = data.moveHistory || [];
    const body = document.getElementById('history-body');
    if (!body) return;
    body.innerHTML = history.map(entry => `<tr><td class="timestamp">${new Date(entry.timestamp).toLocaleString()}</td><td>${this._escHtml((entry.subject || '').substring(0, 200))}</td><td class="${(entry.status || 'unknown').toLowerCase()}">${this._escHtml(entry.status)}</td><td>${this._escHtml((entry.destination || '').substring(0, 200))}</td></tr>`).join('');
  }

  _escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  destroy() {}
}

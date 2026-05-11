class AccuracyPanel {
  constructor() {
    this.refreshBtn = document.getElementById('refresh-accuracy');
    if (this.refreshBtn) this.refreshBtn.addEventListener('click', () => this.refresh());
    this.refresh();
  }

  async refresh() {
    try {
      const [historyData, correctionsData] = await Promise.all([
        messenger.storage.local.get('moveHistory'),
        messenger.storage.local.get('corrections')
      ]);
      const history = historyData.moveHistory || [];
      const corrections = correctionsData.corrections || [];

      const totalProcessed = history.filter(h => h.status === 'Success').length;
      const totalCorrections = corrections.length;
      const accuracy = totalProcessed > 0
        ? Math.round(((totalProcessed - totalCorrections) / totalProcessed) * 1000) / 10
        : 0;

      const valEl = document.getElementById('accuracy-value');
      if (valEl) { valEl.textContent = `${accuracy}%`; valEl.style.color = accuracy >= 80 ? '#28a745' : accuracy >= 60 ? '#ffc107' : '#dc3545'; }
      const totalEl = document.getElementById('accuracy-total');
      if (totalEl) totalEl.textContent = totalProcessed;
      const corrEl = document.getElementById('accuracy-corrections');
      if (corrEl) corrEl.textContent = totalCorrections;

      // Per-label breakdown
      const labelStats = this.computeLabelStats(history, corrections);
      const byLabelEl = document.getElementById('accuracy-by-label');
      if (byLabelEl) byLabelEl.innerHTML = labelStats.map(s =>
        `<div class="label-stat-row"><span class="label-stat-name">${this._esc(s.label)}</span><span class="label-stat-accuracy">${s.accuracy}% (${s.correct}/${s.total})</span></div>`
      ).join('');
    } catch (e) { console.error('Failed to load accuracy stats:', e); }
  }

  computeLabelStats(history, corrections) {
    const labelCounts = {};
    history.filter(h => h.status === 'Success').forEach(h => {
      const dest = h.destination || 'Unknown';
      if (!labelCounts[dest]) labelCounts[dest] = { total: 0, corrections: 0 };
      labelCounts[dest].total++;
    });
    corrections.forEach(c => {
      if (labelCounts[c.aiLabel]) labelCounts[c.aiLabel].corrections++;
    });

    return Object.entries(labelCounts)
      .map(([label, stats]) => ({
        label,
        total: stats.total,
        corrections: stats.corrections,
        correct: stats.total - stats.corrections,
        accuracy: stats.total > 0 ? Math.round(((stats.total - stats.corrections) / stats.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);
  }

  _esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  destroy() {}
}

(function () {
    const idleEl = document.getElementById('batch-idle');
    const panelEl = document.getElementById('batch-panel');
    const statusEl = document.getElementById('batch-status');
    const counterEl = document.getElementById('batch-counter');
    const progressFill = document.getElementById('batch-progress-fill');
    const aiStatusEl = document.getElementById('batch-ai-status');
    const resultsEl = document.getElementById('batch-results');
    const cancelBtn = document.getElementById('batch-cancel');
    const retryBtn = document.getElementById('batch-retry');
    const closeBtn = document.getElementById('batch-close');
    const countEls = {
        sorted: document.getElementById('count-sorted'),
        skipped: document.getElementById('count-skipped'),
        failed: document.getElementById('count-failed')
    };

    let lastResults = [];

    browser.runtime.onMessage.addListener((msg) => {
        if (msg.action === 'batchProgress') {
            render(msg);
        }
    });

    cancelBtn.addEventListener('click', async () => {
        cancelBtn.disabled = true;
        cancelBtn.textContent = 'Cancelling…';
        try {
            await browser.runtime.sendMessage({ action: 'batchCancel' });
        } catch (e) {
            cancelBtn.disabled = false;
            cancelBtn.textContent = 'Cancel';
        }
    });

    retryBtn.addEventListener('click', async () => {
        retryBtn.disabled = true;
        retryBtn.textContent = 'Retrying…';
        try {
            const failedIds = lastResults.filter(r => r.status === 'failed').map(r => r.id);
            await browser.runtime.sendMessage({ action: 'batchRetry', messageIds: failedIds });
        } catch (e) {
            retryBtn.disabled = false;
            retryBtn.textContent = 'Retry Failed';
        }
    });

    closeBtn.addEventListener('click', () => {
        window.close();
    });

    function render(msg) {
        idleEl.style.display = 'none';
        panelEl.style.display = 'block';

        const pct = msg.total > 0 ? Math.min(100, Math.round((msg.current / msg.total) * 100)) : 0;
        progressFill.style.width = pct + '%';
        counterEl.textContent = `${msg.current} / ${msg.total}`;

        const phase = msg.phase || 'processing';
        const phaseLabels = {
            processing: msg.subject ? `Processing: ${msg.subject}` : 'Starting…',
            done: '✓ Batch complete',
            cancelled: '⚠ Batch cancelled'
        };
        statusEl.textContent = phaseLabels[phase] || phaseLabels.processing;
        statusEl.className = 'batch-phase-' + phase;

        aiStatusEl.textContent = msg.aiStatus || '';
        aiStatusEl.style.display = msg.aiStatus ? 'block' : 'none';

        countEls.sorted.textContent = msg.counts.sorted;
        countEls.skipped.textContent = msg.counts.skipped;
        countEls.failed.textContent = msg.counts.failed;

        const apiUsageContainer = document.getElementById('batch-api-usage');
        const apiUsageCards = document.getElementById('api-usage-cards');
        const apiUsageSummary = document.getElementById('api-usage-summary');
        if (apiUsageContainer && apiUsageCards && msg.apiKeyUsage && msg.apiKeyUsage.length > 0) {
            apiUsageContainer.style.display = 'block';
            apiUsageCards.innerHTML = msg.apiKeyUsage.map(k => `
                <div class="api-card ${k.active ? 'active' : ''}">
                    Key #${k.index} ${k.active ? '(Active)' : ''}<br>
                    Usage: <strong>${k.dailyCount} / 20</strong><br>
                    <small>Resets: ${k.resetTime ? new Date(k.resetTime).toLocaleString() : 'n/a'}</small>
                </div>
            `).join('');
            if (apiUsageSummary) {
                const totalUsed = msg.apiKeyUsage.reduce((a, b) => a + b.dailyCount, 0);
                const totalLimit = msg.apiKeyUsage.length * 20;
                apiUsageSummary.textContent = `Total used: ${totalUsed} / ${totalLimit}`;
            }
        } else if (apiUsageContainer) {
            apiUsageContainer.style.display = 'none';
        }

        lastResults = msg.results || [];
        resultsEl.innerHTML = lastResults.map(r => {
            const icon = r.status === 'sorted' ? '✅' : r.status === 'skipped' ? '⚠️' : '❌';
            const detail = r.status === 'sorted' ? `→ ${r.label || r.detail || ''}` : (r.detail || '');
            return `<div class="batch-result-row ${r.status}">
                <span class="batch-result-icon">${icon}</span>
                <span class="batch-result-subject" title="${escapeHtml(r.subject)}">${escapeHtml(r.subject)}</span>
                <span class="batch-result-detail" title="${escapeHtml(detail)}">${escapeHtml(detail)}</span>
            </div>`;
        }).join('');
        resultsEl.scrollTop = resultsEl.scrollHeight;

        const done = phase === 'done' || phase === 'cancelled';
        cancelBtn.style.display = done ? 'none' : '';
        closeBtn.style.display = done ? '' : 'none';
        retryBtn.style.display = done && msg.counts.failed > 0 ? '' : 'none';
        if (done) {
            retryBtn.disabled = false;
            retryBtn.textContent = 'Retry Failed';
        }
        progressFill.classList.toggle('done', phase === 'done');
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Re-sync with a running or recently finished batch (e.g. tab reopened)
    browser.runtime.sendMessage({ action: 'batchSync' })
        .then(state => { if (state) render(state); })
        .catch(() => {});
})();

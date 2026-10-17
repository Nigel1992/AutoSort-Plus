document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('open-options').addEventListener('click', function() {
        browser.runtime.openOptionsPage();
    });

    document.getElementById('open-batch').addEventListener('click', function() {
        browser.tabs.create({ url: browser.runtime.getURL('batch.html') });
    });

    updateStats();
    setInterval(updateStats, 30000); // Update every 30 seconds
});

async function updateStats() {
    try {
        const data = await browser.storage.local.get([
            'moveHistory',
            'geminiApiKeys',
            'geminiRateLimits',
            'currentGeminiKeyIndex',
            'geminiPaidPlan',
            'geminiRateLimit'
        ]);

        // Update email sorting stats
        const history = data.moveHistory || [];
        const today = new Date().toISOString().split('T')[0];

        const todayStats = history.filter(entry =>
            entry.timestamp && entry.timestamp.startsWith(today)
        );

        const todaySorted = todayStats.filter(e => e.status === 'Success').length;
        const todaySkipped = todayStats.filter(e => e.status === 'Error' &&
            (e.destination.includes('No label') || e.destination.includes('no label'))).length;
        const todayFailed = todayStats.filter(e => e.status === 'Error' &&
            !(e.destination.includes('No label') || e.destination.includes('no label'))).length;

        const totalSorted = history.filter(e => e.status === 'Success').length;

        document.getElementById('sorted-today').textContent = todaySorted;
        document.getElementById('skipped-today').textContent = todaySkipped;
        document.getElementById('failed-today').textContent = todayFailed;
        document.getElementById('sorted-total').textContent = totalSorted;

        // Update API usage (aggregate across all keys)
        const apiUsageDiv = document.getElementById('api-usage-display');
        const perKeyLimit = 20;

        let keys = [];
        let rateLimits = [];
        let currentIndex = 0;
        let legacy = false;

        if (data.geminiApiKeys && data.geminiApiKeys.length > 0) {
            keys = data.geminiApiKeys;
            rateLimits = Array.isArray(data.geminiRateLimits) ? data.geminiRateLimits : [];
            currentIndex = data.currentGeminiKeyIndex || 0;
        } else if (data.geminiRateLimit && typeof data.geminiRateLimit === 'object') {
            keys = ['legacy'];
            rateLimits = [data.geminiRateLimit];
            legacy = true;
        }

        if (keys.length === 0) {
            apiUsageDiv.innerHTML = '<div class="no-data">No API keys configured</div>';
        } else {
            const totalLimit = keys.length * perKeyLimit;
            let totalUsed = 0;
            let activeKeyNumber = 0;

            keys.forEach((_, index) => {
                const rl = rateLimits[index];
                const count = (rl && typeof rl.dailyCount === 'number') ? rl.dailyCount : 0;
                totalUsed += Math.min(Math.max(count, 0), perKeyLimit);
                if (index === currentIndex) activeKeyNumber = index + 1;
            });
            totalUsed = Math.min(totalUsed, totalLimit);

            const remaining = totalLimit - totalUsed;
            const percent = totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 100) : 0;
            const level = percent >= 85 ? 'critical' : percent >= 50 ? 'warning' : 'ok';
            const keyWord = keys.length === 1 ? 'key' : 'keys';

            const footer = legacy
                ? '<div class="api-active-key">Legacy single key mode</div>'
                : (activeKeyNumber ? `<div class="api-active-key">Active key: #${activeKeyNumber}</div>` : '');

            apiUsageDiv.innerHTML = `
                <div class="api-summary">
                    <div class="api-summary-line">
                        <span class="api-summary-used">${totalUsed}</span>
                        <span class="api-summary-total">/ ${totalLimit}</span>
                        <span class="api-summary-suffix">used</span>
                    </div>
                    <div class="api-progress">
                        <div class="api-progress-fill ${level}" style="width: ${percent}%"></div>
                    </div>
                    <div class="api-summary-detail">
                        <span>${keys.length} ${keyWord} × ${perKeyLimit}/day</span>
                        <span>${remaining} left</span>
                    </div>
                    ${footer}
                </div>
            `;
        }

        // Update timestamp
        document.getElementById('last-updated').textContent =
            'Last updated: ' + new Date().toLocaleTimeString();

    } catch (error) {
        console.error('Error updating popup stats:', error);
        document.getElementById('api-usage-display').innerHTML =
            '<div class="no-data">Error loading stats</div>';
    }
}

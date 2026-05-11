/**
 * Concurrency utility for processing items with limited parallelism
 */

if (!window.AutoSortPlus) window.AutoSortPlus = {};

window.AutoSortPlus.concurrency = {
    async processWithConcurrency(items, processor, limit = 3) {
        const results = [];
        const executing = new Set();
        for (const item of items) {
            const promise = processor(item).finally(() => executing.delete(promise));
            executing.add(promise);
            results.push(promise);
            if (executing.size >= limit) await Promise.race(executing);
        }
        return Promise.allSettled(results);
    }
};

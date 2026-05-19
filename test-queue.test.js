/**
 * Tests for persistent pending queue functions.
 * Run: node test-queue.test.js
 */

const assert = require('assert');

// ─────────────────────────────────────────────────────────────
// Mock browser.storage.local
// ─────────────────────────────────────────────────────────────

let mockStorage = {};

const browser = {
    storage: {
        local: {
            get: async (keys) => {
                const result = {};
                const keyList = Array.isArray(keys) ? keys : [keys];
                for (const key of keyList) {
                    if (mockStorage[key] !== undefined) {
                        result[key] = mockStorage[key];
                    }
                }
                return result;
            },
            set: async (obj) => {
                Object.assign(mockStorage, obj);
            }
        }
    }
};

// ─────────────────────────────────────────────────────────────
// Inline the queue functions for testing (mirrors background.js)
// ─────────────────────────────────────────────────────────────

const MAX_PENDING_RETRIES = 3;

async function enqueuePending(message, reason) {
    const data = await browser.storage.local.get(['pendingQueue']);
    const queue = data.pendingQueue || [];
    queue.push({
        messageId: message.id,
        accountId: message.folder?.accountId || '',
        timestamp: Date.now(),
        retryCount: 0,
        lastError: reason || ''
    });
    await browser.storage.local.set({ pendingQueue: queue });
}

async function dequeuePending() {
    const data = await browser.storage.local.get(['pendingQueue']);
    const queue = data.pendingQueue || [];
    await browser.storage.local.set({ pendingQueue: [] });
    return queue;
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

async function setup() { mockStorage = {}; }

async function test_enqueueAddsEntry() {
    await setup();
    await enqueuePending({ id: 1, folder: { accountId: 'acc1' } }, 'rate_limited');
    const data = await browser.storage.local.get(['pendingQueue']);
    assert.strictEqual(data.pendingQueue.length, 1);
    assert.strictEqual(data.pendingQueue[0].messageId, 1);
    assert.strictEqual(data.pendingQueue[0].retryCount, 0);
    console.log('  PASS: enqueue adds entry to queue');
}

async function test_dequeueReturnsAndClears() {
    await setup();
    await enqueuePending({ id: 1, folder: { accountId: 'acc1' } }, 'rate_limited');
    await enqueuePending({ id: 2, folder: { accountId: 'acc2' } }, 'rate_limited');

    const dequeued = await dequeuePending();
    assert.strictEqual(dequeued.length, 2);
    assert.strictEqual(dequeued[0].messageId, 1);
    assert.strictEqual(dequeued[1].messageId, 2);

    const after = await browser.storage.local.get(['pendingQueue']);
    assert.deepStrictEqual(after.pendingQueue, []);
    console.log('  PASS: dequeue returns all entries and clears storage');
}

async function test_enqueueAppendsToExisting() {
    await setup();
    await enqueuePending({ id: 1, folder: { accountId: 'acc1' } }, 'err1');
    await enqueuePending({ id: 2, folder: { accountId: 'acc1' } }, 'err2');

    const data = await browser.storage.local.get(['pendingQueue']);
    assert.strictEqual(data.pendingQueue.length, 2);
    console.log('  PASS: enqueue appends to existing queue');
}

async function test_emptyQueueDequeue() {
    await setup();
    const result = await dequeuePending();
    assert.deepStrictEqual(result, []);
    console.log('  PASS: dequeue on empty storage returns empty array');
}

// ─────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────

(async () => {
    console.log('Running queue tests...\n');
    await test_enqueueAddsEntry();
    await test_dequeueReturnsAndClears();
    await test_enqueueAppendsToExisting();
    await test_emptyQueueDequeue();
    console.log('\nAll queue tests passed!');
})();

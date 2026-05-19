# Dynamic Menu Hot Update + Persistent Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 v1.3 动态菜单热更新增强（通知提示 + 文档修复）和 v2.0 持久化异步任务队列（替换内存数组为 storage 持久化）

**Architecture:** 两个独立子系统：(1) `rebuildLabelSubmenu()` 增强通知 + README 文案修复；(2) `background.js` 中 `_autoSortPending` 内存数组替换为 `browser.storage.local` 持久化队列，新增 `enqueuePending/dequeuePending/recoverPendingQueue` 三个函数

**Tech Stack:** WebExtension (Manifest V3), Thunderbird WebExtensions API (`browser.menus`, `browser.storage.local`, `browser.runtime`)

---

## File Map

| File | Responsibility | Changes |
|---|---|---|
| `background.js` | 核心业务逻辑 | 修改 `rebuildLabelSubmenu()` + 替换 `_autoSortPending` 逻辑 + 新增 3 个队列函数 |
| `README.md` | 用户文档 | 修复 3 处"需要重启"文案 |
| `test-queue.test.js` | 队列逻辑单元测试 | 新建，测试 enqueue/dequeue/recover 函数 |

---

### Task 1: Dynamic Menu Notification

**Files:**
- Modify: `background.js:2005-2017` (`rebuildLabelSubmenu` function)

- [ ] **Step 1: 修改 rebuildLabelSubmenu 添加通知**

读取 `background.js` L2005-2017，在 `await buildContextMenu()` 之后添加通知：

```js
/** Rebuild the menu when labels change — removes old items, then rebuilds from shared logic. */
async function rebuildLabelSubmenu() {
    try {
        const existingItems = await browser.menus.getAll();
        for (const item of existingItems) {
            if (item.id && (item.id.startsWith('autosort-') || item.id.startsWith('label-'))) {
                browser.menus.remove(item.id);
            }
        }
    } catch (e) {
        console.warn('[Menu] Failed to remove existing items:', e.message);
    }
    await buildContextMenu();

    const { labels } = await browser.storage.local.get(['labels']);
    if (window.debugLogger) {
        window.debugLogger.info('[Menu]', `Menu rebuilt with ${labels ? labels.length : 0} labels`);
    }
    await showNotification(
        "AutoSort+",
        `Menu updated — ${labels && labels.length ? labels.length : '0'} label${labels && labels.length !== 1 ? 's' : ''} available`
    );
}
```

- [ ] **Step 2: 验证 buildContextMenu 返回 labels 是否可用**

确认 `buildContextMenu()` 中 `const { labels } = await browser.storage.local.get(['labels'])` 能正确读取。如果 `buildContextMenu` 内部已有 labels 变量，考虑让 `rebuildLabelSubmenu` 直接调用 `buildContextMenu` 后独立查询 labels 用于通知。

- [ ] **Step 3: 提交**

```bash
git add background.js
git commit -m "feat: add notification toast when menu rebuilds after label change"
```

---

### Task 2: README Restart Text Removal

**Files:**
- Modify: `README.md:123`, `README.md:163`, `README.md:296`

- [ ] **Step 1: 修复 L123 — 安装步骤**

将 `6. Restart Thunderbird` 替换为：
```
6. Menu auto-updates — no restart needed
```

- [ ] **Step 2: 修复 L163 — 标签变更警告**

将整行 `> ⚠️ **Warning:** If you add or change labels in the settings menu, you must restart Thunderbird for the new labels to appear in the right-click menu.` 替换为：
```
> Labels update automatically in the right-click menu — no restart needed.
```

- [ ] **Step 3: 修复 L296 — 重复标签变更说明**

将整行 `> **Note:** If you add or change labels in the settings menu, you must restart Thunderbird for the new labels to appear in the right-click menu.` 替换为：
```
> Labels update automatically in the right-click menu — no restart needed.
```

- [ ] **Step 4: 提交**

```bash
git add README.md
git commit -m "docs: remove restart requirement — menu auto-updates on label change"
```

---

### Task 3: Persistent Queue — Core Functions

**Files:**
- Modify: `background.js:466` (replace `_autoSortPending` declaration)
- Create: `background.js` — 新增 3 个函数（插入在 L466 附近）
- Test: `test-queue.test.js`

- [ ] **Step 1: 新增队列函数（插入在 L466 `_autoSortPending` 声明之前）**

在 `background.js` L466 之前（即 `_acquireBatchLock` 函数之后）插入以下代码：

```js
// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENT PENDING QUEUE
// Replaces in-memory _autoSortPending array with browser.storage.local
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PENDING_RETRIES = 3;

/**
 * Enqueue a message that failed due to rate limiting.
 * @param {Object} message - Thunderbird message object
 * @param {string} reason - Error reason for logging
 */
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
    if (window.debugLogger) {
        window.debugLogger.warn('[Queue]', `Message ${message.id} enqueued (reason: ${reason})`);
    }
}

/**
 * Dequeue all pending messages from storage. Returns array and clears storage.
 * @returns {Promise<Array>} pending entries
 */
async function dequeuePending() {
    const data = await browser.storage.local.get(['pendingQueue']);
    const queue = data.pendingQueue || [];
    await browser.storage.local.set({ pendingQueue: [] });
    return queue;
}

/**
 * Recover and retry pending messages from storage on extension startup.
 * Messages exceeding MAX_PENDING_RETRIES are dropped.
 */
async function recoverPendingQueue() {
    const data = await browser.storage.local.get(['pendingQueue']);
    const queue = data.pendingQueue || [];
    if (queue.length === 0) return;

    if (window.debugLogger) {
        window.debugLogger.info('[Queue]', `Recovering ${queue.length} pending messages from storage`);
    }

    await browser.storage.local.set({ pendingQueue: [] });

    const recovered = [];
    for (const entry of queue) {
        if (entry.retryCount >= MAX_PENDING_RETRIES) {
            if (window.debugLogger) {
                window.debugLogger.warn('[Queue]', `Message ${entry.messageId} dropped (exceeded ${MAX_PENDING_RETRIES} retries)`);
            }
            continue;
        }
        recovered.push(entry);
    }

    if (recovered.length > 0 && window.debugLogger) {
        window.debugLogger.info('[Queue]', `Retrying ${recovered.length} pending messages`);
    }

    for (const entry of recovered) {
        const message = { id: entry.messageId, folder: { accountId: entry.accountId } };
        const result = await classifyAndSortMessage(message);
        if (result.status === 'pending') {
            // Still rate-limited, re-enqueue with incremented retryCount
            const data = await browser.storage.local.get(['pendingQueue']);
            const q = data.pendingQueue || [];
            q.push({
                messageId: entry.messageId,
                accountId: entry.accountId,
                timestamp: Date.now(),
                retryCount: entry.retryCount + 1,
                lastError: result.reason || ''
            });
            await browser.storage.local.set({ pendingQueue: q });
        }
    }
}
```

- [ ] **Step 2: 删除旧的 `_autoSortPending` 声明**

删除 `background.js` L466 的 `let _autoSortPending = [];` 行。

- [ ] **Step 3: 提交**

```bash
git add background.js
git commit -m "feat: add persistent pending queue functions (enqueue/dequeue/recover)"
```

---

### Task 4: Replace In-Memory Queue with Persistent Queue

**Files:**
- Modify: `background.js:1839`, `background.js:1866`, `background.js:1919-1935`

- [ ] **Step 1: 替换 L1839 的 `_autoSortPending.push(message)`**

当前代码：
```js
_autoSortPending.push(message);
```

替换为：
```js
await enqueuePending(message, 'rate_limited');
```

- [ ] **Step 2: 替换 L1866 的 `_autoSortPending.push(message)`**

当前代码：
```js
_autoSortPending.push(message);
return { status: 'pending', reason: 'rate_limited' };
```

替换为：
```js
await enqueuePending(message, 'rate_limited');
return { status: 'pending', reason: 'rate_limited' };
```

- [ ] **Step 3: 替换 L1919-1935 的内存队列重试逻辑**

当前代码（L1919-1935）：
```js
    // Process pending queue (from previous rate-limited batches)
    if (_autoSortPending.length > 0) {
        if (window.debugLogger) {
            window.debugLogger.info('[AutoSort]', `Retrying ${_autoSortPending.length} pending messages`);
        }
        const pendingCopy = [..._autoSortPending];
        _autoSortPending = [];
        for (const msg of pendingCopy) {
            const result = await classifyAndSortMessage(msg);
            if (result.status !== 'pending') {
                stats.success++;
                continue;
            }
            stats.pending++;
            _autoSortPending.push(msg);
        }
    }
```

替换为：
```js
    // Process pending queue from storage
    const pending = await dequeuePending();
    if (pending.length > 0) {
        if (window.debugLogger) {
            window.debugLogger.info('[AutoSort]', `Retrying ${pending.length} pending messages`);
        }
        for (const entry of pending) {
            if (entry.retryCount >= MAX_PENDING_RETRIES) {
                stats.failed++;
                continue;
            }
            const message = { id: entry.messageId, folder: { accountId: entry.accountId } };
            const result = await classifyAndSortMessage(message);
            if (result.status === 'success') {
                stats.success++;
            } else if (result.status === 'pending') {
                // Re-enqueue with incremented retryCount
                const data = await browser.storage.local.get(['pendingQueue']);
                const q = data.pendingQueue || [];
                q.push({
                    messageId: entry.messageId,
                    accountId: entry.accountId,
                    timestamp: Date.now(),
                    retryCount: entry.retryCount + 1,
                    lastError: result.reason || ''
                });
                await browser.storage.local.set({ pendingQueue: q });
                stats.pending++;
            } else {
                stats.failed++;
            }
        }
    }
```

- [ ] **Step 4: 删除 L1933 残留的 `_autoSortPending.push(msg)`**

确保无残留的 `_autoSortPending` 引用。用 `rg _autoSortPending background.js` 确认零匹配。

- [ ] **Step 5: 提交**

```bash
git add background.js
git commit -m "feat: replace in-memory _autoSortPending with persistent storage queue"
```

---

### Task 5: Startup Recovery Hook

**Files:**
- Modify: `background.js:2020` (onStartup listener)

- [ ] **Step 1: 在 onStartup 时恢复队列**

当前代码（L2020-2021）：
```js
browser.runtime.onStartup.addListener(buildContextMenu);
browser.runtime.onInstalled.addListener(buildContextMenu);
```

替换为：
```js
browser.runtime.onStartup.addListener(async () => {
    await buildContextMenu();
    await recoverPendingQueue();
});
browser.runtime.onInstalled.addListener(buildContextMenu);
```

- [ ] **Step 2: 提交**

```bash
git add background.js
git commit -m "feat: recover pending queue on extension startup"
```

---

### Task 6: Unit Tests for Queue Functions

**Files:**
- Create: `test-queue.test.js`

- [ ] **Step 1: 创建测试文件**

创建 `test-queue.test.js`，模拟 `browser.storage.local` 和 `classifyAndSortMessage`，测试核心队列逻辑：

```javascript
/**
 * Tests for persistent pending queue functions.
 * Run: node test-queue.test.js
 */

const assert = require('assert');

// ────────────────────────────────────────────────────────────
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
```

- [ ] **Step 2: 运行测试**

```bash
node test-queue.test.js
```

Expected: All 4 tests pass.

- [ ] **Step 3: 提交**

```bash
git add test-queue.test.js
git commit -m "test: add unit tests for persistent queue functions"
```

---

## Self-Review

### 1. Spec Coverage

| Spec Requirement | Task |
|---|---|
| Menu rebuild notification toast | Task 1 |
| README restart text removal (3 places) | Task 2 |
| `enqueuePending()` function | Task 3 |
| `dequeuePending()` function | Task 3 |
| `recoverPendingQueue()` function | Task 3 |
| Replace `_autoSortPending` at L1839 | Task 4 |
| Replace `_autoSortPending` at L1866 | Task 4 |
| Replace `_autoSortPending` retry logic at L1919-1935 | Task 4 |
| onStartup recovery hook | Task 5 |
| Unit tests for queue | Task 6 |

### 2. Placeholder Scan

No TBD, TODO, "add validation", "similar to" patterns found. All code blocks are complete.

### 3. Type Consistency

- `enqueuePending(message, reason)` — called with `message` object (has `id`, `folder.accountId`) and string reason
- `classifyAndSortMessage(message)` — called in Task 5 with `{ id, folder: { accountId } }` object
- `MAX_PENDING_RETRIES = 3` — defined in Task 3, used in Task 3 (`recoverPendingQueue`) and Task 4 (retry logic)
- `showNotification(title, message)` — used in Task 1, matches existing signature at L812

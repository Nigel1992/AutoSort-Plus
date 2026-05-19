# Design: Dynamic Menu Hot Update + Persistent Async Task Queue

**Date**: 2026-05-19
**Roadmap**: v1.3 (#3) + v2.0 (#3)

---

## Part 1: Dynamic Menu Hot Update Enhancement

### Problem
`rebuildLabelSubmenu()` + `storage.onChanged` 监听器已实现菜单自动刷新，但用户无感知。README 中仍有 3 处提示用户"需要重启 Thunderbird"。

### Solution

#### 1.1 Thunderbird 内通知
在 `rebuildLabelSubmenu()` 成功后，显示短暂的通知提示：

```js
await showNotification("AutoSort+", `Menu updated — ${labels.length} label${labels.length > 1 ? 's' : ''} available`);
```

**文件**: `background.js` — `rebuildLabelSubmenu()` 函数末尾（约 L2016）

#### 1.2 README 文案修复
删除以下 3 处"需要重启 Thunderbird"提示：

| 位置 | 原文 | 替换为 |
|---|---|---|
| L123 | "6. Restart Thunderbird" | "6. Menu auto-updates — no restart needed" |
| L163 | "If you add or change labels... you must restart Thunderbird" | "Labels update automatically in the right-click menu — no restart needed" |
| L296 | 同 L163 | 同 L163 |

**文件**: `README.md`

---

## Part 2: Persistent Async Task Queue

### Problem
- `_autoSortPending[]` 是内存数组，扩展重启后所有 pending 邮件丢失
- 队列重试只在下次触发 `autoSort()` 时执行，没有独立的恢复机制
- 没有持久化存储，也没有队列状态可视化

### Solution

#### 2.1 Queue Data Model
存储于 `browser.storage.local`，key 为 `pendingQueue`：

```js
interface PendingEntry {
  messageId: number;       // Thunderbird message ID
  accountId: string;       // Account identifier
  timestamp: number;       // 入队时间戳
  retryCount: number;      // 已重试次数
  lastError?: string;      // 最后一次错误信息
}
```

#### 2.2 Core Functions

**`enqueuePending(message, error)`**
- 将邮件信息写入 `browser.storage.local` 的 `pendingQueue`
- 替换现有 `_autoSortPending.push(message)` 调用（L1839, L1866）
- 记录错误信息和入队时间

**`dequeuePending()`**
- 从 storage 读取 `pendingQueue`，返回并清空
- 替换现有 `_autoSortPending` 的读取和清空逻辑（L1924-1925）

**`recoverPendingQueue()`**
- 扩展启动时（`onStartup`）自动调用
- 从 storage 恢复队列，逐个重试
- 重试上限：3 次，超过则标记为 `failed` 并从队列移除

#### 2.3 Retry Logic Changes

现有逻辑（`autoSort()` 末尾 L1919-1935）：
```js
// 当前：内存数组
if (_autoSortPending.length > 0) {
  const pendingCopy = [..._autoSortPending];
  _autoSortPending = [];
  for (const msg of pendingCopy) { ... }
}
```

新逻辑：
```js
// 持久化队列
const pending = await dequeuePending();
for (const entry of pending) {
  if (entry.retryCount >= 3) {
    // 超过上限，跳过并记录
    continue;
  }
  const result = await classifyAndSortMessage(entry);
  if (result.status !== 'pending') {
    // 成功或失败，不再入队
    continue;
  }
  // 仍被限流，重新入队并增加 retryCount
  await enqueuePending(entry.message, result.reason);
}
```

#### 2.4 File Changes

| 文件 | 改动 |
|---|---|
| `background.js` | 新增 3 个队列函数；替换 `_autoSortPending` 相关逻辑（约 10 处）；`onStartup` 添加 `recoverPendingQueue()` 调用 |
| `options.js` | （可选）设置页增加"待处理队列"状态显示 |

#### 2.5 Invariants
- 现有 rate-limit 检测逻辑不变
- `batchAnalyzeEmails` 流程不变
- 只改存储层和恢复机制

---

## Self-Review Checklist

- [x] **Placeholder scan**: No TBD/TODO sections
- [x] **Internal consistency**: Architecture matches feature descriptions
- [x] **Scope check**: Focused enough for single implementation plan
- [x] **Ambiguity check**: Retry limit (3) and storage key (`pendingQueue`) are explicit

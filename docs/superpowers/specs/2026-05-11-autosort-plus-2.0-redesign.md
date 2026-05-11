# AutoSort+ 2.0 — 架构重构与功能迭代设计

**日期:** 2026-05-11
**状态:** Draft — 待用户审批
**范围:** 激进式重构 + MV3 迁移 + 新功能 + 测试体系

---

## 1. 概述

### 1.1 目标

将 AutoSort+ 从单文件巨石架构改造为模块化、可测试、可扩展的代码库，同时完成 Manifest V3 迁移，并新增三项用户价值功能。

### 1.2 交付策略

分 4 个独立 PR，每个可独立 review 和合并：

| PR | 名称 | 范围 |
|----|------|------|
| PR1 | 基础设施 | 测试框架 + 核心逻辑测试 |
| PR2 | 核心重构 + MV3 | 拆分 background.js/options.js，迁移 MV3 API |
| PR3 | 功能迭代 | 学习反馈循环 + 准确率统计 + ETA 估算 |
| PR4 | 清理优化 | 删除冗余文件 + manifest 升级 |

### 1.3 约束

- 用户在 Thunderbird 128+ ESR（MV3 已支持）
- Thunderbird MV3 仍使用背景页而非 service worker
- 不支持 ES Modules，使用全局命名空间 `AutoSortPlus`
- `tabs.executeScript` 已移除，必须用 `scripting` API
- `browser.*` 统一改为 `messenger.*`

---

## 2. 架构设计

### 2.1 目标文件结构

```
manifest.json                    ← 升级到 MV3
background.js                    ← 薄入口层（只注册 listener）
options.html                     ← 保持现有 DOM 结构不变
styles.css                       ← 迁移至 options/options.css

src/
  core/
    engine.js                    ← 批量处理引擎（chunk processing, pause/resume/cancel）
    auto-sort.js                 ← 新邮件自动分类监听器
    notification.js              ← 通知系统（show/update/clear）
    storage.js                   ← 存储读写封装 + schema 版本管理

  providers/
    index.js                     ← 提供商注册表（统一入口）
    base.js                      ← 抽象基类（chat/analyze 接口定义）
    gemini.js                    ← Gemini 实现（含 rate limit、多密钥轮换）
    openai.js                    ← OpenAI 实现
    anthropic.js                 ← Claude 实现
    groq.js                      ← Groq 实现
    mistral.js                   ← Mistral 实现
    ollama.js                    ← Ollama 实现（scripting 注入）
    openai-compat.js             ← OpenAI 兼容实现

  features/
    label-match.js               ← 标签匹配/归一化逻辑
    prompt-builder.js            ← 提示词模板 + 占位符注入
    email-extractor.js           ← 邮件内容提取（subject/author/body/attachments）

  utils/
    tab-fetch.js                 ← Tab 注入 fetch（func+args 模式 + files 模式，统一封装）
    injected-stream-fetch.js     ← 注入到 tab 中执行流式请求的脚本（Ollama pull 用）
    concurrency.js               ← 并发控制（processWithConcurrency）
    logger.js                    ← DebugLogger（从现有迁移）
    toast.js                     ← Toast 通知组件（替代 showMessage/alert）
    i18n.js                      ← i18n 工具（从现有迁移）

options/
  options.css                    ← 从 styles.css 迁移
  options.js                     ← 薄入口（组装各模块）
  modules/
    collapsible.js               ← 折叠面板展开/收起 + 状态持久化
    provider-ui.js               ← 提供商选择联动
    api-test.js                  ← 各提供商 API 连接测试
    gemini-keys.js               ← 多密钥增删改查 + 状态展示
    ollama-ui.js                 ← Ollama 专属 UI（下载模型、诊断、列表）
    custom-endpoint-ui.js        ← OpenAI 兼容端点 UI
    folder-manager.js            ← IMAP 文件夹加载 + 批量导入
    history-panel.js             ← 移动历史表格
    batch-panel.js               ← 批量进度面板
    save-handler.js              ← 表单收集 + storage 写入

test/
  unit/
    label-match.test.js
    prompt-builder.test.js
    email-extractor.test.js
    providers/
      gemini.test.js
      ollama.test.js
  integration/
    engine.test.js
    auto-sort.test.js
    notification.test.js
    tab-fetch.test.js
  e2e/
    smoke.test.js
  fixtures/
    sample-emails.js
    mock-providers.js
```

### 2.2 模块依赖关系

```
background.js (薄入口)
  ├── core/engine.js
  │   ├── providers/index.js
  │   ├── features/label-match.js
  │   ├── features/prompt-builder.js
  │   ├── features/email-extractor.js
  │   ├── utils/concurrency.js
  │   └── core/notification.js
  ├── core/auto-sort.js
  │   └── core/engine.js (复用)
  └── core/storage.js

options/modules/ (各模块通过 AutoSortPlus 全局命名空间共享)
  └── 通过 getConfig()/setConfig() 标准接口与 save-handler.js 通信
```

### 2.3 模块通信约定

所有模块向 `AutoSortPlus` 全局对象注册自己的 exports：

```javascript
// src/features/label-match.js
if (!window.AutoSortPlus) window.AutoSortPlus = {};
window.AutoSortPlus.labelMatch = { normalize, findMatch };

// options/modules/provider-ui.js
window.AutoSortPlus.modules.providerUI = new ProviderUI();
```

每个 UI 模块实现标准契约：

```javascript
class ModuleBase {
  getConfig() { return {}; }     // 返回该模块负责的 storage key-value
  setConfig(config) {}            // 从 storage 恢复 UI 状态
  validate() { return { valid: true }; }  // 验证配置
  destroy() {}                    // 清理 listener、timer 等资源
}
```

`SaveHandler` 遍历所有模块调用 `getConfig()` 统一收集，调用 `validate()` 统一校验。

### 2.4 加载顺序

manifest.json `background.scripts` 数组按依赖顺序加载：

```json
"background": {
  "scripts": [
    "src/utils/logger.js",
    "src/utils/i18n.js",
    "src/utils/toast.js",
    "src/utils/tab-fetch.js",
    "src/utils/concurrency.js",
    "src/providers/base.js",
    "src/providers/gemini.js",
    "src/providers/openai.js",
    "src/providers/anthropic.js",
    "src/providers/groq.js",
    "src/providers/mistral.js",
    "src/providers/ollama.js",
    "src/providers/openai-compat.js",
    "src/providers/index.js",
    "src/features/email-extractor.js",
    "src/features/label-match.js",
    "src/features/prompt-builder.js",
    "src/core/storage.js",
    "src/core/notification.js",
    "src/core/auto-sort.js",
    "src/core/engine.js",
    "background.js"
  ]
}
```

options 页面初始化顺序：

```
1. applyTranslations() — 先翻译
2. new CollapsibleManager() — 恢复折叠状态
3. new ProviderUI() — 提供商选择器
4. new APITester() — 依赖 ProviderUI 的当前选择
5. new GeminiKeyManager()
6. new OllamaUI()
7. new CustomEndpointUI()
8. new FolderManager()
9. new HistoryPanel()
10. new BatchPanel()
11. new SaveHandler() — 最后绑定保存按钮
```

跨模块依赖采用**懒查询**策略：模块内部需要其他模块信息时通过 `AutoSortPlus.modules.xxx.getCurrentProvider()` 查询，而非依赖构造顺序。

---

## 3. MV3 迁移清单

### 3.1 manifest.json 变更

| 字段 | MV2 (当前) | MV3 (目标) |
|------|-----------|-----------|
| `manifest_version` | `2` | `3` |
| `browser_action` | `browser_action: {...}` | `action: {...}` |
| `background` | `scripts: ["js/logger.js", "background.js"]` | `scripts: [...按依赖顺序]` |
| 网络权限 | `permissions: ["https://...*", "http://localhost/*"]` | `host_permissions: [...]`（从 permissions 分离） |
| `web_accessible_resources` | `["api_ollama/index.html", ...]` | `[{ resources: [...], matches: ["*://localhost/*", "*://127.0.0.1/*"] }]` |
| 新增权限 | — | `"scripting"`（替代 tabs.executeScript） |

### 3.2 API 调用变更

| API | MV2 (当前) | MV3 (目标) | 影响文件 |
|-----|-----------|-----------|---------|
| `browser.browserAction` | `browser.browserAction.onClicked` | `messenger.action.onClicked` | background.js |
| `browser.tabs.executeScript` | `browser.tabs.executeScript(tabId, {code})` | `messenger.scripting.executeScript({target: {tabId}, func, args})` 或 `{target: {tabId}, files: [...]}` | tab-fetch.js, ollama.js |
| `browser.messages.move` | `browser.messages.move([id], folder.id)` | `messenger.messages.move([id], folder.id)`（参数顺序不变，但只接受 ID） | engine.js |
| `browser.accounts.list` | 默认返回完整文件夹树 | **必须显式传 `true`**: `messenger.accounts.list(true)` | folder-manager.js |
| `account.folders` | `account.folders` | `account.rootFolder` | folder-manager.js |
| `browser.folders.create` | `browser.folders.create(parentFolder, name)` | `messenger.folders.create(parentFolder.id, name)` | engine.js |
| `mailTabs.query` | `{mailTab: true}` | `{type: "mail"}` | background.js |
| `messages.query` | `{folder: f}` | `{folderId: f.id}` | — |
| `messages.list` | `messages.list(folder)` | `messages.list(folder.id)` | — |
| `account.type` | `"none"` 表示本地账户 | `"local"` | — |
| `folder.type` | `folder.type` 属性 | `folder.specialUse` | — |
| `browser.*` | 全局前缀 `browser` | 统一改为 `messenger` | 全项目 |

### 3.3 Tab Injection 重构（MV3 关键变更）

这是最关键的架构变更。当前 Ollama/OpenAI-compatible 使用 `tabs.executeScript(tabId, {code: "..."})` 注入 JS 字符串，MV3 已不支持。

**Context7 验证后采用双模式方案：**

**模式 A：`func` + `args`（简单请求，首选）**

适用于 chat completions 等非流式请求。优势：返回值直接通过 Promise resolve 获得，无需 polling。

```javascript
// src/utils/tab-fetch.js (MV3)
// 这个函数会被序列化到目标 tab 中执行
async function doTabFetch(endpoint, headers, body) {
    const response = await fetch(window.location.origin + endpoint, {
        method: 'POST', headers, body: JSON.stringify(body)
    });
    const data = await response.json();
    return { ok: response.ok, data, status: response.status };
}

async function fetchViaTab(baseUrl, options) {
    const tab = await messenger.tabs.create({ url: baseUrl, active: false });
    try {
        await new Promise(r => setTimeout(r, 500));
        const results = await messenger.scripting.executeScript({
            target: { tabId: tab.id },
            func: doTabFetch,
            args: [options.endpoint, options.headers, options.body]
        });
        return results[0].result;  // 直接拿到返回值
    } finally {
        try { await messenger.tabs.remove(tab.id); } catch {}
    }
}
```

**注意：** `func` 序列化会丢失闭包上下文，函数体内不能使用外部变量，所有参数必须通过 `args` 传入。

**模式 B：`files` + `runtime.sendMessage`（流式请求）**

适用于 Ollama pull 等需要流式读取 response body 的场景（`ReadableStream` 不可序列化，无法通过 `func` 返回值传递）。

```javascript
// src/utils/tab-fetch.js
async function fetchStreamViaTab(baseUrl, options) {
    const tab = await messenger.tabs.create({ url: baseUrl, active: false });
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            messenger.tabs.remove(tab.id).catch(() => {});
            reject(new Error('Stream fetch timeout (30s)'));
        }, 30000);

        const listener = (msg) => {
            if (msg.action === options.resultKey) {
                messenger.runtime.onMessage.removeListener(listener);
                clearTimeout(timeout);
                messenger.tabs.remove(tab.id).catch(() => {});
                resolve(msg.result);
            }
        };
        messenger.runtime.onMessage.addListener(listener);

        messenger.scripting.executeScript({
            target: { tabId: tab.id },
            files: [options.injectFile]  // e.g., "src/utils/injected-stream-fetch.js"
        }).catch(reject);
    });
}
```

### 3.4 mailTabs.query 变更确认

当前代码 `background.js L1933`:
```javascript
const mailTabs = await browser.mailTabs.query({ active: true, currentWindow: true });
```
MV3 下 **不需要变更**，`active` 和 `currentWindow` 参数仍然可用。`mailTab` 属性已移除，但当前代码未使用它。

### 3.5 不需要变更的部分

- `messages.move([ids], folderId)` — 参数顺序不变
- `messenger.runtime.onMessage` — 消息机制不变
- `messenger.storage.local` — 存储 API 不变
- `messenger.notifications` — 通知 API 不变
- `messenger.menus` — 右键菜单 API 不变

---

## 4. 测试体系设计

### 4.1 分层策略

| 层级 | 目录 | 测试对象 | Mock 方式 |
|------|------|---------|----------|
| **单元测试** | `test/unit/` | 纯函数（label-match, prompt-builder, email-extractor） | 无 mock，直接调用 |
| **集成测试** | `test/integration/` | 模块间协作（engine + provider + storage） | `globalThis.messenger = { mock }` |
| **端到端 smoke** | `test/e2e/` | 完整流程：配置 → 选邮件 → 分析 → 移动 | mock fetch + mock messenger |

### 4.2 测试框架

使用 Node.js 内置 `node:test` + `assert`，零依赖。与现有 `test-auto-sort.test.js` 一致。

```json
// package.json (新增)
{
  "scripts": {
    "test": "node --test test/unit/**/*.test.js test/integration/**/*.test.js",
    "test:e2e": "node --test test/e2e/**/*.test.js"
  }
}
```

### 4.3 关键测试用例

**label-match.test.js:**
- 精确匹配
- 大小写不敏感匹配
- 子串匹配（AI 输出 "Work / Finance" → 匹配 "Finance"）
- 引号剥离（`"Finance"` → `Finance`）
- null 值处理

**prompt-builder.test.js:**
- 默认模板渲染（所有占位符替换）
- 自定义模板 + 缺失占位符自动注入
- `{body}` 和 `{email}` 向后兼容
- 占位符 fallback 位置（start/end）

**email-extractor.test.js:**
- 从 multipart MIME 提取纯文本 body
- HTML body 转纯文本
- 附件提取（排除 inline text）
- 嵌套 parts 递归提取

**engine.test.js:**
- 批量处理 chunk 分割
- pause/resume/cancel 状态机
- 单封邮件失败重试逻辑
- 批量完成/取消通知

**tab-fetch.test.js:**
- mock messenger.scripting.executeScript 行为
- 超时处理
- tab 清理（finally 中 remove）

---

## 5. 新增功能设计

### 5.1 功能 1：分类学习反馈循环

**目标：** 当用户手动修改邮件目标文件夹后，系统记住修正，下次类似邮件使用修正后的分类。

**存储结构：**

```javascript
// messenger.storage.local
{
  corrections: [
    {
      messageId: 123,
      aiLabel: "Finance",
      userLabel: "Work",
      subject: "Q3 Budget Report",
      author: "cfo@company.com",
      subjectKeywords: ["budget", "report"],  // 提取的关键词
      timestamp: "2026-05-11T03:00:00Z"
    }
  ]
}
```

**匹配逻辑：** 在 `label-match.js` 中，`analyzeEmailContent` 返回 AI 结果后，先查 corrections 缓存：

1. **精确 author 匹配** — 如果同一发件人有修正记录，直接使用用户的 label
2. **subject 关键词匹配** — 提取 subject 中的关键词（去停用词），与修正记录的 keywords 做交集，超过 2 个匹配则采用用户 label
3. **LRU 淘汰** — 最多 500 条，超出时淘汰最旧的

**不做：** 不使用向量数据库或 ML 模型，仅做规则匹配。

**文件变更：**
- 新增 `src/features/learning.js` — 修正记录管理 + 匹配逻辑
- 修改 `src/core/engine.js` — 在 classifyAndMove 后调用 `recordCorrection()`

### 5.2 功能 2：分类准确率统计

**目标：** 让用户看到 AI 分类的准确率趋势。

**计算逻辑：**

```
accuracy = 1 - (corrections / total_processed)
```

其中 `total_processed` = moveHistory 中成功条目数，`corrections` = corrections 数组长度。

**UI：** 在 options.html 的 AI 设置区增加面板：

```
📈 分类准确率
  总体准确率: 87.3%
  总处理: 1,247 封
  用户修正: 158 封
  ─────────────
  按标签分解:
    Finance: 95% (312/328)
    Personal: 78% (89/114)
    Marketing: 82% (201/245)
    ...
```

**存储：** 在 `corrections` 和 `moveHistory` 基础上实时计算，不额外存储。

**文件变更：**
- 新增 `options/modules/accuracy-panel.js` — 计算 + 渲染准确率面板
- 修改 `options.html` — 增加准确率面板 DOM（唯一需要改 HTML 的地方）

### 5.3 功能 3：批量处理 ETA 估算

**目标：** 在批量处理面板显示预计完成时间。

**实现：**

在 `_batchState` 中增加计时字段：

```javascript
_batchState = {
    running: true,
    // ... existing fields
    startTime: Date.now(),
    chunkTimes: [],           // 每个 chunk 耗时(ms)
    avgChunkTime: 0,          // 滑动平均
};
```

每处理完一个 chunk：

```javascript
const chunkTime = Date.now() - chunkStartTime;
_batchState.chunkTimes.push(chunkTime);
if (_batchState.chunkTimes.length > 10) _batchState.chunkTimes.shift(); // 只保留最近 10 个
_batchState.avgChunkTime = _batchState.chunkTimes.reduce((a,b) => a+b, 0) / _batchState.chunkTimes.length;

// ETA = 剩余 chunk 数 × 平均 chunk 时间
const remainingChunks = _batchState.totalChunks - _batchState.chunkIndex;
const etaMs = remainingChunks * _batchState.avgChunkTime;
```

**UI 显示：**

- `etaMs > 60000` → "预计剩余 3 分钟"
- `etaMs > 10000` → "预计剩余 45 秒"
- `etaMs < 10000` → "即将完成..."

**文件变更：**
- 修改 `src/core/engine.js` — 增加计时逻辑
- 修改 `options/modules/batch-panel.js` — 显示 ETA
- 修改 `options.html` 的 batch 面板 — 增加 ETA 文字区域（已在设计中）

---

## 6. 清理优化设计

### 6.1 删除文件

| 文件 | 原因 |
|------|------|
| `api_ollama/ollama-popup.js` | 旧版 popup 方案，已被 scripting 注入替代 |
| `api_ollama/index.html` | 配合 ollama-popup.js 使用的 UI |
| `js/workers/ollama-worker.js` | 从未被引用，孤立代码 |
| `js/ollama.js` | 仅被 worker 引用，worker 删除后无用 |

### 6.2 合并代码

| 现状 | 目标 |
|------|------|
| `background.js` 中 `ollamaChatViaTab` + `openaiCompatibleChatViaTab` | 合并到 `src/utils/tab-fetch.js` |
| `js/tab-fetch-utils.js` 中的重复实现 | 合并到 `src/utils/tab-fetch.js` |
| `background.js` 中的 `PROVIDERS` 常量 + `js/providers-config.js` | 统一到 `src/providers/index.js` |

### 6.3 Manifest 清理

- 删除 `web_accessible_resources` 中 `api_ollama/` 相关条目
- 删除 `content_scripts` 中 `content.js`（如果 MV3 下不再需要）

---

## 7. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| `tabs.executeScript` → `scripting` 注入失败 | Ollama/OpenAI-compatible 完全不可用 | PR2 中优先验证 tab injection 在 Thunderbird 128+ MV3 下的可行性 |
| `accounts.list(true)` 在大型邮箱账户中性能下降 | 加载文件夹超时 | 增加 timeout + 渐进加载 UI |
| 重构后 options.js 行为不一致 | 用户设置丢失 | 所有 storage key 保持不变，`getConfig()/setConfig()` 与现有 key 1:1 映射 |
| 测试覆盖不足导致回归 | 生产环境 bug | PR1 先行建立核心逻辑的 90%+ 覆盖率 baseline |

---

## 8. PR 分解详细计划

### PR1: 基础设施（~200 行新增）

- 创建 `test/` 目录结构
- 创建 `package.json` (test scripts)
- 编写 5 个单元测试文件
- 编写 3 个集成测试文件
- CI: 验证 `npm test` 通过

**不变更生产代码。**

### PR2: 核心重构 + MV3（~2000 行重构）

- 创建 `src/` 目录，拆分 `background.js` 为 10+ 模块
- 创建 `options/` 目录，拆分 `options.js` 为 10+ 模块
- 实现 `tab-fetch.js` + `injected-fetch.js`（MV3 scripting）
- 更新 `manifest.json` 到 MV3
- 全部 API 调用从 `browser.*` 改为 `messenger.*`
- 修复所有 MV3 breaking changes
- 保持 100% 行为兼容（通过 PR1 测试验证）

### PR3: 功能迭代（~400 行新增）

- `src/features/learning.js` — 学习反馈逻辑
- `options/modules/accuracy-panel.js` — 准确率面板
- 修改 `src/core/engine.js` — ETA 计时
- 修改 `options/modules/batch-panel.js` — ETA 显示
- 修改 `options.html` — 增加准确率面板（唯一 HTML 变更）

### PR4: 清理优化（~50 行删除）

- 删除 4 个冗余文件
- 清理 manifest 中废弃条目
- 最终 MV3 manifest 确认

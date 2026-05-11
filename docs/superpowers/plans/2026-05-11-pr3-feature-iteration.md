# PR3: Feature Iteration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three user-facing features on top of the refactored architecture: learning feedback loop, accuracy statistics panel, and batch ETA estimation.

**Architecture:** All features build on the PR2 modular architecture (`AutoSortPlus.*` namespace). New modules follow existing patterns. No existing behavior changes.

**Tech Stack:** Vanilla JS, `messenger.storage.local`, Thunderbird MV3 WebExtension.

---

## File Structure (all new/modified)

```
src/features/learning.js               ← NEW: correction tracking + matching
options/modules/accuracy-panel.js      ← NEW: accuracy stats calculation + rendering
options/modules/batch-panel.js         ← MODIFIED: add ETA display
options.html                           ← MODIFIED: add accuracy panel DOM (only HTML change)
test/unit/learning.test.js             ← NEW: learning feedback tests
```

---

### Task 1: Create Learning Feedback Module

**Files:**
- Create: `src/features/learning.js`
- Modify: `src/core/engine.js` (add correction recording after label application)

**Purpose:** When a user manually moves an email to a different folder than the AI suggested, record the correction. Future emails from the same sender or with similar subjects will use the user's preference.

**Storage structure:**
```javascript
messenger.storage.local.get('corrections') → [
  { messageId, aiLabel, userLabel, subject, author, subjectKeywords: [...], timestamp }
]
```

**Matching logic (in `learning.js`):**
1. Exact author match → return user's label
2. Subject keyword overlap (≥2 keywords match) → return user's label
3. No match → return null (let AI decide)

**Keyword extraction:** Split subject on non-alphanumeric chars, remove stop words (the, a, an, is, re, fwd, etc.), lowercase, deduplicate.

**LRU eviction:** Max 500 entries, remove oldest.

**Integration point:** In `engine.analyzeEmailContent()`, after the AI returns a label but before the label match, call `AutoSortPlus.learning.findCorrection(subject, author)`. If a correction is found, use it instead of the AI label.

Also add `engine.recordCorrection(messageId, aiLabel, userLabel, subject, author)` called from `engine.applyLabelsToMessages()` when the user manually overrides a label (detected via context menu manual label application).

```javascript
// src/features/learning.js (key parts)
if (!window.AutoSortPlus) window.AutoSortPlus = {};

const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 're', 'fwd', 'fw', 'to', 'of', 'for', 'in', 'on', 'at', 'by', 'with', 'and', 'or', 'but', 'not', 'it', 'its', 'this', 'that']);

window.AutoSortPlus.learning = {
  MAX_CORRECTIONS: 500,

  extractKeywords(subject) {
    if (!subject) return [];
    return [...new Set(
      subject.toLowerCase()
        .replace(/[^a-z0-9一-鿿\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    )];
  },

  async findCorrection(subject, author) {
    const { corrections = [] } = await messenger.storage.local.get('corrections');
    if (corrections.length === 0) return null;

    // Exact author match
    if (author) {
      const authorMatch = corrections.find(c => c.author?.toLowerCase() === author.toLowerCase());
      if (authorMatch) return authorMatch.userLabel;
    }

    // Subject keyword overlap
    const keywords = this.extractKeywords(subject);
    if (keywords.length < 2) return null;

    for (const c of corrections) {
      if (!c.subjectKeywords) continue;
      const overlap = keywords.filter(k => c.subjectKeywords.includes(k));
      if (overlap.length >= 2) return c.userLabel;
    }

    return null;
  },

  async recordCorrection(messageId, aiLabel, userLabel, subject, author) {
    const { corrections = [] } = await messenger.storage.local.get('corrections');

    // Remove any existing correction for this messageId
    const existingIdx = corrections.findIndex(c => c.messageId === messageId);
    if (existingIdx >= 0) corrections.splice(existingIdx, 1);

    corrections.unshift({
      messageId, aiLabel, userLabel, subject, author,
      subjectKeywords: this.extractKeywords(subject),
      timestamp: new Date().toISOString()
    });

    // LRU eviction
    while (corrections.length > this.MAX_CORRECTIONS) corrections.pop();

    await messenger.storage.local.set({ corrections });
  }
};
```

**Engine modification** — Add to `engine.analyzeEmailContent()`:

```javascript
// Before dispatching to AI provider, check for learned corrections
const correction = await AutoSortPlus.learning.findMatch(emailContext?.subject, emailContext?.author);
if (correction) {
  if (window.debugLogger) window.debugLogger.info('[Learning]', `Using learned correction: ${correction}`);
  return correction;
}
```

And in `engine.applyLabelsToMessages()`, when the user manually applies a label via context menu (detected by the `manual` flag), record the correction:

```javascript
// At the start of applyLabelsToMessages, accept an optional `manual` parameter
async applyLabelsToMessages(messages, label, manual = false) {
  // ... existing code ...
  if (manual && messages.length === 1) {
    // Get the full message context for correction recording
    const fullMessage = await messenger.messages.getFull(messages[0].id);
    if (fullMessage) {
      const ctx = await AutoSortPlus.emailExtractor.extract(fullMessage, messages[0]);
      await AutoSortPlus.learning.recordCorrection(
        messages[0].id, label, label, ctx.subject, ctx.author
      );
    }
  }
}
```

- [ ] Create `src/features/learning.js`
- [ ] Modify `src/core/engine.js` to integrate learning (add findCorrection check + recordCorrection call)
- [ ] Verify `npm run test:all` still passes
- [ ] Commit

---

### Task 2: Create Accuracy Panel Module

**Files:**
- Create: `options/modules/accuracy-panel.js`
- Modify: `options.html` (add accuracy panel DOM section)
- Modify: `options/options.js` (instantiate AccuracyPanel)

**Purpose:** Show the user AI sorting accuracy statistics computed from move history and corrections.

**Calculation:**
```
totalProcessed = moveHistory.filter(h => h.status === 'Success').length
totalCorrections = corrections.length
accuracy = totalProcessed > 0 ? ((totalProcessed - totalCorrections) / totalProcessed * 100) : 0
```

**Per-label breakdown:** Group move history by destination, count corrections per label (match correction's `aiLabel` to the destination).

**UI placement:** Add after the "General Settings" subsection in options.html, before the "Gemini API Usage" subsection:

```html
<!-- Accuracy Panel -->
<div class="subsection ai-info-subsection" id="accuracy-subsection">
    <h3 data-i18n="accuracyTitle">📈 Classification Accuracy</h3>
    <div id="accuracy-stats">
        <div class="accuracy-overview">
            <span class="accuracy-label" data-i18n="overallAccuracy">Overall Accuracy:</span>
            <span class="accuracy-value" id="accuracy-value">--%</span>
        </div>
        <div class="accuracy-details">
            <span data-i18n="totalProcessed">Total Processed:</span> <span id="accuracy-total">0</span>
            <span data-i18n="corrections">Corrections:</span> <span id="accuracy-corrections">0</span>
        </div>
        <div id="accuracy-by-label" class="accuracy-by-label"></div>
    </div>
    <div class="button-group">
        <button id="refresh-accuracy" class="button" data-i18n="refreshAccuracy">Refresh</button>
    </div>
</div>
```

**Module code:**

```javascript
// options/modules/accuracy-panel.js
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
        `<div class="label-stat-row"><span class="label-stat-name">${s.label}</span><span class="label-stat-accuracy">${s.accuracy}% (${s.correct}/${s.total})</span></div>`
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
    // Count corrections per aiLabel
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

  destroy() {}
}
```

Add i18n keys to both `_locales/en/messages.json` and `_locales/zh_CN/messages.json`:

```json
// _locales/en/messages.json (append)
"accuracyTitle": { "message": "📈 Classification Accuracy", "description": "Accuracy stats panel title" },
"overallAccuracy": { "message": "Overall Accuracy:", "description": "Overall accuracy label" },
"totalProcessed": { "message": "Total Processed:", "description": "Total processed count" },
"corrections": { "message": "Corrections:", "description": "Corrections count" },
"refreshAccuracy": { "message": "Refresh", "description": "Refresh accuracy button" },

// _locales/zh_CN/messages.json (append)
"accuracyTitle": { "message": "📈 分类准确率", "description": "准确率面板标题" },
"overallAccuracy": { "message": "总体准确率：", "description": "总体准确率标签" },
"totalProcessed": { "message": "总处理：", "description": "总处理数" },
"corrections": { "message": "修正：", "description": "修正数" },
"refreshAccuracy": { "message": "刷新", "description": "刷新准确率按钮" },
```

- [ ] Create `options/modules/accuracy-panel.js`
- [ ] Add accuracy panel HTML to `options.html`
- [ ] Instantiate `AccuracyPanel` in `options/options.js`
- [ ] Add i18n keys to both locale files
- [ ] Verify `npm run test:all` still passes
- [ ] Commit

---

### Task 3: Add ETA to Batch Panel

**Files:**
- Modify: `src/core/engine.js` (add ETA tracking fields and calculation)
- Modify: `options/modules/batch-panel.js` (display ETA)

**Engine changes** — Add to `_batchState` initialization and chunk processing:

```javascript
// In _resetBatchState:
this._batchState = {
  ...existing fields...,
  startTime: Date.now(),
  chunkTimes: [],    // last 10 chunk durations in ms
  avgChunkTime: 0
};

// After each chunk completes in batchAnalyzeEmails:
const chunkTime = Date.now() - chunkStart;
_batchState.chunkTimes.push(chunkTime);
if (_batchState.chunkTimes.length > 10) _batchState.chunkTimes.shift();
_batchState.avgChunkTime = _batchState.chunkTimes.reduce((a, b) => a + b, 0) / _batchState.chunkTimes.length;

// ETA calculation
const remainingChunks = _batchState.totalChunks - _batchState.chunkIndex;
const etaMs = remainingChunks * _batchState.avgChunkTime;

// Include etaMs in _broadcastBatchProgress payload
payload.etaMs = etaMs;
payload.avgChunkTime = _batchState.avgChunkTime;
```

**BatchPanel changes** — Add ETA display:

```javascript
// In _updatePanel, after setting progress text:
if (this.text && payload.etaMs != null && payload.etaMs > 0 && status === 'running') {
  const etaText = payload.etaMs > 60000
    ? `${i18n.get('etaMinutes', [Math.ceil(payload.etaMs / 60000)])}`
    : payload.etaMs > 10000
      ? `${i18n.get('etaSeconds', [Math.round(payload.etaMs / 1000)])}`
      : i18n.get('etaAlmostDone');
  this.text.textContent += ` — ${etaText}`;
}
```

Add i18n keys:

```json
// _locales/en/messages.json
"etaMinutes": { "message": "~{minutes} min remaining", "description": "ETA in minutes", "placeholders": { "minutes": { "content": "$1" } } },
"etaSeconds": { "message": "~{seconds} sec remaining", "description": "ETA in seconds", "placeholders": { "seconds": { "content": "$1" } } },
"etaAlmostDone": { "message": "Almost done...", "description": "ETA when nearly complete" },

// _locales/zh_CN/messages.json
"etaMinutes": { "message": "约{minutes}分钟剩余", "description": "ETA（分钟）", "placeholders": { "minutes": { "content": "$1" } } },
"etaSeconds": { "message": "约{seconds}秒剩余", "description": "ETA（秒）", "placeholders": { "seconds": { "content": "$1" } } },
"etaAlmostDone": { "message": "即将完成...", "description": "ETA（即将完成）" },
```

- [ ] Modify `src/core/engine.js` to add ETA tracking
- [ ] Modify `options/modules/batch-panel.js` to display ETA
- [ ] Add i18n keys for ETA
- [ ] Verify `npm run test:all` still passes
- [ ] Commit

---

### Task 4: Add Learning Feedback Tests

**Files:**
- Create: `test/unit/learning.test.js`

```javascript
// test/unit/learning.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Extract the pure functions from learning.js for unit testing
const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'are', 'was', 're', 'fwd', 'fw', 'to', 'of', 'for', 'in', 'on', 'at', 'by', 'with', 'and', 'or', 'but', 'not', 'it', 'its', 'this', 'that']);

function extractKeywords(subject) {
  if (!subject) return [];
  return [...new Set(
    subject.toLowerCase()
      .replace(/[^a-z0-9一-鿿\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))
  )];
}

function findCorrection(subject, author, corrections) {
  // Exact author match
  if (author) {
    const match = corrections.find(c => c.author?.toLowerCase() === author.toLowerCase());
    if (match) return match.userLabel;
  }
  // Subject keyword overlap
  const keywords = extractKeywords(subject);
  if (keywords.length < 2) return null;
  for (const c of corrections) {
    if (!c.subjectKeywords) continue;
    const overlap = keywords.filter(k => c.subjectKeywords.includes(k));
    if (overlap.length >= 2) return c.userLabel;
  }
  return null;
}

describe('keyword extraction', () => {
  it('extracts meaningful keywords', () => {
    const keywords = extractKeywords('Q3 Budget Report');
    assert.ok(keywords.includes('q3'));
    assert.ok(keywords.includes('budget'));
    assert.ok(keywords.includes('report'));
  });

  it('removes stop words', () => {
    const keywords = extractKeywords('Re: The new project proposal');
    assert.ok(!keywords.includes('the'));
    assert.ok(!keywords.includes('re'));
    assert.ok(keywords.includes('new'));
    assert.ok(keywords.includes('project'));
    assert.ok(keywords.includes('proposal'));
  });

  it('handles empty/null input', () => {
    assert.deepStrictEqual(extractKeywords(''), []);
    assert.deepStrictEqual(extractKeywords(null), []);
    assert.deepStrictEqual(extractKeywords(undefined), []);
  });

  it('deduplicates keywords', () => {
    const keywords = extractKeywords('budget budget budget');
    assert.strictEqual(keywords.filter(k => k === 'budget').length, 1);
  });

  it('handles Chinese characters', () => {
    const keywords = extractKeywords('季度预算报告');
    assert.ok(keywords.length > 0);
  });
});

describe('correction matching', () => {
  const corrections = [
    { messageId: 1, aiLabel: 'Finance', userLabel: 'Work', author: 'boss@company.com', subject: 'Q3 Budget', subjectKeywords: ['q3', 'budget'], timestamp: '2026-05-11T03:00:00Z' },
    { messageId: 2, aiLabel: 'Marketing', userLabel: 'Personal', author: 'newsletter@shop.com', subject: 'Weekly Deals', subjectKeywords: ['weekly', 'deals'], timestamp: '2026-05-10T03:00:00Z' }
  ];

  it('matches by exact author', () => {
    const result = findCorrection('Any Subject', 'boss@company.com', corrections);
    assert.strictEqual(result, 'Work');
  });

  it('matches by subject keyword overlap (2+ keywords)', () => {
    const result = findCorrection('Q3 budget planning', 'unknown@test.com', corrections);
    assert.strictEqual(result, 'Work');
  });

  it('returns null with no match', () => {
    const result = findCorrection('Random email', 'random@test.com', corrections);
    assert.strictEqual(result, null);
  });

  it('returns null with only 1 keyword match', () => {
    const result = findNotification('Just the budget', 'unknown@test.com', corrections);
    // Only "budget" matches, need 2+
    assert.strictEqual(findCorrection('Just the budget', 'unknown@test.com', corrections), null);
  });

  it('handles empty corrections array', () => {
    assert.strictEqual(findCorrection('Test', 'a@b.com', []), null);
  });

  it('case-insensitive author matching', () => {
    const result = findCorrection('Any', 'BOSS@COMPANY.COM', corrections);
    assert.strictEqual(result, 'Work');
  });
});
```

- [ ] Create `test/unit/learning.test.js`
- [ ] Run `node --test test/unit/learning.test.js` → all pass
- [ ] Commit

---

### Task 5: Final Verification

- [ ] Run `npm run test:all` → 60 + new learning tests pass
- [ ] Verify no production code breakage: `npm run test:all`
- [ ] Verify i18n keys exist in both locales: `grep -c "accuracyTitle" _locales/en/messages.json _locales/zh_CN/messages.json` (should be 1 in each)
- [ ] Final commit

```bash
git add -A
git commit -m "feat: PR3 complete — learning feedback, accuracy stats, ETA

- learning.js: correction tracking with author match + keyword overlap
- accuracy-panel.js: overall + per-label accuracy statistics
- engine.js: ETA tracking with sliding window chunk times
- batch-panel.js: ETA display in progress panel
- i18n: accuracy + ETA keys in en/zh_CN
- learning.test.js: keyword extraction + correction matching tests"
```

---

## Self-Review

### Spec Coverage

| Spec Requirement | Task |
|-----------------|------|
| Learning feedback loop | Task 1 (learning.js + engine integration) |
| Accuracy statistics | Task 2 (accuracy-panel.js + options.html + i18n) |
| Batch ETA estimation | Task 3 (engine.js + batch-panel.js + i18n) |
| Test coverage for learning | Task 4 (learning.test.js) |
| i18n for new UI text | Tasks 2, 3, 4 |
| No breaking changes | Task 5 (verify all existing tests pass) |

### Placeholder Scan

No TBD, TODO, or incomplete sections. All code is complete with actual implementations.

### Scope Check

PR3 is the smallest PR (~400 lines new code, ~20 lines modified). Features are additive — no existing behavior is changed. The only HTML change is adding the accuracy panel to options.html.

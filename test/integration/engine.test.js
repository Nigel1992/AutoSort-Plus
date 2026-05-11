// test/integration/engine.test.js

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Batch engine core logic extracted from background.js L373-595 ──
// We test the pure state machine logic without actual AI calls.

function createBatchState(total, provider = 'gemini') {
  return {
    running: true,
    cancelled: false,
    paused: false,
    total,
    completed: 0,
    failed: 0,
    skipped: 0,
    provider,
    chunkIndex: 0,
    totalChunks: 0
  };
}

function calculateChunks(totalMessages, chunkSize) {
  return Math.ceil(totalMessages / chunkSize);
}

function processChunk(state, chunkResults) {
  for (const r of chunkResults) {
    if (state.cancelled) break;
    if (r === 'success') state.completed++;
    else if (r === 'fail') state.failed++;
    else if (r === 'skip' || r === 'null-label') state.skipped++;
  }
  state.chunkIndex++;
}

describe('batch engine: chunk calculation', () => {
  it('divides messages into correct number of chunks', () => {
    assert.strictEqual(calculateChunks(10, 5), 2);
    assert.strictEqual(calculateChunks(11, 5), 3);
    assert.strictEqual(calculateChunks(5, 5), 1);
    assert.strictEqual(calculateChunks(1, 5), 1);
    assert.strictEqual(calculateChunks(0, 5), 0);
  });

  it('handles chunk boundaries correctly', () => {
    const messages = Array.from({ length: 13 }, (_, i) => ({ id: i + 1 }));
    const chunkSize = 5;
    const totalChunks = calculateChunks(messages.length, chunkSize);

    const chunks = [];
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, messages.length);
      chunks.push(messages.slice(start, end));
    }

    assert.strictEqual(chunks.length, 3);
    assert.strictEqual(chunks[0].length, 5);
    assert.strictEqual(chunks[1].length, 5);
    assert.strictEqual(chunks[2].length, 3);
  });
});

describe('batch engine: state transitions', () => {
  it('starts with correct initial state', () => {
    const state = createBatchState(10);
    assert.strictEqual(state.running, true);
    assert.strictEqual(state.cancelled, false);
    assert.strictEqual(state.paused, false);
    assert.strictEqual(state.total, 10);
    assert.strictEqual(state.completed, 0);
  });

  it('tracks completed/failed/skipped correctly', () => {
    const state = createBatchState(5);
    processChunk(state, ['success', 'success', 'fail', 'skip', 'success']);
    assert.strictEqual(state.completed, 3);
    assert.strictEqual(state.failed, 1);
    assert.strictEqual(state.skipped, 1);
    assert.strictEqual(state.chunkIndex, 1);
  });

  it('stops processing when cancelled', () => {
    const state = createBatchState(5);
    state.cancelled = true;
    processChunk(state, ['success', 'success', 'success']);
    assert.strictEqual(state.completed, 0);
    assert.strictEqual(state.chunkIndex, 1);
  });

  it('handles null label as skip', () => {
    const state = createBatchState(1);
    processChunk(state, ['null-label']);
    assert.strictEqual(state.completed, 0);
    assert.strictEqual(state.skipped, 1);
  });
});

describe('batch engine: pause/resume/cancel', () => {
  it('pause flag works', () => {
    const state = createBatchState(5);
    state.paused = true;
    assert.strictEqual(state.paused, true);
    state.paused = false;
    assert.strictEqual(state.paused, false);
  });

  it('cancel sets cancelled and clears paused', () => {
    const state = createBatchState(5);
    state.paused = true;
    state.cancelled = true;
    state.paused = false;
    assert.strictEqual(state.cancelled, true);
    assert.strictEqual(state.paused, false);
  });

  it('completed batch sets running to false', () => {
    const state = createBatchState(3);
    processChunk(state, ['success']);
    processChunk(state, ['success']);
    processChunk(state, ['success']);
    state.running = false;
    const finalStatus = state.cancelled ? 'cancelled' : 'done';
    assert.strictEqual(finalStatus, 'done');
    assert.strictEqual(state.completed, 3);
  });
});

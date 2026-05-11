/**
 * Tests for autoSortEnabled default value and storage migration.
 * Run: node test-auto-sort.test.js
 */

const assert = require('assert');

// ─────────────────────────────────────────────────────────────
// Simulate the background.js handleNewMail check logic
// This mirrors the ACTUAL code path, so we can verify the fix.
// ─────────────────────────────────────────────────────────────

/**
 * Current behavior (before fix): strict check, undefined = disabled.
 * This is extracted from background.js L1836.
 */
function handleNewMailCheck_BEFORE_FIX(storageResult) {
    if (!storageResult.autoSortEnabled) return false; // early return
    if (storageResult.enableAi === false) return false;
    return true;
}

/**
 * Fixed behavior: undefined defaults to enabled (backward compat).
 */
function handleNewMailCheck_AFTER_FIX(storageResult) {
    const autoSortEnabled = storageResult.autoSortEnabled !== false;
    if (!autoSortEnabled) return false;
    if (storageResult.enableAi === false) return false;
    return true;
}

// ─────────────────────────────────────────────────────────────
// Simulate the options.js save logic
// ─────────────────────────────────────────────────────────────

/**
 * Current behavior (before fix): checkbox unchecked = false.
 * Mirrors options.js L1417.
 */
function getAutoSortValue_BEFORE_FIX(checkboxChecked) {
    return checkboxChecked; // defaults to false if checkbox unchecked
}

/**
 * Fixed behavior: defaults to true.
 */
function getAutoSortValue_AFTER_FIX(checkboxChecked, checkboxDefault = true) {
    return checkboxChecked !== undefined ? checkboxChecked : checkboxDefault;
}

// ─────────────────────────────────────────────────────────────
// Simulate storage migration
// ─────────────────────────────────────────────────────────────

/**
 * Migrates legacy storage to include autoSortEnabled.
 */
function migrateAutoSortStorage(storageResult) {
    if (storageResult.autoSortEnabled === undefined) {
        storageResult.autoSortEnabled = true;
    }
    return storageResult;
}

// ─────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
        passed++;
    } catch (e) {
        console.log(`✗ ${name}`);
        console.log(`  ${e.message}`);
        failed++;
    }
}

// ── BEFORE FIX: Verify current behavior is broken ──

console.log('\n── BEFORE FIX (should show the bug) ──\n');

test('BEFORE: new user (undefined autoSortEnabled) → auto-sort DISABLED (BUG)', () => {
    const storage = {}; // fresh install, no autoSortEnabled key
    const result = handleNewMailCheck_BEFORE_FIX(storage);
    assert.strictEqual(result, false, 'Expected auto-sort to be disabled for new users');
});

test('BEFORE: user who migrated from old version → auto-sort DISABLED (BUG)', () => {
    const storage = { enableAi: true }; // old storage, no autoSortEnabled
    const result = handleNewMailCheck_BEFORE_FIX(storage);
    assert.strictEqual(result, false, 'Expected auto-sort to be disabled for migrated users');
});

test('BEFORE: user who explicitly enabled → auto-sort ENABLED', () => {
    const storage = { autoSortEnabled: true, enableAi: true };
    const result = handleNewMailCheck_BEFORE_FIX(storage);
    assert.strictEqual(result, true);
});

test('BEFORE: user who explicitly disabled → auto-sort DISABLED', () => {
    const storage = { autoSortEnabled: false, enableAi: true };
    const result = handleNewMailCheck_BEFORE_FIX(storage);
    assert.strictEqual(result, false);
});

// ── AFTER FIX: Verify corrected behavior ──

console.log('\n── AFTER FIX (should all pass) ──\n');

test('AFTER: new user (undefined autoSortEnabled) → auto-sort ENABLED', () => {
    const storage = {};
    const result = handleNewMailCheck_AFTER_FIX(storage);
    assert.strictEqual(result, true, 'Expected auto-sort to be enabled by default');
});

test('AFTER: user who migrated from old version → auto-sort ENABLED', () => {
    const storage = { enableAi: true };
    const result = handleNewMailCheck_AFTER_FIX(storage);
    assert.strictEqual(result, true, 'Expected auto-sort to be enabled for migrated users');
});

test('AFTER: user who explicitly disabled → auto-sort DISABLED (respect choice)', () => {
    const storage = { autoSortEnabled: false, enableAi: true };
    const result = handleNewMailCheck_AFTER_FIX(storage);
    assert.strictEqual(result, false, 'Expected explicit false to be respected');
});

test('AFTER: user who explicitly enabled → auto-sort ENABLED', () => {
    const storage = { autoSortEnabled: true, enableAi: true };
    const result = handleNewMailCheck_AFTER_FIX(storage);
    assert.strictEqual(result, true);
});

test('AFTER: enableAi disabled → auto-sort DISABLED regardless of autoSortEnabled', () => {
    const storage = { autoSortEnabled: true, enableAi: false };
    const result = handleNewMailCheck_AFTER_FIX(storage);
    assert.strictEqual(result, false);
});

test('AFTER: both undefined → auto-sort ENABLED (both default to on)', () => {
    const storage = {};
    const result = handleNewMailCheck_AFTER_FIX(storage);
    assert.strictEqual(result, true);
});

// ── Migration test ──

console.log('\n── Storage Migration ──\n');

test('Migration: adds autoSortEnabled=true when missing', () => {
    const storage = { enableAi: true };
    const migrated = migrateAutoSortStorage({ ...storage });
    assert.strictEqual(migrated.autoSortEnabled, true);
});

test('Migration: does not overwrite existing true', () => {
    const storage = { autoSortEnabled: true };
    const migrated = migrateAutoSortStorage({ ...storage });
    assert.strictEqual(migrated.autoSortEnabled, true);
});

test('Migration: does not overwrite existing false', () => {
    const storage = { autoSortEnabled: false };
    const migrated = migrateAutoSortStorage({ ...storage });
    assert.strictEqual(migrated.autoSortEnabled, false);
});

// ── Summary ──

console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`);
process.exit(failed > 0 ? 1 : 0);

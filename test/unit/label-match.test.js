// test/unit/label-match.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Extracted from background.js L1470-1483 ──
// Pure functions for normalizing AI output and matching to labels.

function normalize(s) {
  if (!s) return '';
  return s.toString().trim().replace(/^['"`]+|['"`]+$/g, '');
}

function findLabel(aiOutput, configuredLabels) {
  if (!aiOutput) return null;

  const lower = normalize(aiOutput).toLowerCase();

  // Exact match first
  if (configuredLabels.includes(aiOutput)) {
    return aiOutput;
  }

  // Case-insensitive match
  let matched = configuredLabels.find(l => l.toLowerCase() === lower);
  if (matched) return matched;

  // Substring match (AI output contains label or vice versa)
  matched = configuredLabels.find(
    l => lower.includes(l.toLowerCase()) || l.toLowerCase().includes(lower)
  );
  return matched || null;
}

describe('label normalization', () => {
  it('strips leading/trailing quotes', () => {
    assert.strictEqual(normalize('"Finance"'), 'Finance');
    assert.strictEqual(normalize("'Work'"), 'Work');
    assert.strictEqual(normalize('`Personal`'), 'Personal');
  });

  it('trims whitespace', () => {
    assert.strictEqual(normalize('  Finance  '), 'Finance');
    assert.strictEqual(normalize('\tMarketing\n'), 'Marketing');
  });

  it('handles null/undefined/empty', () => {
    assert.strictEqual(normalize(null), '');
    assert.strictEqual(normalize(undefined), '');
    assert.strictEqual(normalize(''), '');
  });

  it('preserves internal quotes', () => {
    assert.strictEqual(normalize('"Work / Finance"'), 'Work / Finance');
  });

  it('converts non-string to string', () => {
    assert.strictEqual(normalize(123), '123');
    assert.strictEqual(normalize(true), 'true');
  });
});

describe('label matching', () => {
  const labels = ['Finance', 'Marketing', 'Personal', 'Work / Projects'];

  it('returns null for null input', () => {
    assert.strictEqual(findLabel(null, labels), null);
    assert.strictEqual(findLabel('', labels), null);
  });

  it('exact match returns the label', () => {
    assert.strictEqual(findLabel('Finance', labels), 'Finance');
    assert.strictEqual(findLabel('Marketing', labels), 'Marketing');
  });

  it('case-insensitive match returns the label', () => {
    assert.strictEqual(findLabel('finance', labels), 'Finance');
    assert.strictEqual(findLabel('FINANCE', labels), 'Finance');
    assert.strictEqual(findLabel('MaRkEtInG', labels), 'Marketing');
  });

  it('AI output containing label matches', () => {
    assert.strictEqual(findLabel('This should go to Finance', labels), 'Finance');
    assert.strictEqual(findLabel('Category: Marketing department', labels), 'Marketing');
  });

  it('label containing AI output matches', () => {
    assert.strictEqual(findLabel('Projects', labels), 'Work / Projects');
  });

  it('quoted AI output matches', () => {
    assert.strictEqual(findLabel('"Finance"', labels), 'Finance');
    assert.strictEqual(findLabel("'Marketing'", labels), 'Marketing');
  });

  it('returns null when no match found', () => {
    assert.strictEqual(findLabel('Sports', labels), null);
    assert.strictEqual(findLabel('null', labels), null);
  });

  it('matches "null" string returns null', () => {
    // The engine checks for "null" separately, but label-match should
    // still return null if "null" is not in configured labels
    assert.strictEqual(findLabel('null', ['Finance']), null);
  });

  it('prefers exact match over substring', () => {
    // If AI returns "Finance" and labels has both "Finance" and "Corporate Finance"
    const extendedLabels = ['Finance', 'Corporate Finance'];
    assert.strictEqual(findLabel('Finance', extendedLabels), 'Finance');
  });
});

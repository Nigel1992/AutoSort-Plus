import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Extract pure functions from learning.js for unit testing
const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 're', 'fwd', 'fw', 'to', 'of', 'for', 'in', 'on', 'at', 'by', 'with', 'and', 'or', 'but', 'not', 'it', 'its', 'this', 'that']);

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
  if (!author && corrections.length === 0) return null;

  // Exact author match
  if (author) {
    const match = corrections.find(c => c.author?.toLowerCase() === author.toLowerCase());
    if (match) return match.userLabel;
  }

  // Subject keyword overlap (need 2+ keywords)
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
    assert.ok(keywords.includes('budget'));
    assert.ok(keywords.includes('report'));
    // 'q3' is 2 chars, filtered out by length > 2 rule
    assert.ok(!keywords.includes('q3'));
  });

  it('removes stop words', () => {
    const keywords = extractKeywords('Re: The new project proposal');
    assert.ok(!keywords.includes('the'));
    assert.ok(!keywords.includes('re'));
    assert.ok(keywords.includes('new'));
    assert.ok(keywords.includes('project'));
    assert.ok(keywords.includes('proposal'));
  });

  it('handles empty/null/undefined input', () => {
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
    const result = findCorrection('weekly deals newsletter', 'unknown@test.com', corrections);
    assert.strictEqual(result, 'Personal');
  });

  it('returns null with no match', () => {
    const result = findCorrection('Random email', 'random@test.com', corrections);
    assert.strictEqual(result, null);
  });

  it('returns null with only 1 keyword match', () => {
    const result = findCorrection('Just the budget', 'unknown@test.com', corrections);
    assert.strictEqual(result, null);
  });

  it('handles empty corrections array', () => {
    assert.strictEqual(findCorrection('Test', 'a@b.com', []), null);
  });

  it('case-insensitive author matching', () => {
    const result = findCorrection('Any', 'BOSS@COMPANY.COM', corrections);
    assert.strictEqual(result, 'Work');
  });

  it('author match takes priority over keyword match', () => {
    // author matches first correction (userLabel: Work), even if subject matches second
    const result = findCorrection('Weekly Deals', 'boss@company.com', corrections);
    assert.strictEqual(result, 'Work');
  });
});

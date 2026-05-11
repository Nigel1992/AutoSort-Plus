// test/unit/gemini-ratelimit.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Extract from background.js L604-764 ──
// Core rate limit check logic (without storage I/O).

function nextUtcMidnight() {
  const d = new Date(Date.now());
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
}

function checkRateLimit(rateLimit, paidPlan = false) {
  const now = Date.now();

  // Skip for paid plan
  if (paidPlan) {
    return { allowed: true, waitTime: 0 };
  }

  // Reset daily if expired
  if (now > rateLimit.dailyResetTime) {
    rateLimit.dailyCount = 0;
    rateLimit.dailyResetTime = nextUtcMidnight();
    rateLimit.requests = [];
  }

  // Check daily limit
  if (rateLimit.dailyCount >= 20) {
    const hoursUntilReset = Math.ceil((rateLimit.dailyResetTime - now) / (1000 * 60 * 60));
    return {
      allowed: false,
      message: `Daily limit reached. Resets in ${hoursUntilReset} hours.`
    };
  }

  // Clean old requests (older than 1 minute)
  const oneMinuteAgo = now - 60000;
  rateLimit.requests = rateLimit.requests.filter(t => t > oneMinuteAgo);

  // Check per-minute rate limit (5/min free tier)
  if (rateLimit.requests.length >= 5) {
    const lastRequest = Math.max(...rateLimit.requests);
    const waitTime = Math.ceil((60000 - (now - lastRequest)) / 1000);
    return {
      allowed: true,
      waitTime: Math.max(waitTime, 12)
    };
  }

  // Track request
  rateLimit.requests.push(now);
  rateLimit.dailyCount += 1;

  return { allowed: true, waitTime: 0 };
}

describe('rate limit: daily reset', () => {
  it('allows request when under daily limit', () => {
    const rl = { requests: [], dailyCount: 0, dailyResetTime: Date.now() + 86400000 };
    const result = checkRateLimit(rl);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(rl.dailyCount, 1);
  });

  it('blocks request when daily limit reached', () => {
    const rl = { requests: [], dailyCount: 20, dailyResetTime: Date.now() + 86400000 };
    const result = checkRateLimit(rl);
    assert.strictEqual(result.allowed, false);
    assert.ok(result.message.includes('Daily limit'));
  });

  it('resets counter when daily reset time has passed', () => {
    const rl = { requests: [], dailyCount: 20, dailyResetTime: Date.now() - 1000 };
    const result = checkRateLimit(rl);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(rl.dailyCount, 1);
  });

  it('skips rate limit for paid plan', () => {
    const rl = { requests: [], dailyCount: 999, dailyResetTime: Date.now() - 1000 };
    const result = checkRateLimit(rl, true);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.waitTime, 0);
  });
});

describe('rate limit: per-minute throttling', () => {
  it('enforces 5 requests per minute', () => {
    const now = Date.now();
    const rl = {
      requests: [now - 10000, now - 8000, now - 6000, now - 4000, now - 2000],
      dailyCount: 5,
      dailyResetTime: now + 86400000
    };
    const result = checkRateLimit(rl);
    assert.strictEqual(result.allowed, true);
    assert.ok(result.waitTime > 0);
  });

  it('allows immediate request when under per-minute limit', () => {
    const now = Date.now();
    const rl = {
      requests: [now - 65000, now - 66000],
      dailyCount: 2,
      dailyResetTime: now + 86400000
    };
    const result = checkRateLimit(rl);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.waitTime, 0);
  });

  it('enforces minimum 12 second interval', () => {
    const now = Date.now();
    const rl = {
      requests: [],
      dailyCount: 0,
      dailyResetTime: now + 86400000
    };
    // 6 rapid calls: first 5 fill the window, 6th triggers throttle
    checkRateLimit(rl);
    checkRateLimit(rl);
    checkRateLimit(rl);
    checkRateLimit(rl);
    checkRateLimit(rl);
    const result = checkRateLimit(rl);
    assert.ok(result.waitTime >= 12);
  });
});

describe('rate limit: multi-key rotation', () => {
  it('finds available key when first key is at limit', () => {
    const keys = ['key1', 'key2', 'key3'];
    const rateLimits = [
      { requests: [], dailyCount: 20, dailyResetTime: Date.now() + 86400000 },
      { requests: [], dailyCount: 5, dailyResetTime: Date.now() + 86400000 },
      { requests: [], dailyCount: 10, dailyResetTime: Date.now() + 86400000 }
    ];
    let currentIndex = 0;

    for (let i = 0; i < keys.length; i++) {
      const idx = (currentIndex + i) % keys.length;
      if (rateLimits[idx].dailyCount < 20) {
        currentIndex = idx;
        break;
      }
    }

    assert.strictEqual(currentIndex, 1);
  });

  it('returns not-allowed when all keys are at limit', () => {
    const rateLimits = [
      { requests: [], dailyCount: 20, dailyResetTime: Date.now() + 86400000 },
      { requests: [], dailyCount: 20, dailyResetTime: Date.now() + 86400000 }
    ];

    let found = false;
    for (const rl of rateLimits) {
      if (rl.dailyCount < 20) {
        found = true;
        break;
      }
    }
    assert.strictEqual(found, false);
  });
});

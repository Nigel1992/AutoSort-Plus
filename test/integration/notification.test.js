import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Extract from background.js L782-825 ──
// Notification helper that works with or without browser.notifications API.

class NotificationTracker {
  constructor() {
    this.notifications = [];
    this.updated = [];
    this.cleared = [];
  }

  async create(id, options) {
    this.notifications.push({ id, ...options });
    return id;
  }

  async update(id, title, message) {
    this.updated.push({ id, title, message });
    const notif = this.notifications.find(n => n.id === id);
    if (notif) {
      notif.title = title;
      notif.message = message;
    }
    return id;
  }

  async clear(id) {
    this.cleared.push(id);
    const idx = this.notifications.findIndex(n => n.id === id);
    if (idx >= 0) this.notifications.splice(idx, 1);
    return true;
  }
}

describe('notification tracker', () => {
  let tracker;

  beforeEach(() => {
    tracker = new NotificationTracker();
  });

  it('creates a notification', async () => {
    const id = await tracker.create('test-1', {
      type: 'basic',
      title: 'Test',
      message: 'Hello'
    });
    assert.strictEqual(id, 'test-1');
    assert.strictEqual(tracker.notifications.length, 1);
    assert.strictEqual(tracker.notifications[0].title, 'Test');
  });

  it('updates a notification', async () => {
    await tracker.create('test-2', { title: 'Old', message: 'Old msg' });
    await tracker.update('test-2', 'New', 'New msg');
    assert.strictEqual(tracker.updated.length, 1);
    assert.strictEqual(tracker.updated[0].title, 'New');
    assert.strictEqual(tracker.notifications[0].title, 'New');
  });

  it('clears a notification', async () => {
    await tracker.create('test-3', { title: 'Test' });
    await tracker.clear('test-3');
    assert.strictEqual(tracker.cleared.length, 1);
    assert.strictEqual(tracker.notifications.length, 0);
  });

  it('handles update of non-existent notification', async () => {
    await tracker.update('nonexistent', 'Title', 'Message');
    assert.strictEqual(tracker.updated.length, 1);
  });
});

describe('notification flow simulation', () => {
  let tracker;

  beforeEach(() => {
    tracker = new NotificationTracker();
  });

  it('simulates analyzeEmailContent notification flow', async () => {
    const id = `autosort-${Date.now()}`;
    await tracker.create(id, {
      type: 'basic',
      title: 'AutoSort+ AI Analysis',
      message: 'Starting email analysis...'
    });

    await tracker.update(id, 'AutoSort+ AI Analysis', 'Sending request to Gemini AI...');
    await tracker.update(id, 'AutoSort+ AI Analysis', 'Analyzing email content with Gemini AI...');
    await tracker.update(id, 'AutoSort+ Success', 'AI analysis complete. Selected label: Finance');

    assert.strictEqual(tracker.notifications[0].title, 'AutoSort+ Success');
    assert.ok(tracker.notifications[0].message.includes('Finance'));
  });

  it('simulates error notification flow', async () => {
    const id = `autosort-${Date.now()}`;
    await tracker.create(id, {
      type: 'basic',
      title: 'AutoSort+ AI Analysis',
      message: 'Starting email analysis...'
    });

    await tracker.update(id, 'AutoSort+ Error', 'API quota exceeded. Please wait.');

    assert.strictEqual(tracker.notifications[0].title, 'AutoSort+ Error');
    assert.ok(tracker.notifications[0].message.includes('quota'));
  });
});

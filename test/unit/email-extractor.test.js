import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFullMessage,
  createMessageWithAttachments,
  createNestedPartsMessage,
  createHtmlOnlyMessage
} from '../fixtures/sample-emails.js';

// ── Extract from background.js L78-128 ──
// Pure email extraction logic (no browser API calls).

function extractAttachments(parts) {
  if (!parts) return [];
  const attachments = [];
  for (const part of parts) {
    if (part.parts) {
      attachments.push(...extractAttachments(part.parts));
    }
    if (part.name) {
      const isInlineText = (part.contentType === 'text/plain' || part.contentType === 'text/html') && !part.contentDisposition;
      if (!isInlineText) {
        attachments.push({
          name: part.name,
          contentType: part.contentType || 'unknown',
          size: part.size || 0
        });
      }
    }
  }
  return attachments;
}

function extractBodyText(parts) {
  if (!parts) return '';
  let text = '';
  for (const part of parts) {
    if (part.parts) {
      text += extractBodyText(part.parts);
    }
    if (part.contentType === 'text/plain') {
      text += part.body + '\n';
    } else if (part.contentType === 'text/html' && !text) {
      // Replace, not append — matches production background.js L113
      text = part.body.replace(/<[^>]*>/g, '') + '\n';
    } else if (part.contentType === 'message/rfc822' && part.body) {
      text += part.body + '\n';
    }
  }
  return text;
}

function extractSubject(fullMessage, messageHeader) {
  return (fullMessage.headers?.Subject?.[0]) || (messageHeader?.subject) || '';
}

function extractAuthor(fullMessage, messageHeader) {
  return (fullMessage.headers?.From?.[0]) || (messageHeader?.author) || '';
}

describe('subject extraction', () => {
  it('extracts from headers', () => {
    const msg = createFullMessage();
    assert.strictEqual(extractSubject(msg), 'Q3 Budget Report');
  });

  it('falls back to messageHeader', () => {
    const msg = { headers: {}, parts: [] };
    assert.strictEqual(extractSubject(msg, { subject: 'Fallback Subject' }), 'Fallback Subject');
  });

  it('returns empty string when nothing available', () => {
    assert.strictEqual(extractSubject({ headers: {}, parts: [] }, {}), '');
  });
});

describe('author extraction', () => {
  it('extracts From header', () => {
    const msg = createFullMessage();
    assert.strictEqual(extractAuthor(msg), 'finance@company.com');
  });

  it('falls back to messageHeader', () => {
    const msg = { headers: {}, parts: [] };
    assert.strictEqual(extractAuthor(msg, { author: 'fallback@test.com' }), 'fallback@test.com');
  });
});

describe('body extraction', () => {
  it('extracts plain text body', () => {
    const msg = createFullMessage();
    const body = extractBodyText(msg.parts);
    assert.ok(body.includes('Q3 budget report'));
  });

  it('strips HTML tags when only HTML available', () => {
    const msg = createHtmlOnlyMessage();
    const body = extractBodyText(msg.parts);
    assert.ok(body.includes('This email has no plain text version'));
    assert.ok(!body.includes('<html>'));
  });

  it('prefers plain text over HTML when both exist', () => {
    const msg = createFullMessage();
    const body = extractBodyText(msg.parts);
    assert.ok(body.includes('Hello, this is a test email'));
  });

  it('extracts from nested parts', () => {
    const msg = createNestedPartsMessage();
    const body = extractBodyText(msg.parts);
    assert.ok(body.includes('Plain text body'));
  });

  it('returns empty string when parts is null', () => {
    const msg = { headers: { Subject: ['Test'], From: ['a@b.com'] }, body: 'Direct body fallback', parts: null };
    const body = extractBodyText(msg.parts);
    // When parts is null, extractBodyText returns '', and the caller
    // (background.js L120) falls back to fullMessage.body.
    // The test covers the extractBodyText null guard only.
    assert.strictEqual(body, '');
  });

  it('handles message/rfc822 parts', () => {
    const msg = createFullMessage({
      parts: [
        {
          partID: 0,
          contentType: 'message/rfc822',
          body: 'Forwarded email content'
        }
      ]
    });
    const body = extractBodyText(msg.parts);
    assert.ok(body.includes('Forwarded email content'));
  });
});

describe('attachment extraction', () => {
  it('finds attachments at top level', () => {
    const msg = createMessageWithAttachments();
    const attachments = extractAttachments(msg.parts);
    assert.strictEqual(attachments.length, 2);
    assert.ok(attachments.find(a => a.name === 'Q3_Report.pdf'));
    assert.ok(attachments.find(a => a.name === 'chart.png'));
  });

  it('finds attachments in nested parts', () => {
    const msg = createNestedPartsMessage();
    const attachments = extractAttachments(msg.parts);
    assert.strictEqual(attachments.length, 1);
    assert.strictEqual(attachments[0].name, 'archive.zip');
  });

  it('excludes inline text parts', () => {
    const msg = createFullMessage();
    const attachments = extractAttachments(msg.parts);
    assert.strictEqual(attachments.length, 0);
  });

  it('includes attachment metadata', () => {
    const msg = createMessageWithAttachments();
    const attachments = extractAttachments(msg.parts);
    const pdf = attachments.find(a => a.name === 'Q3_Report.pdf');
    assert.strictEqual(pdf.contentType, 'application/pdf');
    assert.strictEqual(pdf.size, 1024000);
  });
});

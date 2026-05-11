// test/fixtures/sample-emails.js

/**
 * Mock Thunderbird message structures for testing.
 * Mirrors the shape returned by browser.messages.getFull().
 */

export function createFullMessage(overrides = {}) {
  const base = {
    parts: [
      {
        partID: 0,
        contentType: 'text/plain',
        body: 'Hello, this is a test email about the Q3 budget report.\nPlease review the attached financial documents.\n\nBest regards,\nFinance Team',
        name: null
      },
      {
        partID: 1,
        contentType: 'text/html',
        body: '<html><body><p>Hello, this is a test email about the Q3 budget report.</p></body></html>',
        name: null
      }
    ],
    headers: {
      Subject: ['Q3 Budget Report'],
      From: ['finance@company.com'],
      Date: ['2026-05-11T03:00:00Z']
    }
  };
  return deepMerge(base, overrides);
}

export function createMessageWithAttachments() {
  return createFullMessage({
    parts: [
      {
        partID: 0,
        contentType: 'text/plain',
        body: 'Please find the attached quarterly report.',
        name: null
      },
      {
        partID: 1,
        contentType: 'application/pdf',
        name: 'Q3_Report.pdf',
        size: 1024000
      },
      {
        partID: 2,
        contentType: 'image/png',
        name: 'chart.png',
        size: 256000
      }
    ]
  });
}

export function createNestedPartsMessage() {
  return createFullMessage({
    parts: [
      {
        partID: 0,
        contentType: 'multipart/alternative',
        parts: [
          {
            partID: 1,
            contentType: 'text/plain',
            body: 'Plain text body',
            name: null
          },
          {
            partID: 2,
            contentType: 'text/html',
            body: '<html><body>HTML body</body></html>',
            name: null
          }
        ]
      },
      {
        partID: 3,
        contentType: 'application/zip',
        name: 'archive.zip',
        size: 500000
      }
    ]
  });
}

export function createHtmlOnlyMessage() {
  return createFullMessage({
    parts: [
      {
        partID: 0,
        contentType: 'text/html',
        body: '<html><body><p>This email has no plain text version.</p></body></html>',
        name: null
      }
    ]
  });
}

function deepMerge(base, overrides) {
  const result = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && base[key]) {
      result[key] = deepMerge(base[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Extracted from background.js L137-147 (DEFAULT_PROMPT) and L966-1016 (placeholder injection) ──
// Pure functions for prompt template rendering with placeholder injection.

const DEFAULT_PROMPT = `You are an email classification assistant. Analyze this email and choose the most appropriate label from: {labels}.

**Email Metadata:**
- Subject: {subject}
- From: {author}
- Attachments: {attachments}

**Email Body:**
{body}

Consider the subject line, sender context, attachment filename(s), and body content to determine the most appropriate category. Respond with only the exact label name, or "null" if no label fits well.`;

function buildPrompt(template, values) {
  let prompt = template || DEFAULT_PROMPT;

  // Inject known placeholders
  for (const [placeholder, value] of Object.entries(values)) {
    if (prompt.includes(`{${placeholder}}`)) {
      prompt = prompt.replace(`{${placeholder}}`, value);
    }
  }

  // Handle body/email placeholders — if neither {body} nor {email} found,
  // append body at end
  const hasBody = prompt.includes('{body}');
  const hasEmail = prompt.includes('{email}');

  if (!hasBody && !hasEmail && values.body !== undefined) {
    prompt = `${prompt}\n\nEmail content:\n${values.body}`;
  } else if (hasBody) {
    prompt = prompt.replace('{body}', values.body || '');
  } else if (hasEmail) {
    prompt = prompt.replace('{email}', values.body || '');
  }

  return prompt;
}

describe('default prompt rendering', () => {
  const values = {
    labels: 'Finance, Marketing, Personal',
    subject: 'Q3 Budget',
    author: 'cfo@company.com',
    attachments: 'report.pdf',
    body: 'Please review the budget.'
  };

  it('replaces all placeholders', () => {
    const prompt = buildPrompt(null, values);
    assert.ok(prompt.includes('Finance, Marketing, Personal'));
    assert.ok(prompt.includes('Q3 Budget'));
    assert.ok(prompt.includes('cfo@company.com'));
    assert.ok(prompt.includes('report.pdf'));
    assert.ok(prompt.includes('Please review the budget.'));
  });

  it('does not contain unresolved placeholders', () => {
    const prompt = buildPrompt(null, values);
    assert.ok(!prompt.includes('{labels}'));
    assert.ok(!prompt.includes('{subject}'));
    assert.ok(!prompt.includes('{author}'));
    assert.ok(!prompt.includes('{attachments}'));
    assert.ok(!prompt.includes('{body}'));
  });
});

describe('custom prompt with missing placeholders', () => {
  it('appends body when no body/email placeholder present', () => {
    const customPrompt = 'Classify this email.';
    const values = { body: 'Hello world', labels: 'A, B', subject: 'Test', author: 'x@y.z', attachments: '(none)' };
    const prompt = buildPrompt(customPrompt, values);

    assert.ok(prompt.includes('Classify this email.'));
    assert.ok(prompt.includes('Email content:'));
    assert.ok(prompt.includes('Hello world'));
  });

  it('injects body but not labels when labels absent from template', () => {
    const customPrompt = 'Classify: {body}';
    const values = {
      labels: 'Finance, Marketing',
      subject: 'Test',
      author: 'x@y.z',
      attachments: '(none)',
      body: 'body text'
    };
    const prompt = buildPrompt(customPrompt, values);

    // body was in template, so it is replaced. labels is NOT in template,
    // so it is never injected — the current implementation only replaces
    // placeholders that already exist in the template string.
    assert.ok(prompt.includes('body text'));
    assert.ok(!prompt.includes('{body}'));
  });

  it('supports legacy {email} placeholder', () => {
    const customPrompt = 'Classify: {email}';
    const values = { body: 'Email body text', labels: 'A', subject: 'S', author: 'A', attachments: 'N' };
    const prompt = buildPrompt(customPrompt, values);

    assert.ok(prompt.includes('Email body text'));
    assert.ok(!prompt.includes('{email}'));
  });
});

describe('edge cases', () => {
  it('handles empty body', () => {
    const prompt = buildPrompt('Classify: {body}', {
      body: '',
      labels: 'A',
      subject: 'S',
      author: 'A',
      attachments: 'N'
    });
    assert.ok(prompt.includes('Classify: '));
  });

  it('handles special characters in values', () => {
    const values = {
      labels: 'Finance, Marketing',
      subject: 'Re: Q&A <budget>',
      author: '"John" <john@test.com>',
      attachments: 'file "v2".pdf',
      body: 'Line 1\nLine 2\tTab'
    };
    const prompt = buildPrompt(null, values);
    assert.ok(prompt.includes('Re: Q&A <budget>'));
    assert.ok(prompt.includes('"John" <john@test.com>'));
    assert.ok(prompt.includes('file "v2".pdf'));
  });
});

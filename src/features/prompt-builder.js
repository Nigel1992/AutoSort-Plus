if (!window.AutoSortPlus) window.AutoSortPlus = {};

window.AutoSortPlus.promptBuilder = {
  DEFAULT_PROMPT: `You are an email classification assistant. Analyze this email and choose the most appropriate label from: {labels}.

**Email Metadata:**
- Subject: {subject}
- From: {author}
- Attachments: {attachments}

**Email Body:**
{body}

Consider the subject line, sender context, attachment filenames, and body content to determine the most appropriate category. Respond with only the exact label name, or "null" if no label fits well.`,

  build(customPrompt, values) {
    const { labels, subject, author, attachments, body } = values;
    let prompt = (customPrompt && customPrompt.trim()) ? customPrompt.trim() : this.DEFAULT_PROMPT;

    function injectPlaceholder(placeholder, value, fallbackPrefix, fallbackPosition = 'start') {
      if (!prompt.includes(placeholder)) {
        if (window.debugLogger) {
          window.debugLogger.warn('[AutoSort]', `Custom prompt missing ${placeholder} placeholder - injecting`);
        }
        if (fallbackPosition === 'start') {
          prompt = `${fallbackPrefix}${value}\n\n${prompt}`;
        } else {
          prompt = `${prompt}\n\n${fallbackPrefix}${value}`;
        }
      } else {
        prompt = prompt.replace(placeholder, value);
      }
    }

    injectPlaceholder('{labels}', labels, 'Labels: ', 'start');
    injectPlaceholder('{subject}', subject, 'Subject: ', 'start');
    injectPlaceholder('{author}', author, 'From: ', 'start');
    injectPlaceholder('{attachments}', attachments, 'Attachments: ', 'start');

    if (prompt.includes('{body}')) {
      prompt = prompt.replace('{body}', body);
    } else if (prompt.includes('{email}')) {
      prompt = prompt.replace('{email}', body);
    } else {
      if (window.debugLogger) {
        window.debugLogger.warn('[AutoSort]', 'Custom prompt missing {body} placeholder - appending');
      }
      prompt = `${prompt}\n\nEmail content:\n${body}`;
    }

    return prompt;
  }
};

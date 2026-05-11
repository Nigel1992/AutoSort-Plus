if (!window.AutoSortPlus) window.AutoSortPlus = {};

window.AutoSortPlus.emailExtractor = {
  async extract(fullMessage, messageHeader) {
    const subject = (fullMessage.headers?.Subject?.[0]) || (messageHeader?.subject) || '';
    const author = (fullMessage.headers?.From?.[0]) || (messageHeader?.author) || '';

    const attachments = [];
    await this.collectAttachments(fullMessage.parts, attachments);
    const body = fullMessage.parts ? await this.extractBodyText(fullMessage.parts) : (fullMessage.body || '');

    return { subject, author, attachments, body };
  },

  async collectAttachments(parts, attachments) {
    if (!parts) return;
    for (const part of parts) {
      if (part.parts) await this.collectAttachments(part.parts, attachments);
      if (part.name) {
        const isInlineText = (part.contentType === 'text/plain' || part.contentType === 'text/html') && !part.contentDisposition;
        if (!isInlineText) {
          attachments.push({ name: part.name, contentType: part.contentType || 'unknown', size: part.size || 0 });
        }
      }
    }
  },

  async extractBodyText(parts) {
    if (!parts) return '';
    let text = '';
    for (const part of parts) {
      if (part.parts) text += await this.extractBodyText(part.parts);
      if (part.contentType === 'text/plain') {
        text += part.body + '\n';
      } else if (part.contentType === 'text/html' && !text) {
        text = await messenger.messengerUtilities.convertToPlainText(part.body);
      } else if (part.contentType === 'message/rfc822' && part.body) {
        text += part.body + '\n';
      }
    }
    return text;
  }
};

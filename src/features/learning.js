if (!window.AutoSortPlus) window.AutoSortPlus = {};

const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 're', 'fwd', 'fw', 'to', 'of', 'for', 'in', 'on', 'at', 'by', 'with', 'and', 'or', 'but', 'not', 'it', 'its', 'this', 'that']);

window.AutoSortPlus.learning = {
  MAX_CORRECTIONS: 500,

  extractKeywords(subject) {
    if (!subject) return [];
    return [...new Set(
      subject.toLowerCase()
        .replace(/[^a-z0-9一-鿿\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    ]);
  },

  async findMatch(subject, author) {
    const { corrections = [] } = await messenger.storage.local.get('corrections');
    if (corrections.length === 0) return null;

    // Exact author match
    if (author) {
      const authorMatch = corrections.find(c => c.author?.toLowerCase() === author.toLowerCase());
      if (authorMatch) return authorMatch.userLabel;
    }

    // Subject keyword overlap (need 2+ keywords to match)
    const keywords = this.extractKeywords(subject);
    if (keywords.length < 2) return null;

    for (const c of corrections) {
      if (!c.subjectKeywords) continue;
      const overlap = keywords.filter(k => c.subjectKeywords.includes(k));
      if (overlap.length >= 2) return c.userLabel;
    }

    return null;
  },

  async recordCorrection(aiLabel, userLabel, subject, author) {
    const { corrections = [] } = await messenger.storage.local.get('corrections');

    // Remove any existing correction for this author+subject combo
    const existingIdx = corrections.findIndex(c =>
      c.author?.toLowerCase() === author?.toLowerCase() ||
      (c.subjectKeywords && this.extractKeywords(subject).some(k => c.subjectKeywords.includes(k)))
    );
    if (existingIdx >= 0) corrections.splice(existingIdx, 1);

    corrections.unshift({
      aiLabel, userLabel, subject, author,
      subjectKeywords: this.extractKeywords(subject),
      timestamp: new Date().toISOString()
    });

    // LRU eviction
    while (corrections.length > this.MAX_CORRECTIONS) corrections.pop();

    await messenger.storage.local.set({ corrections });
  }
};

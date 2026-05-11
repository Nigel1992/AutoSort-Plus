if (!window.AutoSortPlus) window.AutoSortPlus = {};

window.AutoSortPlus.labelMatch = {
  normalize(s) {
    if (!s) return '';
    return s.toString().trim().replace(/^['"`]+|['"`]+$/g, '');
  },

  findMatch(aiOutput, configuredLabels) {
    if (!aiOutput || String(aiOutput).trim().toLowerCase() === 'null') return null;
    const normalize = this.normalize;
    const lower = normalize(aiOutput).toLowerCase();

    // Exact match first
    if (configuredLabels.includes(aiOutput)) return aiOutput;

    // Case-insensitive match
    let matched = configuredLabels.find(l => l.toLowerCase() === lower);
    if (matched) return matched;

    // Substring match
    matched = configuredLabels.find(
      l => lower.includes(l.toLowerCase()) || l.toLowerCase().includes(lower)
    );
    return matched || null;
  }
};

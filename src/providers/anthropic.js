(function() {
  if (!window.AutoSortPlus || !window.AutoSortPlus.providers) return;

  window.AutoSortPlus.providers.anthropicProvider = {
    name: 'anthropic',
    async analyze(prompt, settings) {
      const apiKey = settings.apiKey;
      if (!apiKey) throw new Error('Anthropic API key not configured');

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 50
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
        throw new Error(error.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.content || data.content.length === 0) return null;
      return data.content[0].text;
    }
  };
})();

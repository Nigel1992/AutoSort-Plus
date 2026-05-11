(function() {
  if (!window.AutoSortPlus || !window.AutoSortPlus.providers) return;

  window.AutoSortPlus.providers.mistralProvider = {
    name: 'mistral',
    async analyze(prompt, settings) {
      const apiKey = settings.apiKey;
      if (!apiKey) throw new Error('Mistral API key not configured');

      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 50,
          temperature: 0.6,
          top_p: 0.95
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
        throw new Error(error.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.choices || data.choices.length === 0) return null;
      return data.choices[0].message?.content || null;
    }
  };
})();

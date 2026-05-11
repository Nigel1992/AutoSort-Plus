(function() {
  if (!window.AutoSortPlus || !window.AutoSortPlus.providers) return;

  window.AutoSortPlus.providers.openaiCompatProvider = {
    name: 'openai-compatible',
    async analyze(prompt, settings) {
      const baseUrl = (settings.customBaseUrl || '').replace(/\/$/, '');
      const model = settings.customModel || '';
      const apiKey = settings.apiKey || '';

      if (!baseUrl || !model) throw new Error('OpenAI-compatible endpoint not configured');

      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const isLocalhost = baseUrl.startsWith('http://localhost') || baseUrl.startsWith('http://127.0.0.1');

      try {
        let result;
        if (isLocalhost) {
          result = await AutoSortPlus.tabFetch.fetchViaTab(baseUrl, {
            endpoint: '/v1/chat/completions',
            headers,
            body: { model, messages: [{ role: 'user', content: prompt }], max_tokens: 8192, stream: false }
          });
        } else {
          const response = await fetch(baseUrl + '/v1/chat/completions', {
            method: 'POST', headers,
            body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 8192, stream: false })
          });
          if (!response.ok) {
            const error = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
            throw new Error(error.error?.message || `HTTP ${response.status}`);
          }
          result = { ok: true, data: await response.json() };
        }

        if (!result || !result.ok) throw new Error(result?.error || 'Request failed');
        const data = result.data;
        if (!data.choices || data.choices.length === 0) return null;
        return data.choices[0].message?.content || null;
      } catch (err) {
        throw new Error(`OpenAI-compatible analysis failed: ${err.message}`);
      }
    }
  };
})();

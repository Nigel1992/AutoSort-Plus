(function() {
  if (!window.AutoSortPlus || !window.AutoSortPlus.providers) return;

  window.AutoSortPlus.providers.ollamaProvider = {
    name: 'ollama',
    async analyze(prompt, settings) {
      const ollamaUrl = settings.ollamaUrl || 'http://localhost:11434';
      let model = settings.ollamaModel || 'llama3.2';
      if (model === 'custom' && settings.ollamaCustomModel) model = settings.ollamaCustomModel;
      const authToken = settings.ollamaAuthToken || '';

      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const numCtx = settings.ollamaNumCtx || 0;
      const options = numCtx > 0 ? { options: { num_ctx: parseInt(numCtx) } } : {};

      try {
        const result = await AutoSortPlus.tabFetch.fetchViaTab(ollamaUrl, {
          endpoint: '/api/chat',
          headers,
          body: { model, messages: [{ role: 'user', content: prompt }], stream: false, ...options }
        });

        if (!result || !result.ok) throw new Error(result?.error || 'Ollama request failed');
        const data = result.data;
        if (!data.message?.content) return null;
        return data.message.content;
      } catch (err) {
        throw new Error(`Ollama analysis failed: ${err.message}`);
      }
    }
  };
})();

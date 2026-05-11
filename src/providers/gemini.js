(function() {
  if (!window.AutoSortPlus || !window.AutoSortPlus.providers) return;

  window.AutoSortPlus.providers.geminiProvider = {
    name: 'gemini',
    async analyze(prompt, settings) {
      const apiKey = settings.geminiApiKeys
        ? settings.geminiApiKeys[settings.currentGeminiKeyIndex || 0]
        : settings.apiKey;
      if (!apiKey) throw new Error('Gemini API key not configured');

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }], role: 'user' }],
          generationConfig: {
            temperature: 0.6, topK: 20, topP: 0.95, maxOutputTokens: 50,
            thinkingConfig: { thinkingBudget: 0 }
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
          ]
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
        throw new Error(error.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.candidates || data.candidates.length === 0) return null;
      const candidate = data.candidates[0];
      if (candidate.finishReason === 'MAX_TOKENS') throw new Error('Response truncated (MAX_TOKENS)');
      if (!candidate.content?.parts?.length) return null;
      return candidate.content.parts[0].text;
    }
  };
})();

(async () => {
  const cfg = window.__autosort_config;
  if (!cfg) {
    try {
      messenger.runtime.sendMessage({
        action: 'autosort_fetch_fallback',
        result: { ok: false, error: 'No config found' }
      });
    } catch (e) {}
    return;
  }

  try {
    const response = await fetch(cfg.baseUrl + cfg.endpoint, {
      method: 'POST',
      headers: cfg.headers,
      body: JSON.stringify(cfg.body)
    });

    if (cfg.stream) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            messenger.runtime.sendMessage({ action: cfg.resultKey, result: { ok: true, streamLine: line } });
          } catch (e) {}
        }
      }
      try {
        messenger.runtime.sendMessage({ action: cfg.resultKey, result: { ok: true, streamDone: true } });
      } catch (e) {}
    } else {
      const data = await response.json();
      try {
        messenger.runtime.sendMessage({
          action: cfg.resultKey,
          result: { ok: response.ok, data, status: response.status }
        });
      } catch (e) {}
    }
  } catch (e) {
    try {
      messenger.runtime.sendMessage({ action: cfg.resultKey, result: { ok: false, error: e.message } });
    } catch (sendErr) {}
  }
})();

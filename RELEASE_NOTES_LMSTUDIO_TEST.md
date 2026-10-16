# AutoSort+ v1.3.0-lmstudio-test - LM Studio Support (Test Release)

## 🧪 Test Release - LM Studio Local AI Integration

This is a **test release** that adds **LM Studio** as a local LLM provider.

> ⚠️ **Status: implemented but not yet tested** against a live LM Studio server by the
> maintainer. Please install it, try it, and report back (see
> [What to report back](#-what-to-report-back)).

## 🔧 Update (rebuild)

- **Fixed:** `Unexpected endpoint or method. (GET /v1/api/v1/models). Returning 200
  anyway` followed by a misleading "no models found". Two LM Studio quirks are now
  handled:
  - The **Server URL** tolerates a pasted OpenAI-compatible base — a trailing `/v1` or
    `/api/v1` is stripped, so we no longer request `/v1/api/v1/models`.
  - LM Studio answers unknown endpoints with **HTTP 200** plus a JSON `error` body. That
    body is now detected and shown as a real error (with a hint to use the server root)
    instead of being treated as success.

## ✨ What's New

**Local LM Studio Support:**
- 🖥️ Use LM Studio's local server as your AI provider
- 🔒 Fully local & private - no data leaves your machine
- 🆓 Free, no API keys, no rate limits
- 🧩 Uses LM Studio's **native REST API**: `GET /api/v1/models`, `POST /api/v1/chat`
- 🔑 Optional Bearer token (only if you enable authentication in LM Studio)
- ⚙️ **List Models** and **Test Connection** buttons in Settings

## 🚀 Quick Start

### Prerequisites
1. Install LM Studio: https://lmstudio.ai/
2. Download and **load a chat (LLM) model** in LM Studio.
3. Open the **Developer** tab (the `</>` icon) and click **Start Server**
   (default: `http://localhost:1234`).
4. Verify the server is up:
   ```bash
   curl http://localhost:1234/api/v1/models
   ```

### Setup in the extension
1. Open **AutoSort+ Settings** → **AI Settings**.
2. Select **LM Studio (Local LLM)** as the provider.
3. Confirm the **LM Studio Server URL** (`http://localhost:1234`).
4. Click **List Models** and pick your model (or choose "Custom model…" and type the id).
5. (Optional) Enter the API token if you enabled authentication in LM Studio.
6. Click **Test Connection** - you should see the model respond.
7. Click **Save Settings**.

### Test it
1. Select an email in Thunderbird.
2. Right-click → **AutoSort+** → **Analyze with AI** (or use your normal sort flow).
3. Confirm the email is classified/labelled correctly.

## 🐛 Known Issues / Not Yet Verified

- This build has **not been validated end-to-end against a running LM Studio server**.
- **Networking:** the background first tries a direct request; if that is blocked it
  falls back to injecting the request from a hidden tab (the same technique used for
  Ollama). Behaviour may differ by OS/Thunderbird version.
- **Reasoning models** (e.g. DeepSeek R1) may emit reasoning tokens first; if you get
  an empty result, try a non-reasoning instruct model.
- Non-default ports/hosts are supported by editing the URL, but only `localhost` /
  `127.0.0.1` are pre-authorised in the manifest.

## 📋 What to report back

When you reply, please include:

1. **Environment:** OS + Thunderbird version, LM Studio version, and the exact model id
   (from `curl http://localhost:1234/api/v1/models`).
2. **Server:** Is it on the default `http://localhost:1234`? Any auth token configured?
3. **Settings result:** the exact text shown by **List Models** and **Test Connection**.
4. **Console logs:**
   - Thunderbird → Tools → Developer Tools → **WebExtension console**
     (look for lines starting with `[LM Studio]`)
   - Browser console (Ctrl+Shift+J)
5. **Classification:** did analyzing an email actually return a label and move it?
6. **Errors:** paste the full error text, not just the first line.
7. Screenshots of the Settings page and any error dialogs are very helpful.

## 📝 Technical Details

- **Endpoints:** `GET /api/v1/models`, `POST /api/v1/chat`.
- **Chat request body:**
  ```json
  {
    "model": "<model id>",
    "input": "<prompt>",
    "system_prompt": "You are an email classification assistant...",
    "max_output_tokens": 512,
    "temperature": 0.2,
    "stream": false
  }
  ```
- **Response parsing:** reads the first `output[]` item with `type: "message"` and takes
  its `content`, with an OpenAI-compatible fallback shape.
- **Transport:** direct `fetch` from the background first, then a hidden-tab request
  injection fallback if the direct request fails.

## 🔄 Upgrading

1. Uninstall any previous AutoSort+ build (optional but recommended for clean testing).
2. Install this XPI.
3. Reconfigure your provider/settings.
4. Test connection again.

## ⚠️ Disclaimer

This is a **test release**. The LM Studio integration is experimental and may have bugs.
Please back up your settings before installing, and report issues in
https://github.com/Nigel1992/AutoSort-Plus/issues/13

---

**Installation:** Download `autosortplus.xpi` and install via
Thunderbird → Add-ons and Themes → Gear icon → **Install Add-on From File...**

**Feedback:** Reply in issue #13 with the details requested above!

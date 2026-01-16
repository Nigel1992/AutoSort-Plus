/*
 * Ollama API Client
 * Adapted from ThunderAI extension
 * Handles communication with local Ollama instance
 */

export class Ollama {
    host = '';
    model = '';
    stream = false;
    num_ctx = 0;
    authToken = '';
  
    constructor({
      host = '',
      model = '',
      stream = false,
      num_ctx = 0,
      authToken = '',
    } = {}) {
      this.host = (host || '').trim().replace(/\/+$/, "");
      this.model = model;
      this.stream = stream;
      this.num_ctx = num_ctx;
      this.authToken = authToken || '';
    }

    getHeaders = () => {
      const headers = {
          "Content-Type": "application/json"
      };
      if (this.authToken) {
          headers['Authorization'] = `Bearer ${this.authToken}`;
      }
      return headers;
    }

    fetchModels = async () => {
      try{
        const response = await fetch(this.host + "/api/tags", {
            method: "GET",
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            const errorDetail = await response.text();
            let err_msg = "[AutoSort+] Ollama API request failed: " + response.status + " " + response.statusText + ", Detail: " + errorDetail;
            console.error(err_msg);
            let output = {};
            output.ok = false;
            output.error = errorDetail;
            return output;
        }

        let output = {};
        output.ok = true;
        let output_response = await response.json();
        output.response = output_response;

        return output;
      }catch (error) {
        console.error("[AutoSort+] Ollama API request failed: " + error);
        let output = {};
        output.is_exception = true;
        output.ok = false;
        output.error = "Ollama API request failed: " + error;
        return output;
      }
    }

    fetchResponse = async (messages) => {
      try {
        const response = await fetch(this.host + "/api/chat", {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({ 
                model: this.model, 
                messages: messages,
                stream: this.stream,
                ...(this.num_ctx > 0 ? { options: { num_ctx: parseInt(this.num_ctx) } } : {}),
            }),
        });
        return response;
      }catch (error) {
          console.error("[AutoSort+] Ollama API request failed: " + error);
          let output = {};
          output.is_exception = true;
          output.ok = false;
          output.error = "Ollama API request failed: " + error;
          return output;
      }
    }
}

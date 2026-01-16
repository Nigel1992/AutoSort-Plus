/*
 * Ollama Web Worker for AutoSort+
 * Handles streaming chat responses from local Ollama instance
 * Adapted from ThunderAI extension
 */

import { Ollama } from '../ollama.js';

let ollama_host = null;
let ollama_model = '';
let ollama_num_ctx = 0;
let ollama_auth_token = '';
let ollama = null;
let stopStreaming = false;
let conversationHistory = [];
let assistantResponseAccumulator = '';

self.onmessage = async function(event) {
    switch (event.data.type) {
        case 'init':
            ollama_host = event.data.ollama_host;
            ollama_model = event.data.ollama_model;
            ollama_num_ctx = event.data.ollama_num_ctx;
            ollama_auth_token = event.data.ollama_auth_token || '';
            ollama = new Ollama({
                host: ollama_host,
                model: ollama_model,
                stream: true,
                num_ctx: ollama_num_ctx,
                authToken: ollama_auth_token
            });
            console.log("[Ollama Worker] Initialized with host: " + ollama_host + ", model: " + ollama_model);
            break;  // init

        case 'chatMessage':
            conversationHistory.push({ role: 'user', content: event.data.message });
            console.log("[Ollama Worker] Chat message received: " + event.data.message);
            
            const response = await ollama.fetchResponse(conversationHistory);
            postMessage({ type: 'messageSent' });

            if (!response.ok) {
                let error_message = '';
                if(response.is_exception === true){
                    error_message = response.error;
                }else{
                    try{
                        const errorJSON = await response.json();
                        error_message = errorJSON.error?.message || response.statusText;
                    }catch(e){
                        error_message = response.statusText;
                    }
                }
                console.error("[Ollama Worker] API Error: " + error_message);
                postMessage({ type: 'error', payload: "Ollama API Error: " + response.status + " " + error_message });
                break;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = '';
    
            try {
                while (true) {
                    if (stopStreaming) {
                        stopStreaming = false;
                        reader.cancel();
                        conversationHistory.push({ role: 'assistant', content: assistantResponseAccumulator });
                        assistantResponseAccumulator = '';
                        postMessage({ type: 'tokensDone' });
                        break;
                    }
                    
                    const { done, value } = await reader.read();
                    if (done) {
                        conversationHistory.push({ role: 'assistant', content: assistantResponseAccumulator });
                        assistantResponseAccumulator = '';
                        postMessage({ type: 'tokensDone' });
                        break;
                    }
                    
                    const chunk = decoder.decode(value);
                    buffer += chunk;
                    const lines = buffer.split("\n");
                    buffer = lines.pop();
                    
                    let parsedLines = [];
                    try{
                        parsedLines = lines
                            .map((line) => line.trim())
                            .filter((line) => line !== "")
                            .map((line) => {
                                try {
                                    return JSON.parse(line);
                                } catch (e) {
                                    console.warn("[Ollama Worker] JSON parse warning, skipped: " + line);
                                    return null;
                                }
                            })
                            .filter((parsed) => parsed !== null);
                    }catch(e){
                        console.error("[Ollama Worker] Error parsing lines: " + e);
                    }
            
                    for (const parsedLine of parsedLines) {
                        const { message } = parsedLine;
                        const { content } = message;
                        
                        if (content) {
                            assistantResponseAccumulator += content;
                            postMessage({ type: 'newToken', payload: { token: content } });
                        }
                    }
                }
            } catch (error) {
                console.error('[Ollama Worker] Stream error: ' + error);
                postMessage({ type: 'error', payload: "Connection error: " + error.message });
            }
            break;

        case 'stop':
            stopStreaming = true;
            break;

        default:
            console.error('[Ollama Worker] Unknown message type:', event.data.type);
    }
};

/*
 * Ollama Popup for AutoSort+
 * Makes direct POST requests to Ollama from browser context (no restrictions)
 * Popup = browser context = POST works
 * Background script = restricted context = POST fails with 403
 */

let statusEl = null;
let messagesEl = null;
let responseEl = null;
let analysisResult = null;

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const callId = urlParams.get('call_id');

// Initialize UI
document.addEventListener('DOMContentLoaded', async () => {
    statusEl = document.getElementById('status');
    messagesEl = document.getElementById('messages');
    responseEl = document.getElementById('response');

    statusEl.textContent = 'Ready';
    
    // Tell background script that we're ready
    browser.runtime.sendMessage({
        command: "ollama_popup_ready_" + callId,
        window_id: (await browser.windows.getCurrent()).id
    }).catch(err => console.log('Ready message error (expected):', err.message));
});

// Handle messages from background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.command) {
        case "ollama_analyze":
            handleOllamaAnalyze(message);
            break;
        case 'ollama_error':
            statusEl.textContent = 'Error: ' + message.error;
            responseEl.textContent = message.error;
            analysisResult = null;
            sendResultToBackground();
            break;
        default:
            console.log('Unknown command:', message.command);
    }
});

async function handleOllamaAnalyze(message) {
    const { ollama_host, ollama_model, ollama_num_ctx, ollama_auth_token, prompt } = message;

    try {
        statusEl.textContent = 'Connecting to Ollama...';
        responseEl.textContent = '';
        analysisResult = null;
        
        // Add user message to display
        const userMsgEl = document.createElement('div');
        userMsgEl.className = 'message user-message';
        userMsgEl.textContent = 'Analyzing: ' + prompt.substring(0, 100) + '...';
        messagesEl.appendChild(userMsgEl);

        statusEl.textContent = 'Processing with Ollama...';

        // Make direct POST request from browser context (no restrictions!)
        const headers = {
            'Content-Type': 'application/json'
        };
        if (ollama_auth_token) {
            headers['Authorization'] = `Bearer ${ollama_auth_token}`;
        }

        const requestBody = {
            model: ollama_model,
            messages: [{ role: 'user', content: prompt }],
            stream: false
        };
        
        if (ollama_num_ctx > 0) {
            requestBody.options = { num_ctx: parseInt(ollama_num_ctx) };
        }

        console.log('[Ollama Popup] Sending POST to:', ollama_host + '/api/chat');
        console.log('[Ollama Popup] Model:', ollama_model);
        console.log('[Ollama Popup] Request body:', JSON.stringify(requestBody).substring(0, 200));

        const response = await fetch(ollama_host + '/api/chat', {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            mode: 'cors',
            credentials: 'omit'
        });

        console.log('[Ollama Popup] Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Ollama Popup] Error response:', errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('[Ollama Popup] Response data:', JSON.stringify(data).substring(0, 300));

        // Extract the response content
        if (data.message && data.message.content) {
            analysisResult = data.message.content;
            responseEl.textContent = analysisResult;
            statusEl.textContent = 'Analysis complete ✓';
        } else {
            throw new Error('Invalid response format: missing message.content');
        }

        // Send result back to background
        setTimeout(sendResultToBackground, 1000);

    } catch (error) {
        console.error('[Ollama Popup] Error:', error);
        statusEl.textContent = 'Error: ' + error.message;
        responseEl.textContent = 'Error: ' + error.message;
        analysisResult = null;
        sendResultToBackground();
    }
}

function sendResultToBackground() {
    // Send result back to background script
    browser.runtime.sendMessage({
        command: 'ollama_analysis_result_' + callId,
        result: analysisResult,
        error: analysisResult === null ? 'Analysis failed' : null
    }).catch(err => console.log('Result message error:', err.message));
}

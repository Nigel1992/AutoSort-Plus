// test/fixtures/mock-providers.js

/**
 * Mock AI provider response structures for testing.
 */

export const mockResponses = {
  gemini: {
    success: {
      candidates: [
        {
          content: {
            parts: [{ text: 'Finance' }],
            role: 'model'
          },
          finishReason: 'STOP'
        }
      ]
    },
    maxTokens: {
      candidates: [{ finishReason: 'MAX_TOKENS' }]
    },
    empty: {
      candidates: [{ content: { parts: [] } }]
    }
  },

  openai: {
    success: {
      choices: [
        {
          message: { content: 'Marketing', role: 'assistant' },
          finish_reason: 'stop'
        }
      ]
    },
    withReasoning: {
      choices: [
        {
          message: {
            content: null,
            reasoning_content: 'This email contains promotional content',
            role: 'assistant'
          },
          finish_reason: 'stop'
        }
      ]
    }
  },

  anthropic: {
    success: {
      content: [{ type: 'text', text: 'Personal' }]
    }
  },

  ollama: {
    success: {
      message: { content: 'Work', role: 'assistant' }
    },
    stringContent: {
      message: { content: 'Finance' }
    },
    arrayContent: {
      message: {
        content: [{ type: 'text', text: 'Marketing' }]
      }
    }
  }
};

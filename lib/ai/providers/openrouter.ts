import type { AIProvider, AIProviderResponse } from './types';

// OpenRouter - OpenAI-compatible endpoint. Models with a ":free" suffix in the
// model ID cost $0 (rate-limited, no credit card needed to start).
// Get a key at https://openrouter.ai (Keys page) - no card required.
// Check https://openrouter.ai/models?max_price=0 for the current list of free
// models - the catalog changes, so re-verify model IDs if one starts failing.
const BASE_URL = 'https://openrouter.ai/api/v1';

export const openrouterProvider: AIProvider = {
  async call({ model, prompt, maxTokens, imageBase64, imageMediaType }): Promise<AIProviderResponse> {
    const content: any[] = [{ type: 'text', text: prompt }];

    if (imageBase64) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${imageMediaType || 'image/png'};base64,${imageBase64}` },
      });
    }

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        // OpenRouter asks for these on free models - harmless to include always.
        'HTTP-Referer': 'https://qa-ide.local',
        'X-Title': 'QA IDE',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    const tokensUsed = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);

    return { text, tokensUsed };
  },
};

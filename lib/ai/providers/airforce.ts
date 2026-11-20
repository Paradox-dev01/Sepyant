import type { AIProvider, AIProviderResponse } from './types';

// api.airforce is OpenAI-compatible: same request/response shape as OpenAI's
// chat completions endpoint, just a different base URL + key + model catalog.
// This is now the DEFAULT provider (see orchestrator.ts routing table) since
// it's much cheaper than calling Anthropic/OpenAI directly.
const BASE_URL = 'https://api.airforce/v1';

export const airforceProvider: AIProvider = {
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
        Authorization: `Bearer ${process.env.AIRFORCE_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`api.airforce error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    const tokensUsed = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);

    return { text, tokensUsed };
  },
};

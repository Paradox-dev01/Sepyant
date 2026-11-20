import type { AIProvider, AIProviderResponse } from './types';

// Using fetch directly instead of the openai SDK to keep the dependency list
// small in Phase 1 - swap for the official SDK later if you need streaming etc.
export const openaiProvider: AIProvider = {
  async call({ model, prompt, maxTokens, imageBase64, imageMediaType }): Promise<AIProviderResponse> {
    const content: any[] = [{ type: 'text', text: prompt }];

    if (imageBase64) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${imageMediaType || 'image/png'};base64,${imageBase64}` },
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error: ${errText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    const tokensUsed = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);

    return { text, tokensUsed };
  },
};

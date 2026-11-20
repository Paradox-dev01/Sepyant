import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, AIProviderResponse } from './types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const anthropicProvider: AIProvider = {
  async call({ model, prompt, maxTokens, imageBase64, imageMediaType }): Promise<AIProviderResponse> {
    const content: any[] = [];

    if (imageBase64) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: imageMediaType || 'image/png',
          data: imageBase64,
        },
      });
    }
    content.push({ type: 'text', text: prompt });

    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const text = textBlock && 'text' in textBlock ? textBlock.text : '';

    return {
      text,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    };
  },
};

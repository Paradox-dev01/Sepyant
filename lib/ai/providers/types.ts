// Every provider (Anthropic, OpenAI, Gemini, ...) implements this same shape.
// The orchestrator only ever talks to this interface - it never knows which
// actual SDK is underneath. This is what makes adding a new provider later
// a new file in this folder, not a rewrite of orchestrator.ts.

export interface AIProviderResponse {
  text: string;
  tokensUsed: number;
}

export interface AIProvider {
  call(params: {
    model: string;
    prompt: string;
    maxTokens: number;
    imageBase64?: string; // for vision tasks - optional, providers that don't support it can ignore
    imageMediaType?: string;
  }): Promise<AIProviderResponse>;
}

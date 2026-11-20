import { z } from 'zod';
import { openrouterProvider } from './providers/openrouter';
import { airforceProvider } from './providers/airforce';
// Commented out to avoid any accidental cost while running on the free tier.
// Uncomment these two imports + their PROVIDERS entries below once you buy
// direct API access at final release - no other code needs to change.
// import { anthropicProvider } from './providers/anthropic';
// import { openaiProvider } from './providers/openai';
import type { AIProvider } from './providers/types';

// ===== Provider registry =====
// openrouter = default right now (genuinely free, no card, ":free" models).
// airforce kept available as a cheap fallback if you want paid models later
// without a full direct-provider integration.
const PROVIDERS: Record<string, AIProvider> = {
  openrouter: openrouterProvider,
  airforce: airforceProvider,
  // anthropic: anthropicProvider, // uncomment at final release (paid)
  // openai: openaiProvider,       // uncomment at final release (paid)
};

// ===== Task -> provider/model routing table (doc section 10) =====
// FREE TIER (current): all tasks route through OpenRouter's free models.
// Free model IDs change over time - verify at https://openrouter.ai/models?max_price=0
// and update the model strings below if one stops responding.
//
// FINAL RELEASE (later): once anthropic/openai are uncommented above, just
// change the `provider`/`model` values here to point specific tasks at
// Claude/GPT - e.g. { provider: 'anthropic', model: 'claude-sonnet-4-6' }.
// Nothing else in the app needs to change.
const MODEL_ROUTING = {
  test_plan_generation: { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' },
  test_case_generation: { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' },
  screenshot_analysis: { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' }, // vision-capable free model
  application_understanding: { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' },
  copilot_chat: { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' },
  defect_analysis: { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' },
  quick_edit: { provider: 'openrouter', model: 'qwen/qwen-2.5-72b-instruct:free' },
  summarization: { provider: 'openrouter', model: 'qwen/qwen-2.5-72b-instruct:free' },
} as const;

type TaskType = keyof typeof MODEL_ROUTING;

interface BaseParams {
  taskType: TaskType;
  prompt: string;
  maxTokens?: number;
  imageBase64?: string;
  imageMediaType?: string;
  overrideProvider?: { provider: keyof typeof PROVIDERS; model: string };
}

interface GenerateStructuredParams<T> extends BaseParams {
  schema: z.ZodSchema<T>;
}

interface GenerateResult<T> {
  data: T;
  provider: string;
  modelUsed: string;
  tokensUsed: number;
}

interface GenerateTextResult {
  text: string;
  provider: string;
  modelUsed: string;
  tokensUsed: number;
}

function resolveRouting(taskType: TaskType, overrideProvider?: BaseParams['overrideProvider']) {
  const routing = overrideProvider || MODEL_ROUTING[taskType];
  const provider = PROVIDERS[routing.provider];
  if (!provider) {
    throw new Error(
      `Unknown or disabled AI provider: "${routing.provider}". If this is anthropic/openai, ` +
        `uncomment it in lib/ai/orchestrator.ts (PROVIDERS registry + imports) first.`
    );
  }
  return { provider, providerName: routing.provider, model: routing.model };
}

/**
 * For generation tasks that must return validated structured JSON
 * (test plans, test cases, defect drafts, etc).
 */
export async function generateStructured<T>({
  taskType,
  prompt,
  schema,
  maxTokens = 8000,
  imageBase64,
  imageMediaType,
  overrideProvider,
}: GenerateStructuredParams<T>): Promise<GenerateResult<T>> {
  const { provider, providerName, model } = resolveRouting(taskType, overrideProvider);
  return callWithValidation(provider, providerName, model, prompt, schema, maxTokens, {
    imageBase64,
    imageMediaType,
  });
}

/**
 * For plain conversational replies (AI Copilot chat) - no schema, just text back.
 */
export async function generateText({
  taskType,
  prompt,
  maxTokens = 2000,
  imageBase64,
  imageMediaType,
  overrideProvider,
}: BaseParams): Promise<GenerateTextResult> {
  const { provider, providerName, model } = resolveRouting(taskType, overrideProvider);
  const response = await provider.call({ model, prompt, maxTokens, imageBase64, imageMediaType });
  return {
    text: response.text,
    provider: providerName,
    modelUsed: model,
    tokensUsed: response.tokensUsed,
  };
}

async function callWithValidation<T>(
  provider: AIProvider,
  providerName: string,
  model: string,
  prompt: string,
  schema: z.ZodSchema<T>,
  maxTokens: number,
  imageParams: { imageBase64?: string; imageMediaType?: string },
  attempt = 1
): Promise<GenerateResult<T>> {
  const response = await provider.call({
    model,
    prompt,
    maxTokens,
    imageBase64: imageParams.imageBase64,
    imageMediaType: imageParams.imageMediaType,
  });

  const cleaned = response.text.replace(/```json|```/g, '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    if (attempt < 2) {
      const retryPrompt = `${prompt}\n\nYour previous response was not valid JSON. Output ONLY valid JSON, no markdown fences, no extra text.`;
      return callWithValidation(provider, providerName, model, retryPrompt, schema, maxTokens, imageParams, attempt + 1);
    }
    throw new Error('AI returned invalid JSON after retry. Please try again.');
  }

  const validation = schema.safeParse(parsed);
  if (!validation.success) {
    if (attempt < 2) {
      const retryPrompt = `${prompt}\n\nYour previous response did not match the required schema. Validation errors: ${JSON.stringify(
        validation.error.issues
      )}\nOutput ONLY valid JSON matching the exact schema.`;
      return callWithValidation(provider, providerName, model, retryPrompt, schema, maxTokens, imageParams, attempt + 1);
    }
    throw new Error('AI output failed schema validation after retry. Please try again.');
  }

  return {
    data: validation.data,
    provider: providerName,
    modelUsed: model,
    tokensUsed: response.tokensUsed,
  };
}

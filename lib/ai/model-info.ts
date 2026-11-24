// [PHASE 1] Single source of truth for the CURRENT default AI routing. Both
// the server orchestrator (MODEL_ROUTING) and the settings UI import this, so
// the Settings panel can never drift from what actually runs (the old UI
// hardcoded a fake "active provider" row that went stale).
export const CURRENT_AI_SETUP = {
  provider: 'openrouter',
  providerLabel: 'OpenRouter (free tier models)',
  model: 'meta-llama/llama-3.3-70b-instruct:free',
  // Honest status: the provider is configured in code, but real generation
  // only works when an API key is present in the server environment.
  statusNote:
    'Configured in lib/ai/orchestrator.ts. Real generation requires OPENROUTER_API_KEY in the server environment — without it, generation requests fail with a visible error.',
} as const;

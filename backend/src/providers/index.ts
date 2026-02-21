/**
 * Provider Registry
 *
 * Central barrel that re-exports every provider + a helper to get a
 * provider instance by id.  Providers are lazily instantiated so we
 * only pay the import cost when actually used.
 */

export type { LLMProvider, ModelInfo, ChatCompletionParams, ChatCompletionResult, ChatStreamMeta, TokenUsage } from './llm-provider.interface';
export { OpenAIProvider } from './openai.provider';
export { AnthropicProvider } from './anthropic.provider';
export { GoogleProvider } from './google.provider';
export { GroqProvider } from './groq.provider';

import type { LLMProvider } from './llm-provider.interface';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { GoogleProvider } from './google.provider';
import { GroqProvider } from './groq.provider';

// ─── Singleton instances (lazy) ──────────────────────────────────────────────

const instances = new Map<string, LLMProvider>();

function getOrCreate<T extends LLMProvider>(id: string, factory: () => T): T {
  if (!instances.has(id)) {
    instances.set(id, factory());
  }
  return instances.get(id) as T;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** All registered provider IDs. */
export const PROVIDER_IDS = ['openai', 'anthropic', 'google', 'groq'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

/** Get a provider instance by id. Throws if unknown. */
export function getProvider(id: string): LLMProvider {
  switch (id) {
    case 'openai':
      return getOrCreate('openai', () => new OpenAIProvider());
    case 'anthropic':
      return getOrCreate('anthropic', () => new AnthropicProvider());
    case 'google':
      return getOrCreate('google', () => new GoogleProvider());
    case 'groq':
      return getOrCreate('groq', () => new GroqProvider());
    default:
      throw new Error(`Unknown LLM provider: ${id}`);
  }
}

/** List all available providers with their model catalogues. */
export function listProviders(): LLMProvider[] {
  return PROVIDER_IDS.map(getProvider);
}

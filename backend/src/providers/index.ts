/**
 * Provider Barrel
 *
 * Re-exports all provider-related types, classes, and the central
 * ProviderRegistry.  Prefer importing from this barrel rather than
 * reaching into individual provider files.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type { LLMProvider, ModelInfo, ChatCompletionParams, ChatCompletionResult, ChatStreamMeta, TokenUsage } from './llm-provider.interface';
export type { ModeConfig, ProviderListItem } from './provider-registry';

// ─── Concrete providers ──────────────────────────────────────────────────────

export { OpenAIProvider } from './openai.provider';
export { AnthropicProvider } from './anthropic.provider';
export { GoogleProvider } from './google.provider';
export { GroqProvider } from './groq.provider';

// ─── Registry (primary API) ──────────────────────────────────────────────────

export { ProviderRegistry } from './provider-registry';

// ─── Convenience re-exports ──────────────────────────────────────────────────

/** All known provider IDs. */
export const PROVIDER_IDS = ['openai', 'anthropic', 'google', 'groq'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

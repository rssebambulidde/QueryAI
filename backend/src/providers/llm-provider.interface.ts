/**
 * LLM Provider Abstraction Layer
 *
 * Defines a uniform interface so the app can swap between OpenAI, Anthropic,
 * Google, Mistral, Groq, etc. without touching business logic.
 */

// ─── Provider contract ───────────────────────────────────────────────────────

export interface LLMProvider {
  readonly id: string;          // 'openai' | 'anthropic' | 'google' | 'mistral' | 'groq'
  readonly displayName: string;
  readonly supportedModels: ModelInfo[];

  chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult>;
  chatCompletionStream(params: ChatCompletionParams): AsyncGenerator<string, ChatStreamMeta, unknown>;
}

// ─── Model metadata ──────────────────────────────────────────────────────────

export interface ModelInfo {
  id: string;                   // 'gpt-4o-mini', 'claude-sonnet-4-20250514', etc.
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputCostPer1M: number;       // USD per 1 M input tokens
  outputCostPer1M: number;      // USD per 1 M output tokens
  capabilities: ModelCapability[];
  isDefault?: boolean;
}

export type ModelCapability = 'chat' | 'structured_output' | 'vision';

// ─── Chat completion params & results ────────────────────────────────────────

export interface ChatCompletionParams {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
  signal?: AbortSignal;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  usage: TokenUsage;
  finishReason: string;
}

export interface ChatStreamMeta {
  model: string;
  usage?: TokenUsage;
}

// ─── Shared sub-types ────────────────────────────────────────────────────────

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** Convenience alias used across services in place of OpenAI-specific message types. */
export type ChatMessage = ChatCompletionParams['messages'][number];

/**
 * Groq LLM Provider (fast inference)
 *
 * Groq uses an OpenAI-compatible API, so the implementation mirrors the
 * OpenAI provider but points at Groq's endpoint with its own models.
 */

import Groq from 'groq-sdk';
import config from '../config/env';
import logger from '../config/logger';
import type {
  LLMProvider,
  ModelInfo,
  ChatCompletionParams,
  ChatCompletionResult,
  ChatStreamMeta,
} from './llm-provider.interface';

// ─── Model catalogue ─────────────────────────────────────────────────────────

const GROQ_MODELS: ModelInfo[] = [
  // ── Meta Llama 4 family ──────────────────────────────────────────────────
  {
    id: 'meta-llama/llama-4-scout-17b-16e-instruct',
    displayName: 'Llama 4 Scout 17B',
    contextWindow: 131_072,
    maxOutputTokens: 8_192,
    inputCostPer1M: 0.11,
    outputCostPer1M: 0.34,
    capabilities: ['chat', 'vision'],
  },
  {
    id: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    displayName: 'Llama 4 Maverick 17B',
    contextWindow: 131_072,
    maxOutputTokens: 8_192,
    inputCostPer1M: 0.50,
    outputCostPer1M: 0.77,
    capabilities: ['chat', 'vision'],
  },
  // ── Meta Llama 3 family ──────────────────────────────────────────────────
  {
    id: 'llama-3.3-70b-versatile',
    displayName: 'Llama 3.3 70B',
    contextWindow: 128_000,
    maxOutputTokens: 32_768,
    inputCostPer1M: 0.59,
    outputCostPer1M: 0.79,
    capabilities: ['chat', 'structured_output'],
    isDefault: true,
  },
  {
    id: 'llama-3.3-70b-specdec',
    displayName: 'Llama 3.3 70B SpecDec',
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    inputCostPer1M: 0.59,
    outputCostPer1M: 0.79,
    capabilities: ['chat'],
  },
  {
    id: 'llama-3.1-8b-instant',
    displayName: 'Llama 3.1 8B',
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    inputCostPer1M: 0.05,
    outputCostPer1M: 0.08,
    capabilities: ['chat', 'structured_output'],
  },
  {
    id: 'llama-3.2-1b-preview',
    displayName: 'Llama 3.2 1B',
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    inputCostPer1M: 0.04,
    outputCostPer1M: 0.04,
    capabilities: ['chat'],
  },
  {
    id: 'llama-3.2-3b-preview',
    displayName: 'Llama 3.2 3B',
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    inputCostPer1M: 0.06,
    outputCostPer1M: 0.06,
    capabilities: ['chat'],
  },
  {
    id: 'llama-3.2-11b-vision-preview',
    displayName: 'Llama 3.2 11B Vision',
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    inputCostPer1M: 0.18,
    outputCostPer1M: 0.18,
    capabilities: ['chat', 'vision'],
  },
  {
    id: 'llama-3.2-90b-vision-preview',
    displayName: 'Llama 3.2 90B Vision',
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    inputCostPer1M: 0.90,
    outputCostPer1M: 0.90,
    capabilities: ['chat', 'vision'],
  },
  // ── Mistral family ───────────────────────────────────────────────────────
  {
    id: 'mixtral-8x7b-32768',
    displayName: 'Mixtral 8x7B',
    contextWindow: 32_768,
    maxOutputTokens: 32_768,
    inputCostPer1M: 0.24,
    outputCostPer1M: 0.24,
    capabilities: ['chat'],
  },
  {
    id: 'mistral-saba-24b',
    displayName: 'Mistral Saba 24B',
    contextWindow: 32_768,
    maxOutputTokens: 8_192,
    inputCostPer1M: 0.20,
    outputCostPer1M: 0.20,
    capabilities: ['chat'],
  },
  // ── Google (Groq-hosted) ─────────────────────────────────────────────────
  {
    id: 'gemma2-9b-it',
    displayName: 'Gemma 2 9B',
    contextWindow: 8_192,
    maxOutputTokens: 8_192,
    inputCostPer1M: 0.20,
    outputCostPer1M: 0.20,
    capabilities: ['chat'],
  },
  // ── DeepSeek (Groq-hosted) ───────────────────────────────────────────────
  {
    id: 'deepseek-r1-distill-llama-70b',
    displayName: 'DeepSeek R1 Distill 70B',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    inputCostPer1M: 0.75,
    outputCostPer1M: 0.99,
    capabilities: ['chat'],
  },
  // ── Qwen (Groq-hosted) ──────────────────────────────────────────────────
  {
    id: 'qwen-qwq-32b',
    displayName: 'Qwen QwQ 32B',
    contextWindow: 128_000,
    maxOutputTokens: 32_768,
    inputCostPer1M: 0.29,
    outputCostPer1M: 0.39,
    capabilities: ['chat'],
  },
];

// ─── Provider implementation ─────────────────────────────────────────────────

export class GroqProvider implements LLMProvider {
  readonly id = 'groq' as const;
  readonly displayName = 'Groq';
  readonly supportedModels = GROQ_MODELS;

  private client: Groq | null = null;

  private getClient(): Groq {
    if (!this.client) {
      if (!config.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY is not configured.');
      }
      this.client = new Groq({ apiKey: config.GROQ_API_KEY });
    }
    return this.client;
  }

  // ── Non-streaming ────────────────────────────────────────────────────────

  async chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult> {
    const { model, messages, temperature, maxTokens, responseFormat, signal } = params;

    const response = await this.getClient().chat.completions.create(
      {
        model,
        messages: messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens,
        ...(responseFormat === 'json' && {
          response_format: { type: 'json_object' as const },
        }),
      },
      ...(signal ? [{ signal }] : []),
    );

    const choice = response.choices[0];

    return {
      content: choice?.message?.content ?? '',
      model: response.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      finishReason: choice?.finish_reason ?? 'unknown',
    };
  }

  // ── Streaming ────────────────────────────────────────────────────────────

  async *chatCompletionStream(
    params: ChatCompletionParams,
  ): AsyncGenerator<string, ChatStreamMeta, unknown> {
    const { model, messages, temperature, maxTokens, responseFormat, signal } = params;

    const stream = await this.getClient().chat.completions.create(
      {
        model,
        messages: messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens,
        stream: true,
        ...(responseFormat === 'json' && {
          response_format: { type: 'json_object' as const },
        }),
      },
      ...(signal ? [{ signal }] : []),
    );

    let promptTokens = 0;
    let completionTokens = 0;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;

      // Groq may include usage info (x_groq field)
      if ((chunk as any).x_groq?.usage) {
        const usage = (chunk as any).x_groq.usage;
        promptTokens = usage.prompt_tokens ?? 0;
        completionTokens = usage.completion_tokens ?? 0;
      }
    }

    return {
      model,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }
}

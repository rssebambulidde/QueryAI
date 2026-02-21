/**
 * OpenAI LLM Provider
 *
 * Wraps the existing OpenAI client + pool infrastructure behind the
 * LLMProvider interface so it can be swapped with Anthropic / Gemini / Groq.
 */

import OpenAI from 'openai';
import OpenAIPool from '../config/openai.config';
import logger from '../config/logger';
import type {
  LLMProvider,
  ModelInfo,
  ChatCompletionParams,
  ChatCompletionResult,
  ChatStreamMeta,
} from './llm-provider.interface';

// ─── Model catalogue ─────────────────────────────────────────────────────────

const OPENAI_MODELS: ModelInfo[] = [
  // ── GPT-4.5 family ───────────────────────────────────────────────────────
  {
    id: 'gpt-4.5-preview',
    displayName: 'GPT-4.5 Preview',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    inputCostPer1M: 75.00,
    outputCostPer1M: 150.00,
    capabilities: ['chat', 'structured_output', 'vision'],
  },
  // ── GPT-4o family ────────────────────────────────────────────────────────
  {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    inputCostPer1M: 2.50,
    outputCostPer1M: 10.00,
    capabilities: ['chat', 'structured_output', 'vision'],
  },
  {
    id: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
    capabilities: ['chat', 'structured_output', 'vision'],
    isDefault: true,
  },
  // ── GPT-4.1 family ───────────────────────────────────────────────────────
  {
    id: 'gpt-4.1',
    displayName: 'GPT-4.1',
    contextWindow: 1_047_576,
    maxOutputTokens: 32_768,
    inputCostPer1M: 2.00,
    outputCostPer1M: 8.00,
    capabilities: ['chat', 'structured_output', 'vision'],
  },
  {
    id: 'gpt-4.1-mini',
    displayName: 'GPT-4.1 Mini',
    contextWindow: 1_047_576,
    maxOutputTokens: 32_768,
    inputCostPer1M: 0.40,
    outputCostPer1M: 1.60,
    capabilities: ['chat', 'structured_output', 'vision'],
  },
  {
    id: 'gpt-4.1-nano',
    displayName: 'GPT-4.1 Nano',
    contextWindow: 1_047_576,
    maxOutputTokens: 32_768,
    inputCostPer1M: 0.10,
    outputCostPer1M: 0.40,
    capabilities: ['chat', 'structured_output', 'vision'],
  },
  // ── GPT-4 Turbo ──────────────────────────────────────────────────────────
  {
    id: 'gpt-4-turbo',
    displayName: 'GPT-4 Turbo',
    contextWindow: 128_000,
    maxOutputTokens: 4_096,
    inputCostPer1M: 10.00,
    outputCostPer1M: 30.00,
    capabilities: ['chat', 'structured_output', 'vision'],
  },
  // ── GPT-3.5 ──────────────────────────────────────────────────────────────
  {
    id: 'gpt-3.5-turbo',
    displayName: 'GPT-3.5 Turbo',
    contextWindow: 16_385,
    maxOutputTokens: 4_096,
    inputCostPer1M: 0.50,
    outputCostPer1M: 1.50,
    capabilities: ['chat', 'structured_output'],
  },
  // ── o-series (reasoning) ─────────────────────────────────────────────────
  {
    id: 'o1',
    displayName: 'o1',
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    inputCostPer1M: 15.00,
    outputCostPer1M: 60.00,
    capabilities: ['chat', 'vision'],
  },
  {
    id: 'o1-mini',
    displayName: 'o1 Mini',
    contextWindow: 128_000,
    maxOutputTokens: 65_536,
    inputCostPer1M: 3.00,
    outputCostPer1M: 12.00,
    capabilities: ['chat'],
  },
  {
    id: 'o1-pro',
    displayName: 'o1 Pro',
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    inputCostPer1M: 150.00,
    outputCostPer1M: 600.00,
    capabilities: ['chat'],
  },
  {
    id: 'o3',
    displayName: 'o3',
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    inputCostPer1M: 10.00,
    outputCostPer1M: 40.00,
    capabilities: ['chat', 'structured_output', 'vision'],
  },
  {
    id: 'o3-mini',
    displayName: 'o3 Mini',
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    inputCostPer1M: 1.10,
    outputCostPer1M: 4.40,
    capabilities: ['chat', 'structured_output'],
  },
  {
    id: 'o4-mini',
    displayName: 'o4 Mini',
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    inputCostPer1M: 1.10,
    outputCostPer1M: 4.40,
    capabilities: ['chat', 'structured_output', 'vision'],
  },
  {
    id: 'o3-pro',
    displayName: 'o3 Pro',
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    inputCostPer1M: 20.00,
    outputCostPer1M: 80.00,
    capabilities: ['chat', 'structured_output', 'vision'],
  },
];

// ─── Provider implementation ─────────────────────────────────────────────────

export class OpenAIProvider implements LLMProvider {
  readonly id = 'openai' as const;
  readonly displayName = 'OpenAI';
  readonly supportedModels = OPENAI_MODELS;

  private get client(): OpenAI {
    return OpenAIPool.getClient();
  }

  // ── Non-streaming ────────────────────────────────────────────────────────

  async chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult> {
    const { model, messages, temperature, maxTokens, responseFormat, signal } = params;

    const response = await OpenAIPool.executeRequest(
      (client) =>
        client.chat.completions.create(
          {
            model,
            messages: messages as OpenAI.ChatCompletionMessageParam[],
            temperature: temperature ?? 0.7,
            max_tokens: maxTokens,
            ...(responseFormat === 'json' && {
              response_format: { type: 'json_object' as const },
            }),
          },
          ...(signal ? [{ signal }] : []),
        ),
      model,
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

    const stream = await this.client.chat.completions.create(
      {
        model,
        messages: messages as OpenAI.ChatCompletionMessageParam[],
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens,
        stream: true,
        stream_options: { include_usage: true },
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

      // OpenAI sends usage in the final chunk when stream_options.include_usage is set
      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens ?? 0;
        completionTokens = chunk.usage.completion_tokens ?? 0;
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

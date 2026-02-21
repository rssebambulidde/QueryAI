/**
 * Anthropic LLM Provider
 *
 * Wraps the Anthropic Messages API behind the LLMProvider interface.
 * Handles the system-prompt-as-top-level-param quirk and the lack of a
 * native `response_format` by injecting a JSON instruction.
 */

import Anthropic from '@anthropic-ai/sdk';
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

const ANTHROPIC_MODELS: ModelInfo[] = [
  // ── Claude 4 family ──────────────────────────────────────────────────────
  {
    id: 'claude-opus-4-20250514',
    displayName: 'Claude Opus 4',
    contextWindow: 200_000,
    maxOutputTokens: 32_000,
    inputCostPer1M: 15.00,
    outputCostPer1M: 75.00,
    capabilities: ['chat', 'structured_output', 'vision'],
  },
  {
    id: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    contextWindow: 200_000,
    maxOutputTokens: 16_384,
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    capabilities: ['chat', 'structured_output', 'vision'],
    isDefault: true,
  },
  // ── Claude 3.5 family ────────────────────────────────────────────────────
  {
    id: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet v2',
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    capabilities: ['chat', 'structured_output', 'vision'],
  },
  {
    id: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    inputCostPer1M: 0.80,
    outputCostPer1M: 4.00,
    capabilities: ['chat', 'vision'],
  },
  // ── Claude 3 family ──────────────────────────────────────────────────────
  {
    id: 'claude-3-opus-20240229',
    displayName: 'Claude 3 Opus',
    contextWindow: 200_000,
    maxOutputTokens: 4_096,
    inputCostPer1M: 15.00,
    outputCostPer1M: 75.00,
    capabilities: ['chat', 'vision'],
  },
  {
    id: 'claude-3-haiku-20240307',
    displayName: 'Claude 3 Haiku',
    contextWindow: 200_000,
    maxOutputTokens: 4_096,
    inputCostPer1M: 0.25,
    outputCostPer1M: 1.25,
    capabilities: ['chat', 'vision'],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Anthropic requires the system prompt as a top-level param, not inside
 * the messages array.  This helper splits our uniform messages format.
 */
function splitSystemMessages(
  messages: ChatCompletionParams['messages'],
): {
  system: string | undefined;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
} {
  const systemParts: string[] = [];
  const rest: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push(m.content);
    } else {
      rest.push({ role: m.role as 'user' | 'assistant', content: m.content });
    }
  }

  return {
    system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    messages: rest,
  };
}

// ─── Provider implementation ─────────────────────────────────────────────────

export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic' as const;
  readonly displayName = 'Anthropic';
  readonly supportedModels = ANTHROPIC_MODELS;

  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!this.client) {
      if (!config.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is not configured.');
      }
      this.client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
    }
    return this.client;
  }

  // ── Non-streaming ────────────────────────────────────────────────────────

  async chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult> {
    const { model, messages: rawMessages, temperature, maxTokens, responseFormat, signal } = params;
    const { system, messages } = splitSystemMessages(rawMessages);

    // Anthropic has no native response_format — inject a JSON instruction
    const effectiveSystem =
      responseFormat === 'json'
        ? [system, 'You MUST respond with valid JSON only. No markdown fences, no explanation.']
            .filter(Boolean)
            .join('\n\n')
        : system;

    const response = await this.getClient().messages.create(
      {
        model,
        max_tokens: maxTokens ?? 4096,
        temperature: temperature ?? 0.7,
        ...(effectiveSystem && { system: effectiveSystem }),
        messages,
      },
      ...(signal ? [{ signal }] : []),
    );

    const textBlock = response.content.find((b) => b.type === 'text');

    return {
      content: textBlock?.text ?? '',
      model: response.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: response.stop_reason ?? 'unknown',
    };
  }

  // ── Streaming ────────────────────────────────────────────────────────────

  async *chatCompletionStream(
    params: ChatCompletionParams,
  ): AsyncGenerator<string, ChatStreamMeta, unknown> {
    const { model, messages: rawMessages, temperature, maxTokens, responseFormat, signal } = params;
    const { system, messages } = splitSystemMessages(rawMessages);

    const effectiveSystem =
      responseFormat === 'json'
        ? [system, 'You MUST respond with valid JSON only. No markdown fences, no explanation.']
            .filter(Boolean)
            .join('\n\n')
        : system;

    const stream = await this.getClient().messages.create(
      {
        model,
        max_tokens: maxTokens ?? 4096,
        temperature: temperature ?? 0.7,
        ...(effectiveSystem && { system: effectiveSystem }),
        messages,
        stream: true,
      },
      ...(signal ? [{ signal }] : []),
    );

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const event of stream as AsyncIterable<any>) {
      switch (event.type) {
        case 'message_start':
          inputTokens = event.message?.usage?.input_tokens ?? 0;
          break;
        case 'content_block_delta':
          if (event.delta?.type === 'text_delta' && event.delta.text) {
            yield event.delta.text;
          }
          break;
        case 'message_delta':
          outputTokens = event.usage?.output_tokens ?? 0;
          break;
      }
    }

    return {
      model,
      usage: {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
    };
  }
}

/**
 * Google Gemini LLM Provider
 *
 * Wraps the @google/generative-ai SDK behind the LLMProvider interface.
 * Handles the Gemini-specific message format (role: 'user' | 'model',
 * parts: [{ text }]) and streaming via generateContentStream().
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import type { Content, GenerateContentResult } from '@google/generative-ai';
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

const GOOGLE_MODELS: ModelInfo[] = [
  // ── Gemini 2.5 family ────────────────────────────────────────────────────
  {
    id: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    inputCostPer1M: 1.25,
    outputCostPer1M: 10.00,
    capabilities: ['chat', 'structured_output', 'vision'],
  },
  {
    id: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
    capabilities: ['chat', 'structured_output', 'vision'],
    isDefault: true,
  },
  // ── Gemini 2.0 family ────────────────────────────────────────────────────
  {
    id: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    inputCostPer1M: 0.10,
    outputCostPer1M: 0.40,
    capabilities: ['chat', 'structured_output', 'vision'],
  },
  {
    id: 'gemini-2.0-flash-lite',
    displayName: 'Gemini 2.0 Flash Lite',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.30,
    capabilities: ['chat', 'structured_output', 'vision'],
  },
  // ── Gemini 1.5 family ────────────────────────────────────────────────────
  {
    id: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    contextWindow: 2_097_152,
    maxOutputTokens: 8_192,
    inputCostPer1M: 1.25,
    outputCostPer1M: 5.00,
    capabilities: ['chat', 'structured_output', 'vision'],
  },
  {
    id: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.30,
    capabilities: ['chat', 'structured_output', 'vision'],
  },
  {
    id: 'gemini-1.5-flash-8b',
    displayName: 'Gemini 1.5 Flash 8B',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    inputCostPer1M: 0.0375,
    outputCostPer1M: 0.15,
    capabilities: ['chat', 'structured_output', 'vision'],
  },
];

// ─── Safety settings (permissive — we rely on our own moderation) ────────────

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert our uniform messages array to Gemini's Content[] format.
 * System messages are extracted as a systemInstruction string.
 *  • 'user'      → role: 'user'
 *  • 'assistant'  → role: 'model'
 */
function toGeminiFormat(
  messages: ChatCompletionParams['messages'],
): { systemInstruction: string | undefined; history: Content[]; lastUserMessage: string } {
  const systemParts: string[] = [];
  const history: Content[] = [];

  for (const m of messages) {
    // Flatten ContentPart[] to plain string (vision payloads only supported by OpenAI)
    const text = typeof m.content === 'string'
      ? m.content
      : m.content.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map(p => p.text).join('\n');
    if (m.role === 'system') {
      systemParts.push(text);
    } else {
      history.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text }],
      });
    }
  }

  // Gemini's chat API expects the last message to be the user prompt
  // passed to sendMessage(), everything before is history.
  const lastMessage = history.pop();
  const lastUserMessage = lastMessage?.parts?.[0]
    ? (lastMessage.parts[0] as { text: string }).text
    : '';

  return {
    systemInstruction: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    history,
    lastUserMessage,
  };
}

// ─── Provider implementation ─────────────────────────────────────────────────

export class GoogleProvider implements LLMProvider {
  readonly id = 'google' as const;
  readonly displayName = 'Google';
  readonly supportedModels = GOOGLE_MODELS;

  private genAI: GoogleGenerativeAI | null = null;

  private getGenAI(): GoogleGenerativeAI {
    if (!this.genAI) {
      if (!config.GOOGLE_AI_API_KEY) {
        throw new Error('GOOGLE_AI_API_KEY is not configured.');
      }
      this.genAI = new GoogleGenerativeAI(config.GOOGLE_AI_API_KEY);
    }
    return this.genAI;
  }

  // ── Non-streaming ────────────────────────────────────────────────────────

  async chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult> {
    const { model, messages, temperature, maxTokens, responseFormat } = params;
    const { systemInstruction, history, lastUserMessage } = toGeminiFormat(messages);

    const genModel = this.getGenAI().getGenerativeModel({
      model,
      safetySettings: SAFETY_SETTINGS,
      generationConfig: {
        temperature: temperature ?? 0.7,
        maxOutputTokens: maxTokens,
        ...(responseFormat === 'json' && { responseMimeType: 'application/json' }),
      },
      ...(systemInstruction && { systemInstruction }),
    });

    const chat = genModel.startChat({ history });
    const result = await chat.sendMessage(lastUserMessage);
    const response = result.response;
    const text = response.text();
    const usage = response.usageMetadata;

    return {
      content: text,
      model,
      usage: {
        promptTokens: usage?.promptTokenCount ?? 0,
        completionTokens: usage?.candidatesTokenCount ?? 0,
        totalTokens: usage?.totalTokenCount ?? 0,
      },
      finishReason: response.candidates?.[0]?.finishReason ?? 'unknown',
    };
  }

  // ── Streaming ────────────────────────────────────────────────────────────

  async *chatCompletionStream(
    params: ChatCompletionParams,
  ): AsyncGenerator<string, ChatStreamMeta, unknown> {
    const { model, messages, temperature, maxTokens, responseFormat } = params;
    const { systemInstruction, history, lastUserMessage } = toGeminiFormat(messages);

    const genModel = this.getGenAI().getGenerativeModel({
      model,
      safetySettings: SAFETY_SETTINGS,
      generationConfig: {
        temperature: temperature ?? 0.7,
        maxOutputTokens: maxTokens,
        ...(responseFormat === 'json' && { responseMimeType: 'application/json' }),
      },
      ...(systemInstruction && { systemInstruction }),
    });

    const chat = genModel.startChat({ history });
    const result = await chat.sendMessageStream(lastUserMessage);

    let promptTokens = 0;
    let completionTokens = 0;

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;

      const usage = chunk.usageMetadata;
      if (usage) {
        promptTokens = usage.promptTokenCount ?? promptTokens;
        completionTokens = usage.candidatesTokenCount ?? completionTokens;
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

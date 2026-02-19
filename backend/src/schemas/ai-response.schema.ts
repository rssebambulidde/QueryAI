/**
 * Structured-output schema for AI answer responses.
 *
 * Used with OpenAI's `response_format: { type: "json_schema" }` (gpt-4o-mini)
 * and `{ type: "json_object" }` (gpt-3.5-turbo) to guarantee that the model
 * returns a well-typed JSON object containing the answer, follow-up questions
 * and cited sources — eliminating the need for regex-based extraction.
 */

import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

// ── Schema ────────────────────────────────────────────────────────────

export const CitedSourceSchema = z.object({
  /** 1-based index matching the source list in the context */
  index: z.number().int(),
  /** Whether the source is a document or web result */
  type: z.enum(['document', 'web']),
  /** URL or document:// URI; null when not applicable */
  url: z.string().nullable(),
});

export const AIResponseSchema = z.object({
  /** The complete answer with inline markdown citation links */
  answer: z.string(),
  /** Exactly 4 follow-up questions derived from this specific exchange */
  followUpQuestions: z.array(z.string()),
  /** Array of sources actually cited in the answer */
  citedSources: z.array(CitedSourceSchema),
});

// ── Inferred types ────────────────────────────────────────────────────

export type AIStructuredResponse = z.infer<typeof AIResponseSchema>;
export type CitedSource = z.infer<typeof CitedSourceSchema>;

// ── Response format helpers ───────────────────────────────────────────

/**
 * Returns the `response_format` parameter for OpenAI based on model.
 *
 * - gpt-4o / gpt-4o-mini  → `json_schema` with strict Zod schema
 * - gpt-3.5-turbo          → `json_object` (prompt-guided)
 */
export function getResponseFormat(model: string) {
  if (supportsJsonSchema(model)) {
    return zodResponseFormat(AIResponseSchema, 'ai_response');
  }
  // gpt-3.5-turbo only supports basic json_object mode
  return { type: 'json_object' as const };
}

/**
 * Whether the model supports `response_format: { type: "json_schema" }`.
 */
export function supportsJsonSchema(model: string): boolean {
  return (
    model.startsWith('gpt-4o') ||
    model.startsWith('gpt-4.1') ||
    model.startsWith('o') // o1, o3, o4-mini etc.
  );
}

// ── Prompt instructions for json_object fallback ──────────────────────

/**
 * JSON schema description inserted into the system prompt when the model
 * only supports `json_object` mode (gpt-3.5-turbo). For `json_schema`
 * models the schema is enforced structurally, but including a brief
 * mention still helps the model produce cleaner output.
 */
export const JSON_OUTPUT_INSTRUCTIONS = `
You MUST respond with a single JSON object matching this schema — no markdown fences, no extra text:
{
  "answer": "<your full answer with inline markdown citation links>",
  "followUpQuestions": ["<q1>", "<q2>", "<q3>", "<q4>"],
  "citedSources": [
    { "index": 1, "type": "web", "url": "https://..." },
    { "index": 2, "type": "document", "url": null }
  ]
}
Rules:
- "answer" contains the complete response with inline [Source N](url) citations.
- "followUpQuestions" must have exactly 4 questions derived from this exchange.
- "citedSources" lists every source you actually cited (index matches the source number from context).
- Do NOT wrap the JSON in markdown code fences.`.trim();

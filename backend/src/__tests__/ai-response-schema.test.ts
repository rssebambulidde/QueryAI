/**
 * Tests for AI Response Schema
 */
import { AIResponseSchema, getResponseFormat, supportsJsonSchema, JSON_OUTPUT_INSTRUCTIONS } from '../schemas/ai-response.schema';

describe('AIResponseSchema', () => {
  it('validates a correct response', () => {
    const input = {
      answer: 'The sky is blue according to [Web Source 1](https://example.com).',
      followUpQuestions: ['Why is the sky blue?', 'What about at sunset?', 'How does light scatter?', 'Any related facts?'],
      citedSources: [
        { index: 1, type: 'web', url: 'https://example.com' },
        { index: 2, type: 'document', url: null },
      ],
    };

    const result = AIResponseSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.answer).toBe(input.answer);
      expect(result.data.followUpQuestions).toHaveLength(4);
      expect(result.data.citedSources).toHaveLength(2);
      expect(result.data.citedSources[1].url).toBeNull();
    }
  });

  it('rejects response with missing answer', () => {
    const input = {
      followUpQuestions: ['Q1'],
      citedSources: [],
    };
    const result = AIResponseSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects response with invalid citedSource type', () => {
    const input = {
      answer: 'Hello',
      followUpQuestions: [],
      citedSources: [{ index: 1, type: 'invalid', url: null }],
    };
    const result = AIResponseSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('accepts response with empty arrays', () => {
    const input = {
      answer: 'No sources found.',
      followUpQuestions: [],
      citedSources: [],
    };
    const result = AIResponseSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe('supportsJsonSchema', () => {
  it('returns true for gpt-4o models', () => {
    expect(supportsJsonSchema('gpt-4o')).toBe(true);
    expect(supportsJsonSchema('gpt-4o-mini')).toBe(true);
    expect(supportsJsonSchema('gpt-4o-2024-08-06')).toBe(true);
  });

  it('returns false for gpt-3.5-turbo', () => {
    expect(supportsJsonSchema('gpt-3.5-turbo')).toBe(false);
    expect(supportsJsonSchema('gpt-3.5-turbo-0125')).toBe(false);
  });

  it('returns true for o-series models', () => {
    expect(supportsJsonSchema('o1')).toBe(true);
    expect(supportsJsonSchema('o3')).toBe(true);
    expect(supportsJsonSchema('o4-mini')).toBe(true);
  });

  it('returns true for gpt-4.1 models', () => {
    expect(supportsJsonSchema('gpt-4.1')).toBe(true);
    expect(supportsJsonSchema('gpt-4.1-mini')).toBe(true);
  });
});

describe('getResponseFormat', () => {
  it('returns json_schema format for gpt-4o-mini', () => {
    const format = getResponseFormat('gpt-4o-mini');
    expect(format).toBeDefined();
    expect(format).toHaveProperty('type', 'json_schema');
  });

  it('returns json_object format for gpt-3.5-turbo', () => {
    const format = getResponseFormat('gpt-3.5-turbo');
    expect(format).toEqual({ type: 'json_object' });
  });
});

describe('JSON_OUTPUT_INSTRUCTIONS', () => {
  it('contains the required JSON schema example', () => {
    expect(JSON_OUTPUT_INSTRUCTIONS).toContain('"answer"');
    expect(JSON_OUTPUT_INSTRUCTIONS).toContain('"followUpQuestions"');
    expect(JSON_OUTPUT_INSTRUCTIONS).toContain('"citedSources"');
  });

  it('includes rules for follow-up questions count', () => {
    expect(JSON_OUTPUT_INSTRUCTIONS).toContain('exactly 4 questions');
  });
});

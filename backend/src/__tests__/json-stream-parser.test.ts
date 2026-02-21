/**
 * Tests for JsonAnswerStreamParser
 */
import { JsonAnswerStreamParser } from '../utils/json-stream-parser';

describe('JsonAnswerStreamParser', () => {
  let parser: JsonAnswerStreamParser;

  beforeEach(() => {
    parser = new JsonAnswerStreamParser();
  });

  it('extracts the answer field from a complete JSON string', () => {
    const json = '{"answer":"Hello world","followUpQuestions":["Q1"],"citedSources":[]}';
    const result = parser.feed(json);
    expect(result).toBe('Hello world');
    expect(parser.isAnswerComplete()).toBe(true);
  });

  it('streams answer text character-by-character', () => {
    const json = '{"answer":"abc","followUpQuestions":[]}';
    let output = '';
    for (const char of json) {
      output += parser.feed(char);
    }
    expect(output).toBe('abc');
    expect(parser.isAnswerComplete()).toBe(true);
  });

  it('correctly handles JSON string escapes', () => {
    const json = '{"answer":"line1\\nline2\\ttab \\\\ backslash \\"quote\\"","followUpQuestions":[]}';
    const result = parser.feed(json);
    expect(result).toBe('line1\nline2\ttab \\ backslash "quote"');
  });

  it('handles multi-chunk streaming with varying chunk sizes', () => {
    const json = '{"answer":"The quick brown fox","followUpQuestions":["Q1","Q2"],"citedSources":[{"index":1,"type":"web","url":"https://example.com"}]}';
    const chunks = [
      '{"answ',
      'er":"The ',
      'quick ',
      'brown fox',
      '","followUp',
      'Questions":["Q1","Q2"],',
      '"citedSources":[{"index":1,',
      '"type":"web","url":"https://example.com"}]}',
    ];

    let answer = '';
    for (const chunk of chunks) {
      answer += parser.feed(chunk);
    }

    expect(answer).toBe('The quick brown fox');
    expect(parser.isAnswerComplete()).toBe(true);
  });

  it('returns empty string before answer field is found', () => {
    expect(parser.feed('{"someOtherField')).toBe('');
    expect(parser.feed('":"value","answer')).toBe('');
    expect(parser.isAnswerComplete()).toBe(false);
  });

  it('stops yielding after answer field closes', () => {
    const result1 = parser.feed('{"answer":"hello"');
    expect(result1).toBe('hello');
    expect(parser.isAnswerComplete()).toBe(true);

    // Further input should not produce more output
    const result2 = parser.feed(',"followUpQuestions":["Q1"]}');
    expect(result2).toBe('');
  });

  it('accumulates full JSON for post-parse', () => {
    const json = '{"answer":"x","followUpQuestions":["A","B","C","D"],"citedSources":[]}';
    parser.feed(json);
    expect(parser.getAccumulatedJson()).toBe(json);
  });

  it('handles answer with markdown citation links', () => {
    const answerText = 'According to [Web Source 1](https://example.com), the sky is blue.';
    const json = `{"answer":"${answerText.replace(/"/g, '\\"')}","followUpQuestions":[]}`;
    const result = parser.feed(json);
    expect(result).toBe(answerText);
  });

  it('handles answer with unicode escapes (\\uXXXX)', () => {
    const json = '{"answer":"Caf\\u00e9 is French","followUpQuestions":[]}';
    const result = parser.feed(json);
    expect(result).toBe('Café is French');
    expect(parser.isAnswerComplete()).toBe(true);
  });

  it('decodes multi-character unicode escapes in streaming', () => {
    // Feed the \\uXXXX across chunk boundaries
    let output = '';
    output += parser.feed('{"answer":"Hello \\u');
    output += parser.feed('00');
    output += parser.feed('e9 world","followUpQuestions":[]}');
    expect(output).toBe('Hello é world');
  });

  it('handles empty answer field', () => {
    const json = '{"answer":"","followUpQuestions":["Q1","Q2","Q3","Q4"],"citedSources":[]}';
    const result = parser.feed(json);
    expect(result).toBe('');
    expect(parser.isAnswerComplete()).toBe(true);
  });

  // ── Non-OpenAI provider scenarios ──────────────────────────────────

  describe('Anthropic (markdown fence wrapping)', () => {
    it('extracts answer from JSON wrapped in ```json fences', () => {
      const fenced = '```json\n{"answer":"Anthropic says hello","followUpQuestions":[],"citedSources":[]}\n```';
      const result = parser.feed(fenced);
      expect(result).toBe('Anthropic says hello');
      expect(parser.isAnswerComplete()).toBe(true);
    });

    it('sanitizes accumulated JSON by stripping fences', () => {
      const fenced = '```json\n{"answer":"test","followUpQuestions":[],"citedSources":[]}\n```';
      parser.feed(fenced);
      const sanitized = parser.getAccumulatedJson();
      expect(() => JSON.parse(sanitized)).not.toThrow();
      expect(JSON.parse(sanitized).answer).toBe('test');
    });

    it('handles preamble text before JSON', () => {
      const withPreamble = 'Here is the JSON response:\n{"answer":"from preamble","followUpQuestions":[]}';
      const result = parser.feed(withPreamble);
      expect(result).toBe('from preamble');
      expect(parser.isAnswerComplete()).toBe(true);
    });

    it('sanitizes accumulated JSON with preamble', () => {
      const withPreamble = 'Here is the response:\n{"answer":"x","followUpQuestions":[]}';
      parser.feed(withPreamble);
      const sanitized = parser.getAccumulatedJson();
      expect(() => JSON.parse(sanitized)).not.toThrow();
    });

    it('handles preamble plus fences streamed in chunks', () => {
      let output = '';
      output += parser.feed('Sure! Here is');
      output += parser.feed(' the JSON:\n```json\n{');
      output += parser.feed('"answer":"chunked');
      output += parser.feed(' anthropic"');
      output += parser.feed(',"followUpQuestions":[]}\n```');
      expect(output).toBe('chunked anthropic');
      expect(parser.isAnswerComplete()).toBe(true);
    });
  });

  describe('Google Gemini (coarser chunks)', () => {
    it('handles large chunks typical of Gemini streaming', () => {
      // Gemini tends to yield bigger chunks
      let output = '';
      output += parser.feed('{"answer":"Gemini provides a detailed response about quantum computing. ');
      output += parser.feed('The field has seen rapid advances in recent years.');
      output += parser.feed('","followUpQuestions":["What are qubits?","How does entanglement work?"],"citedSources":[]}');
      expect(output).toBe(
        'Gemini provides a detailed response about quantum computing. ' +
        'The field has seen rapid advances in recent years.'
      );
      expect(parser.isAnswerComplete()).toBe(true);
    });
  });

  describe('plain text fallback', () => {
    it('reports foundAnswerField=false when no JSON is received', () => {
      parser.feed('This is just plain text without any JSON structure.');
      expect(parser.foundAnswerField()).toBe(false);
      expect(parser.isAnswerComplete()).toBe(false);
    });

    it('provides raw accumulated text via getRawAccumulated', () => {
      const plainText = 'The model ignored JSON instructions and returned this.';
      parser.feed(plainText);
      expect(parser.getRawAccumulated()).toBe(plainText);
      expect(parser.foundAnswerField()).toBe(false);
    });
  });

  describe('sanitizeJson (static)', () => {
    it('strips ```json fences', () => {
      const input = '```json\n{"key":"value"}\n```';
      expect(JsonAnswerStreamParser.sanitizeJson(input)).toBe('{"key":"value"}');
    });

    it('strips ``` fences without json label', () => {
      const input = '```\n{"key":"value"}\n```';
      expect(JsonAnswerStreamParser.sanitizeJson(input)).toBe('{"key":"value"}');
    });

    it('strips preamble before first {', () => {
      const input = 'Here is the JSON:\n{"answer":"test"}';
      expect(JsonAnswerStreamParser.sanitizeJson(input)).toBe('{"answer":"test"}');
    });

    it('strips trailing text after last }', () => {
      const input = '{"answer":"test"}\n\nSome trailing text';
      expect(JsonAnswerStreamParser.sanitizeJson(input)).toBe('{"answer":"test"}');
    });

    it('handles clean JSON unchanged', () => {
      const input = '{"answer":"clean","followUpQuestions":[]}';
      expect(JsonAnswerStreamParser.sanitizeJson(input)).toBe(input);
    });

    it('handles fences + preamble + trailer combo', () => {
      const input = 'Response:\n```json\n{"answer":"combo"}\n```\nDone!';
      const result = JsonAnswerStreamParser.sanitizeJson(input);
      expect(() => JSON.parse(result)).not.toThrow();
      expect(JSON.parse(result).answer).toBe('combo');
    });
  });
});

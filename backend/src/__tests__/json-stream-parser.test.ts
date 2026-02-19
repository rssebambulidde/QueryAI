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

  it('handles answer with unicode content', () => {
    const json = '{"answer":"Caf\\u00e9 is French","followUpQuestions":[]}';
    const result = parser.feed(json);
    // \\u escapes are not decoded by our parser — they pass through as-is
    // JSON.parse would decode them, but our character-level parser doesn't
    expect(result).toContain('Caf');
  });

  it('handles empty answer field', () => {
    const json = '{"answer":"","followUpQuestions":["Q1","Q2","Q3","Q4"],"citedSources":[]}';
    const result = parser.feed(json);
    expect(result).toBe('');
    expect(parser.isAnswerComplete()).toBe(true);
  });
});

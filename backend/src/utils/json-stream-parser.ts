/**
 * Incremental JSON Stream Parser
 *
 * Extracts the "answer" field value from a streaming JSON response
 * in real-time, yielding decoded characters as they arrive.
 *
 * The parser is designed for OpenAI structured-output streaming where
 * the model produces a JSON object like:
 *
 *   {"answer":"...text...","followUpQuestions":[...],"citedSources":[...]}
 *
 * It decodes JSON string escapes (\\n, \\", \\\\, etc.) on the fly so
 * the caller receives clean text suitable for display.
 */

type ParserState = 'seeking_answer' | 'in_answer' | 'after_answer';

export class JsonAnswerStreamParser {
  private accumulated = '';
  private state: ParserState = 'seeking_answer';
  private escapeNext = false;

  /**
   * Feed a new content-delta chunk from the OpenAI stream.
   * Returns answer text that should be forwarded to the client.
   */
  feed(delta: string): string {
    this.accumulated += delta;

    if (this.state === 'seeking_answer') {
      // Look for the opening of the answer string value: "answer": "
      const match = this.accumulated.match(/"answer"\s*:\s*"/);
      if (!match) return '';

      this.state = 'in_answer';
      const startIndex = match.index! + match[0].length;
      // Process any answer content already accumulated after the match
      return this.processAnswerChars(this.accumulated.substring(startIndex));
    }

    if (this.state === 'in_answer') {
      return this.processAnswerChars(delta);
    }

    // after_answer – accumulate silently
    return '';
  }

  /**
   * Return the full accumulated JSON string.
   * Call this after the stream has ended.
   */
  getAccumulatedJson(): string {
    return this.accumulated;
  }

  /**
   * Whether we have finished reading the answer field.
   */
  isAnswerComplete(): boolean {
    return this.state === 'after_answer';
  }

  // ── Internal ──────────────────────────────────────────────────────

  private processAnswerChars(chars: string): string {
    let output = '';

    for (const char of chars) {
      if (this.state !== 'in_answer') break;

      if (this.escapeNext) {
        this.escapeNext = false;
        output += this.unescapeChar(char);
        continue;
      }

      if (char === '\\') {
        this.escapeNext = true;
        continue;
      }

      if (char === '"') {
        // End of the answer string value
        this.state = 'after_answer';
        break;
      }

      output += char;
    }

    return output;
  }

  private unescapeChar(char: string): string {
    switch (char) {
      case 'n':
        return '\n';
      case 't':
        return '\t';
      case 'r':
        return '\r';
      case '"':
        return '"';
      case '\\':
        return '\\';
      case '/':
        return '/';
      case 'b':
        return '\b';
      case 'f':
        return '\f';
      default:
        // Unknown escape — return as-is
        return char;
    }
  }
}

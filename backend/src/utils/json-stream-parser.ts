/**
 * Incremental JSON Stream Parser
 *
 * Extracts the "answer" field value from a streaming JSON response
 * in real-time, yielding decoded characters as they arrive.
 *
 * Works with any LLM provider (OpenAI, Anthropic, Google, Groq).
 * The model produces a JSON object like:
 *
 *   {"answer":"...text...","followUpQuestions":[...],"citedSources":[...]}
 *
 * Provider-specific quirks handled:
 *  - Markdown code-fence wrapping (```json ... ```)  — common with
 *    Anthropic which uses prompt injection for JSON mode
 *  - Leading preamble text before the JSON object
 *  - \\uXXXX unicode escapes
 *  - Plain-text fallback when the provider ignores JSON instructions
 *
 * It decodes JSON string escapes (\\n, \\", \\\\, \\uXXXX, etc.) on
 * the fly so the caller receives clean text suitable for display.
 */

type ParserState = 'seeking_answer' | 'in_answer' | 'after_answer';

export class JsonAnswerStreamParser {
  private accumulated = '';
  private state: ParserState = 'seeking_answer';
  private escapeNext = false;
  /** Collects a 4-hex-digit \\uXXXX sequence while inside an escape. */
  private unicodeBuffer = '';
  private unicodeRemaining = 0;

  /**
   * Feed a new content-delta chunk from the LLM stream.
   * Returns answer text that should be forwarded to the client.
   */
  feed(delta: string): string {
    this.accumulated += delta;

    if (this.state === 'seeking_answer') {
      // Look for the opening of the answer string value: "answer": "
      // Works even if the JSON is preceded by markdown fences or preamble.
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
   * Return the full accumulated JSON string, sanitised for JSON.parse().
   *
   * Strips:
   *  - Leading/trailing whitespace
   *  - Markdown code fences (```json … ```)
   *  - Any preamble text before the first `{`
   *  - Any trailing text after the last `}`
   *
   * Call this after the stream has ended.
   */
  getAccumulatedJson(): string {
    return JsonAnswerStreamParser.sanitizeJson(this.accumulated);
  }

  /**
   * Return the raw un-sanitised accumulated text.
   * Useful for diagnostics or as plain-text fallback.
   */
  getRawAccumulated(): string {
    return this.accumulated;
  }

  /**
   * Whether we have finished reading the answer field.
   */
  isAnswerComplete(): boolean {
    return this.state === 'after_answer';
  }

  /**
   * Whether the parser ever found the "answer" key.
   * If false after the stream ends, the output was likely plain text
   * (not structured JSON) and the caller should use the raw text instead.
   */
  foundAnswerField(): boolean {
    return this.state !== 'seeking_answer';
  }

  // ── Static helpers ────────────────────────────────────────────────

  /**
   * Strip markdown fences, preamble, and trailing junk from a string
   * so that the result is parseable by JSON.parse().
   */
  static sanitizeJson(raw: string): string {
    let text = raw.trim();

    // Strip markdown code fences: ```json … ``` or ``` … ```
    // May appear at the very start/end of the accumulated text.
    text = text.replace(/^```(?:json|JSON)?\s*\n?/, '');
    text = text.replace(/\n?\s*```\s*$/, '');

    // Strip any preamble before the first '{' (e.g. "Here is the JSON:\n")
    const firstBrace = text.indexOf('{');
    if (firstBrace > 0) {
      text = text.substring(firstBrace);
    }

    // Strip any trailer after the last '}'
    const lastBrace = text.lastIndexOf('}');
    if (lastBrace >= 0 && lastBrace < text.length - 1) {
      text = text.substring(0, lastBrace + 1);
    }

    return text;
  }

  // ── Internal ──────────────────────────────────────────────────────

  private processAnswerChars(chars: string): string {
    let output = '';

    for (const char of chars) {
      if (this.state !== 'in_answer') break;

      // Accumulating a \\uXXXX hex sequence
      if (this.unicodeRemaining > 0) {
        this.unicodeBuffer += char;
        this.unicodeRemaining--;
        if (this.unicodeRemaining === 0) {
          const codePoint = parseInt(this.unicodeBuffer, 16);
          output += isNaN(codePoint) ? this.unicodeBuffer : String.fromCharCode(codePoint);
          this.unicodeBuffer = '';
        }
        continue;
      }

      if (this.escapeNext) {
        this.escapeNext = false;
        if (char === 'u') {
          // Start of \\uXXXX sequence — need 4 more hex digits
          this.unicodeRemaining = 4;
          this.unicodeBuffer = '';
          continue;
        }
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

import { openai } from '../config/openai';
import logger from '../config/logger';
import { RetryService } from './retry.service';
import { LatencyTrackerService, OperationType } from './latency-tracker.service';

/**
 * Response Processor Service
 * Handles citation extraction, follow-up question generation, answer quality scoring, and response formatting
 */
export class ResponseProcessorService {
  // Default model for follow-up generation
  private static readonly DEFAULT_MODEL = 'gpt-3.5-turbo';

  /** Refusal message when off-topic (pre-check or model refusal). */
  static getRefusalMessage(topicName: string): string {
    return `I'm currently in Research Topic Mode and limited to **${topicName}**. Your question seems outside this scope. You can ask about ${topicName} or disable research mode to ask anything.`;
  }

  /** Single meta follow-up for off-topic refusals. */
  static getRefusalFollowUp(topicName: string): string {
    return `Would you like to ask something about ${topicName}?`;
  }

  /**
   * Generate 2–4 follow-up questions from the latest Q&A when the main model omits them.
   * Used as a fallback so every response has follow-ups (research or not).
   * Note: Follow-up questions themselves are just questions, not answers, so they don't need source citations.
   * However, when these questions are asked and answered, those answers MUST include source citations.
   */
  static async generateFollowUpQuestions(question: string, answer: string, topicName?: string): Promise<string[]> {
    // Track latency for follow-up generation
    return await LatencyTrackerService.trackOperation(
      OperationType.AI_FOLLOW_UP_GENERATION,
      async () => {
        return await this.generateFollowUpQuestionsInternal(question, answer, topicName);
      }
    );
  }

  /**
   * Internal method for generating follow-up questions
   */
  private static async generateFollowUpQuestionsInternal(question: string, answer: string, topicName?: string): Promise<string[]> {
    const ans = answer.length > 1500 ? answer.slice(0, 1500) + '...' : answer;
    const prompt = `Based on this exchange, generate exactly 4 short follow-up questions.

User asked: ${question}

Assistant answered: ${ans}
${topicName ? `\nKeep all questions clearly within the research topic: "${topicName}".` : ''}

IMPORTANT: These are questions only. When these questions are answered later, those answers MUST include inline source hyperlinks for every piece of information, as per the citation requirements.

Output only the 4 questions, one per line. No numbering or bullets. Each must be a complete question and derived from the specific content above.`;
    try {
      // Use retry service for follow-up question generation
      const retryResult = await RetryService.execute(
        async () => {
          return await openai.chat.completions.create({
            model: this.DEFAULT_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5,
            max_tokens: 300,
          });
        },
        {
          maxRetries: 2,
          initialDelay: 500,
          multiplier: 2,
          maxDelay: 5000,
        }
      );

      const c = retryResult.result;
      const text = c.choices[0]?.message?.content || '';
      const lines = text.split('\n').map((l) => l.replace(/^\s*[-*•]?\s*\d*\.?\s*/, '').trim()).filter((l) => l.length > 5 && l.length < 200);
      return lines.slice(0, 4);
    } catch (err: any) {
      logger.warn('Failed to generate follow-up questions fallback', { error: err?.message });
      return [];
    }
  }

  /**
   * Extract follow-up questions from response using multiple patterns
   * Returns array of 0-4 questions
   */
  static extractFollowUpQuestions(responseText: string, topicName?: string): string[] {
    let followUpQuestions: string[] = [];

    // Look for FOLLOW_UP_QUESTIONS section (lenient: Follow-up questions, bullets - * • -)
    let followUpMatch = responseText.match(/(?:FOLLOW_UP_QUESTIONS|Follow[- ]?up questions?):\s*\n((?:[-*•]\s+[^\n]+\n?)+)/i);

    if (followUpMatch) {
      const questionsText = followUpMatch[1];
      followUpQuestions = questionsText
        .split('\n')
        .map(line => line.replace(/^[-*•]\s+/, '').trim())
        .filter(q => q.length > 0)
        .slice(0, 4);

      // If we got fewer than 4 questions, try alternative patterns to fill remaining slots
      if (followUpQuestions.length < 4) {
        const altMatch = responseText.match(/(?:follow.?up|suggested|related)\s+questions?:?\s*\n((?:[-•*]\s+[^\n]+\n?)+)/i);
        if (altMatch) {
          const altQuestions = altMatch[1]
            .split('\n')
            .map(line => line.replace(/^[-•*]\s+/, '').trim())
            .filter(q => q.length > 0);
          followUpQuestions = [...followUpQuestions, ...altQuestions].slice(0, 4);
        }
      }
    } else {
      // Fallback: 1–4 bullet lines at end (model sometimes varies format on 2nd+ turns / research mode)
      const tail = responseText.slice(-700);
      const bulletLines = tail.split(/\n/).filter(l => /^\s*[-*•]\s+.{10,}/.test(l));

      if (bulletLines.length >= 1 && bulletLines.length <= 6) {
        followUpQuestions = bulletLines
          .map(l => l.replace(/^\s*[-*•]\s+/, '').trim())
          .filter(q => q.length > 5 && q.length < 200)
          .slice(0, 4);
      }
    }

    return followUpQuestions;
  }

  /**
   * Process follow-up questions from response: extract and generate if needed
   * Returns object with questions array and answer text (with follow-ups removed)
   */
  static async processFollowUpQuestions(
    responseText: string,
    userQuestion: string,
    topicName?: string
  ): Promise<{ questions: string[]; answer: string }> {
    // Extract follow-up questions
    let followUpQuestions = this.extractFollowUpQuestions(responseText, topicName);

    // Find where follow-ups start in the response to extract clean answer
    let answer = responseText;

    // Look for FOLLOW_UP_QUESTIONS section
    const followUpMatch = responseText.match(/(?:FOLLOW_UP_QUESTIONS|Follow[- ]?up questions?):\s*\n/i);
    if (followUpMatch && followUpMatch.index !== undefined) {
      answer = responseText.substring(0, followUpMatch.index).trim();
    } else if (followUpQuestions.length > 0) {
      // If we extracted from bullet lines at end, try to find where they start
      const tail = responseText.slice(-700);
      const bulletLines = tail.split(/\n/).filter(l => /^\s*[-*•]\s+.{10,}/.test(l));
      if (bulletLines.length >= 1) {
        const idx = tail.indexOf(bulletLines[0]);
        if (idx >= 0) {
          const start = Math.max(0, responseText.length - 700 + idx);
          answer = responseText.substring(0, start).trim();
        }
      }
    }

    // Mandatory follow-ups: if still none, generate from latest Q&A (research or not)
    if ((!followUpQuestions || followUpQuestions.length === 0) && answer) {
      const generated = await this.generateFollowUpQuestions(userQuestion, answer, topicName);
      if (generated.length > 0) {
        followUpQuestions = generated;
      }
    }

    return {
      questions: followUpQuestions,
      answer: answer,
    };
  }

  /**
   * Strip follow-up questions section from answer text
   */
  static stripFollowUpQuestionsFromAnswer(responseText: string): string {
    // Remove FOLLOW_UP_QUESTIONS section and everything after it
    return responseText.replace(/\n\s*FOLLOW[_-]?UP[_-]?QUESTIONS?:[\s\S]*$/i, '').trim();
  }

  /**
   * Parse inline citations from response text
   * This is a helper method that can be used for citation extraction
   * Returns array of citation objects with positions
   */
  static parseInlineCitations(text: string): Array<{ text: string; url: string; start: number; end: number }> {
    const citations: Array<{ text: string; url: string; start: number; end: number }> = [];

    // Match markdown links [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      citations.push({
        text: match[1],
        url: match[2],
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    return citations;
  }

  /**
   * Format sources for display
   * Converts source objects to display-friendly format
   */
  static formatSourcesForDisplay(sources: Array<{ type: string; title: string; url?: string; documentId?: string; snippet?: string; score?: number }>): string {
    if (!sources || sources.length === 0) {
      return 'No sources available';
    }

    return sources.map((source, index) => {
      const sourceNum = index + 1;
      const typeLabel = source.type === 'document' ? 'Document' : 'Web';
      const location = source.url || (source.documentId ? `document://${source.documentId}` : 'N/A');

      return `[${typeLabel} Source ${sourceNum}] ${source.title}\n${location}${source.snippet ? `\nSnippet: ${source.snippet.substring(0, 150)}...` : ''}`;
    }).join('\n\n');
  }

  /**
   * Calculate answer quality score based on various metrics
   * Returns a score between 0 and 1
   */
  static calculateAnswerQualityScore(answer: string, citations: any[], followUpQuestions: string[]): number {
    let score = 0;
    const maxScore = 100;

    // Length check (20 points) - ideal answer is 200-1000 characters
    const length = answer.length;
    if (length >= 200 && length <= 1000) {
      score += 20;
    } else if (length >= 100 && length < 200) {
      score += 15;
    } else if (length > 1000 && length <= 1500) {
      score += 15;
    } else if (length > 50 && length < 100) {
      score += 10;
    }

    // Citation check (30 points) - has citations
    if (citations && citations.length > 0) {
      score += Math.min(30, citations.length * 10); // Up to 3 citations for full points
    }

    // Follow-up questions check (20 points) - has 4 follow-ups
    if (followUpQuestions && followUpQuestions.length === 4) {
      score += 20;
    } else if (followUpQuestions && followUpQuestions.length > 0) {
      score += Math.min(15, followUpQuestions.length * 5);
    }

    // Structure check (15 points) - has paragraphs
    const paragraphs = answer.split('\n\n').filter(p => p.trim().length > 20);
    if (paragraphs.length >= 3 && paragraphs.length <= 5) {
      score += 15;
    } else if (paragraphs.length >= 2) {
      score += 10;
    }

    // Formatting check (15 points) - uses markdown formatting
    const hasFormatting = /\*\*[^*]+\*\*/.test(answer) || /\[[^\]]+\]\([^)]+\)/.test(answer);
    if (hasFormatting) {
      score += 15;
    }

    return Math.min(1, score / maxScore);
  }

  /**
   * Validate response format
   * Checks if response meets formatting requirements
   */
  static validateResponseFormat(answer: string, citations: any[]): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check minimum length
    if (answer.length < 50) {
      errors.push('Answer is too short (minimum 50 characters)');
    }

    // Check maximum length
    if (answer.length > 3000) {
      warnings.push('Answer is quite long (over 3000 characters)');
    }

    // Check for citations
    if (!citations || citations.length === 0) {
      errors.push('No citations found in answer');
    }

    // Check for paragraph structure
    const paragraphs = answer.split('\n\n').filter(p => p.trim().length > 0);
    if (paragraphs.length < 2) {
      warnings.push('Answer should have multiple paragraphs for better readability');
    }

    // Check for inline links
    const hasInlineLinks = /\[[^\]]+\]\([^)]+\)/.test(answer);
    if (!hasInlineLinks) {
      errors.push('No inline citations found - all information must be cited');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

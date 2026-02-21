/**
 * AI Generation Service
 *
 * Standalone LLM generation tasks that don't go through the full
 * RAG → answer pipeline:
 *   - Research session summaries
 *   - Suggested starter questions
 *   - Response summarization
 *   - Essay writing
 *   - Detailed report generation
 *
 * Extracted from ai.service.ts to keep the main service focused on
 * the core question-answering pipeline.
 */

import { ProviderRegistry } from '../providers/provider-registry';
import logger from '../config/logger';
import { AppError } from '../types/error';
import { RetryService } from './retry.service';

import type { Source } from './ai.service';

// Default model for standalone generation tasks
const DEFAULT_MODEL = 'gpt-3.5-turbo';
const DEFAULT_TEMPERATURE = 0.7;

export class AIGenerationService {
  /**
   * Generate a research session summary from a conversation (7.1).
   * Loads messages, filters out refusals, and produces a short report for the topic.
   */
  static async generateResearchSessionSummary(
    conversationId: string,
    userId: string,
    topicName: string
  ): Promise<string> {
    const { MessageService } = await import('./message.service');
    const messages = await MessageService.getMessages(conversationId, userId, { limit: 50 });
    const refusalPattern = /outside|limited to|disable research mode|research (mode|topic)/i;
    const blocks: string[] = [];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.role === 'user') {
        blocks.push(`Q: ${(m.content || '').replace(/FOLLOW_UP_QUESTIONS:[\s\S]*$/i, '').trim()}`);
      } else if (m.role === 'assistant') {
        const content = (m.content || '').replace(/FOLLOW_UP_QUESTIONS:[\s\S]*$/i, '').trim();
        if (content.length < 80 && refusalPattern.test(content)) continue;
        blocks.push(`A: ${content}`);
      }
    }
    const qaText = blocks.join('\n\n');
    if (!qaText || qaText.length < 50) {
      return 'Not enough on-topic Q&A in this conversation to generate a summary.';
    }
    const prompt = `You are a research assistant. Create a short **Research Session Summary** for the topic "${topicName}" based on the following Q&A from a conversation.

Format as markdown with 2-4 short sections (e.g. ## Key findings, ## Main topics covered, ## Takeaways). Keep it concise (about 1-2 paragraphs or 5-10 bullet points total). Do not add information beyond what is in the Q&A.

Q&A:
${qaText.slice(-6000)}

Research Session Summary:`;
    try {
      const retryResult = await RetryService.execute(
        async () => {
          const { provider, model: providerModel } = ProviderRegistry.getForMode('chat');
          return await provider.chatCompletion({
            model: providerModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.4,
            maxTokens: 800,
          });
        },
        {
          maxRetries: 2,
          initialDelay: 1000,
          multiplier: 2,
          maxDelay: 10000,
        }
      );

      const completion = retryResult.result;
      return completion.content || 'Summary could not be generated.';
    } catch (err: any) {
      logger.error('Error generating research session summary:', err);
      throw new AppError('Failed to generate research session summary', 500, 'RESEARCH_SUMMARY_ERROR');
    }
  }

  /**
   * Generate 4 dynamic, AI-generated starter questions for a research topic (6.1).
   */
  static async generateSuggestedStarters(topicId: string, userId: string): Promise<string[]> {
    const { TopicService } = await import('./topic.service');
    const topic = await TopicService.getTopic(topicId, userId);
    if (!topic) {
      throw new AppError('Topic not found', 404, 'TOPIC_NOT_FOUND');
    }
    const name = topic.name;
    const desc = (topic.description || '').trim();
    const prompt = `You are a research assistant. Given this research topic:

Name: ${name}
${desc ? `Description: ${desc}` : ''}

Generate exactly 4 short, specific question starters that would help a user explore this topic. Each must be:
- A complete question
- Clearly on-topic and in line with "${name}"
- Suitable as the first or an early message in a research chat
- Specific (not generic like "What is X?")

IMPORTANT: These are questions only. When these questions are answered later, those answers MUST include inline source hyperlinks for every piece of information, as per the citation requirements.

Output only the 4 questions, one per line. No numbering, bullets, or extra text.`;
    try {
      const retryResult = await RetryService.execute(
        async () => {
          const { provider, model: providerModel } = ProviderRegistry.getForMode('chat');
          return await provider.chatCompletion({
            model: providerModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.6,
            maxTokens: 400,
          });
        },
        {
          maxRetries: 2,
          initialDelay: 500,
          multiplier: 2,
          maxDelay: 5000,
        }
      );

      const completion = retryResult.result;
      const text = completion.content || '';
      const lines = text.split('\n').map((l) => l.replace(/^\s*[-*•]?\s*\d*\.?\s*/, '').trim()).filter((l) => l.length > 5 && l.length < 200);
      return lines.slice(0, 4);
    } catch (err: any) {
      logger.error('Error generating suggested starters:', err);
      throw new AppError('Failed to generate suggested starters', 500, 'SUGGESTED_STARTERS_ERROR');
    }
  }

  /**
   * Generate a summary of a previous AI response.
   */
  static async summarizeResponse(
    originalResponse: string,
    keyword: string,
    sources?: Source[]
  ): Promise<string> {
    const prompt = `You are a helpful assistant. Create a concise summary of the following AI response about "${keyword}".

Original Response:
${originalResponse}

${sources && sources.length > 0 ? `Sources used: ${sources.map(s => s.title).join(', ')}` : ''}

Instructions:
- Create a short paragraph (3-5 sentences) or bullet points summarizing the key points
- Use the keyword "${keyword}" naturally in the summary
- Do not add new information beyond what's in the original response
- Keep it concise and focused on the main ideas
- Format as plain text (no markdown formatting needed)

Summary:`;

    try {
      const retryResult = await RetryService.execute(
        async () => {
          const { provider, model: providerModel } = ProviderRegistry.getForMode('chat');
          return await provider.chatCompletion({
            model: providerModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: DEFAULT_TEMPERATURE,
            maxTokens: 300,
          });
        },
        {
          maxRetries: 2,
          initialDelay: 1000,
          multiplier: 2,
          maxDelay: 10000,
        }
      );

      const completion = retryResult.result;
      return completion.content || 'Summary could not be generated.';
    } catch (error: any) {
      logger.error('Error generating summary:', error);
      throw new AppError('Failed to generate summary', 500, 'SUMMARY_ERROR');
    }
  }

  /**
   * Generate a formal essay based on a previous AI response.
   */
  static async writeEssay(
    originalResponse: string,
    keyword: string,
    sources?: Source[]
  ): Promise<string> {
    const prompt = `You are a professional writer. Create a formal essay based on the following AI response about "${keyword}".

Original Response:
${originalResponse}

${sources && sources.length > 0 ? `Sources used: ${sources.map(s => s.title).join(', ')}` : ''}

Instructions:
- Create a professional essay with proper structure
- Use formal tone throughout
- Use the keyword "${keyword}" naturally throughout the essay
- Structure MUST include:
  1. A clear title (use ## Title format)
  2. An introduction paragraph (start naturally, do NOT label it "Introduction:")
  3. Body paragraphs (2-3 paragraphs developing the main ideas - do NOT label them "Body:" or "Main Section:")
  4. A conclusion paragraph (end naturally, do NOT label it "Conclusion:")
- DO NOT use explicit section labels like "Introduction:", "Body:", "Main Section:", "Conclusion:"
- Write as a continuous, flowing essay where sections flow naturally into each other
- Use markdown formatting: ## for title, regular paragraphs for content
- Expand on the ideas from the original response in a structured, academic style
- Make it read naturally while maintaining clear structure

Essay:`;

    try {
      const retryResult = await RetryService.execute(
        async () => {
          const { provider, model: providerModel } = ProviderRegistry.getForMode('chat');
          return await provider.chatCompletion({
            model: providerModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: DEFAULT_TEMPERATURE,
            maxTokens: 1500,
          });
        },
        {
          maxRetries: 3,
          initialDelay: 1000,
          multiplier: 2,
          maxDelay: 30000,
        }
      );

      const completion = retryResult.result;
      return completion.content || 'Essay could not be generated.';
    } catch (error: any) {
      logger.error('Error generating essay:', error);
      throw new AppError('Failed to generate essay', 500, 'ESSAY_ERROR');
    }
  }

  /**
   * Generate a detailed report based on a previous AI response.
   */
  static async generateDetailedReport(
    originalResponse: string,
    keyword: string,
    sources?: Source[]
  ): Promise<string> {
    const prompt = `You are a research analyst. Create a comprehensive, structured report based on the following AI response about "${keyword}".

Original Response:
${originalResponse}

${sources && sources.length > 0 ? `Sources used: ${sources.map(s => s.title).join(', ')}` : ''}

Instructions:
- Create an in-depth, comprehensive report with proper structure
- Use formal, professional language
- Use the keyword "${keyword}" naturally throughout
- Structure MUST include:
  1. A clear title (use ## Title format)
  2. An introduction section (start naturally, do NOT label it "Introduction:")
  3. Multiple main sections (3-4 sections with clear topics - do NOT label them "Body:" or "Main Section:")
  4. A conclusion section (end naturally, do NOT label it "Conclusion:")
- DO NOT use explicit section labels like "Introduction:", "Body:", "Main Section:", "Conclusion:", "Executive Summary:"
- Use markdown formatting: ## for title, ### for main section headings, regular paragraphs for content
- Each main section should have a descriptive heading (e.g., "## Key Features" not "## Main Section")
- Write as a continuous, flowing report where sections flow naturally into each other
- Expand significantly on the original response with detailed explanations, implications, and analysis
- Make it comprehensive and research-grade while reading naturally

Report:`;

    try {
      const retryResult = await RetryService.execute(
        async () => {
          const { provider, model: providerModel } = ProviderRegistry.getForMode('chat');
          return await provider.chatCompletion({
            model: providerModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: DEFAULT_TEMPERATURE,
            maxTokens: 2500,
          });
        },
        {
          maxRetries: 3,
          initialDelay: 1000,
          multiplier: 2,
          maxDelay: 30000,
        }
      );

      const completion = retryResult.result;
      return completion.content || 'Report could not be generated.';
    } catch (error: any) {
      logger.error('Error generating detailed report:', error);
      throw new AppError('Failed to generate detailed report', 500, 'REPORT_ERROR');
    }
  }

  // ── Streaming variants ─────────────────────────────────────────────

  /**
   * Streaming summary generator — yields text chunks as they arrive from OpenAI.
   */
  static async *summarizeResponseStream(
    originalResponse: string,
    keyword: string,
    sources?: Source[]
  ): AsyncGenerator<string, void, unknown> {
    const prompt = `You are a helpful assistant. Create a concise summary of the following AI response about "${keyword}".

Original Response:
${originalResponse}

${sources && sources.length > 0 ? `Sources used: ${sources.map(s => s.title).join(', ')}` : ''}

Instructions:
- Create a short paragraph (3-5 sentences) or bullet points summarizing the key points
- Use the keyword "${keyword}" naturally in the summary
- Do not add new information beyond what's in the original response
- Keep it concise and focused on the main ideas
- Format as plain text (no markdown formatting needed)

Summary:`;

    yield* this._streamCompletion(prompt, 300, 'SUMMARY_STREAM_ERROR');
  }

  /**
   * Streaming essay generator — yields text chunks as they arrive from OpenAI.
   */
  static async *writeEssayStream(
    originalResponse: string,
    keyword: string,
    sources?: Source[]
  ): AsyncGenerator<string, void, unknown> {
    const prompt = `You are a professional writer. Create a formal essay based on the following AI response about "${keyword}".

Original Response:
${originalResponse}

${sources && sources.length > 0 ? `Sources used: ${sources.map(s => s.title).join(', ')}` : ''}

Instructions:
- Create a professional essay with proper structure
- Use formal tone throughout
- Use the keyword "${keyword}" naturally throughout the essay
- Structure MUST include:
  1. A clear title (use ## Title format)
  2. An introduction paragraph (start naturally, do NOT label it "Introduction:")
  3. Body paragraphs (2-3 paragraphs developing the main ideas - do NOT label them "Body:" or "Main Section:")
  4. A conclusion paragraph (end naturally, do NOT label it "Conclusion:")
- DO NOT use explicit section labels like "Introduction:", "Body:", "Main Section:", "Conclusion:"
- Write as a continuous, flowing essay where sections flow naturally into each other
- Use markdown formatting: ## for title, regular paragraphs for content
- Expand on the ideas from the original response in a structured, academic style
- Make it read naturally while maintaining clear structure

Essay:`;

    yield* this._streamCompletion(prompt, 1500, 'ESSAY_STREAM_ERROR');
  }

  /**
   * Streaming report generator — yields text chunks as they arrive from OpenAI.
   */
  static async *generateDetailedReportStream(
    originalResponse: string,
    keyword: string,
    sources?: Source[]
  ): AsyncGenerator<string, void, unknown> {
    const prompt = `You are a research analyst. Create a comprehensive, structured report based on the following AI response about "${keyword}".

Original Response:
${originalResponse}

${sources && sources.length > 0 ? `Sources used: ${sources.map(s => s.title).join(', ')}` : ''}

Instructions:
- Create an in-depth, comprehensive report with proper structure
- Use formal, professional language
- Use the keyword "${keyword}" naturally throughout
- Structure MUST include:
  1. A clear title (use ## Title format)
  2. An introduction section (start naturally, do NOT label it "Introduction:")
  3. Multiple main sections (3-4 sections with clear topics - do NOT label them "Body:" or "Main Section:")
  4. A conclusion section (end naturally, do NOT label it "Conclusion:")
- DO NOT use explicit section labels like "Introduction:", "Body:", "Main Section:", "Conclusion:", "Executive Summary:"
- Use markdown formatting: ## for title, ### for main section headings, regular paragraphs for content
- Each main section should have a descriptive heading (e.g., "## Key Features" not "## Main Section")
- Write as a continuous, flowing report where sections flow naturally into each other
- Expand significantly on the original response with detailed explanations, implications, and analysis
- Make it comprehensive and research-grade while reading naturally

Report:`;

    yield* this._streamCompletion(prompt, 2500, 'REPORT_STREAM_ERROR');
  }

  /**
   * Internal helper: creates an OpenAI streaming completion and yields text chunks.
   */
  private static async *_streamCompletion(
    prompt: string,
    maxTokens: number,
    errorCode: string
  ): AsyncGenerator<string, void, unknown> {
    try {
      const { provider, model: providerModel } = ProviderRegistry.getForMode('chat');
      const stream = provider.chatCompletionStream({
        model: providerModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: DEFAULT_TEMPERATURE,
        maxTokens: maxTokens,
      });

      for await (const content of stream) {
        yield content;
      }
    } catch (error: any) {
      logger.error(`Streaming generation error [${errorCode}]:`, error);
      throw new AppError(`Streaming generation failed`, 500, errorCode);
    }
  }
}

/**
 * Conversation State Tracking Service
 * Tracks conversation topics and entities to improve context
 */

import { supabaseAdmin } from '../config/database';
import { Database } from '../types/database';
import { openai } from '../config/openai';
import logger from '../config/logger';
import { AppError } from '../types/error';
import { TokenCountService } from './token-count.service';

/**
 * Conversation state structure
 */
export interface ConversationState {
  topics: string[]; // Main topics discussed
  entities: Entity[]; // Named entities (people, places, organizations, etc.)
  keyConcepts: string[]; // Key concepts or terms
  lastUpdated: string; // ISO timestamp of last update
  messageCount: number; // Number of messages analyzed
}

/**
 * Entity information
 */
export interface Entity {
  name: string; // Entity name
  type: 'person' | 'organization' | 'location' | 'product' | 'concept' | 'other'; // Entity type
  mentions: number; // Number of times mentioned
  firstMentioned?: string; // ISO timestamp of first mention
  context?: string; // Brief context about the entity
}

/**
 * State tracking options
 */
export interface StateTrackingOptions {
  enableTopicExtraction?: boolean; // Extract topics (default: true)
  enableEntityExtraction?: boolean; // Extract entities (default: true)
  enableConceptExtraction?: boolean; // Extract key concepts (default: true)
  model?: string; // Model for extraction (default: 'gpt-3.5-turbo')
  maxMessagesToAnalyze?: number; // Maximum messages to analyze at once (default: 50)
  updateThreshold?: number; // Update state after N new messages (default: 5)
  maxExtractionTimeMs?: number; // Maximum time for extraction (default: 3000ms)
}

/**
 * Default state tracking options
 */
const DEFAULT_STATE_OPTIONS: Required<StateTrackingOptions> = {
  enableTopicExtraction: true,
  enableEntityExtraction: true,
  enableConceptExtraction: true,
  model: 'gpt-3.5-turbo',
  maxMessagesToAnalyze: 50,
  updateThreshold: 5,
  maxExtractionTimeMs: 3000,
};

/**
 * Conversation State Tracking Service
 */
export class ConversationStateService {
  /**
   * Extract state from conversation messages
   */
  static async extractState(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    options: StateTrackingOptions = {}
  ): Promise<ConversationState> {
    const opts = { ...DEFAULT_STATE_OPTIONS, ...options };
    const startTime = Date.now();

    try {
      // Limit messages to analyze
      const messagesToAnalyze = messages.slice(-opts.maxMessagesToAnalyze);

      // Build conversation text
      const conversationText = messagesToAnalyze
        .map(msg => {
          const role = msg.role === 'user' ? 'User' : 'Assistant';
          // Remove citations for cleaner analysis
          const content = msg.content
            .replace(/\[.*?\]\(.*?\)/g, '')
            .replace(/\[Document \d+\]/g, '')
            .replace(/\[Web Source \d+\]/g, '')
            .trim();
          return `${role}: ${content}`;
        })
        .join('\n\n');

      if (!conversationText.trim()) {
        return this.getEmptyState();
      }

      // Build extraction prompt
      const extractionPrompt = this.buildExtractionPrompt(conversationText, opts);

      // Count tokens
      const encodingType = TokenCountService.getEncodingForModel(opts.model);
      const promptTokens = TokenCountService.countTokens(extractionPrompt, encodingType);

      if (promptTokens > 8000) {
        logger.warn('Conversation too long for state extraction, truncating', {
          promptTokens,
          messageCount: messagesToAnalyze.length,
        });
        // Truncate conversation text
        const truncatedText = this.truncateToTokenBudget(conversationText, 6000, encodingType);
        const truncatedPrompt = this.buildExtractionPrompt(truncatedText, opts);
        
        return await this.callExtractionAPI(truncatedPrompt, opts, startTime);
      }

      return await this.callExtractionAPI(extractionPrompt, opts, startTime);
    } catch (error: any) {
      logger.error('Error extracting conversation state', {
        error: error.message,
        messageCount: messages.length,
      });
      
      // Return empty state on error
      return this.getEmptyState();
    }
  }

  /**
   * Build extraction prompt
   */
  private static buildExtractionPrompt(
    conversationText: string,
    options: Required<StateTrackingOptions>
  ): string {
    const parts: string[] = [];

    parts.push('Analyze the following conversation and extract structured information.');
    parts.push('Return a JSON object with the following structure:');
    parts.push('');

    if (options.enableTopicExtraction) {
      parts.push('- "topics": Array of main topics discussed (max 10, most important first)');
    }

    if (options.enableEntityExtraction) {
      parts.push('- "entities": Array of objects with:');
      parts.push('  - "name": Entity name');
      parts.push('  - "type": One of: person, organization, location, product, concept, other');
      parts.push('  - "mentions": Number of times mentioned');
      parts.push('  - "context": Brief context (1-2 sentences)');
    }

    if (options.enableConceptExtraction) {
      parts.push('- "keyConcepts": Array of key concepts or important terms (max 15)');
    }

    parts.push('');
    parts.push('Conversation:');
    parts.push(conversationText);
    parts.push('');
    parts.push('Return only valid JSON, no additional text.');

    return parts.join('\n');
  }

  /**
   * Call extraction API
   */
  private static async callExtractionAPI(
    prompt: string,
    options: Required<StateTrackingOptions>,
    startTime: number
  ): Promise<ConversationState> {
    try {
      const response = await Promise.race([
        openai.chat.completions.create({
          model: options.model,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that extracts structured information from conversations. Always return valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 1000,
          response_format: { type: 'json_object' },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Extraction timeout')), options.maxExtractionTimeMs)
        ),
      ]);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in API response');
      }

      // Parse JSON response
      const extracted = JSON.parse(content);

      // Build state object
      const state: ConversationState = {
        topics: extracted.topics || [],
        entities: (extracted.entities || []).map((e: any) => ({
          name: e.name || '',
          type: e.type || 'other',
          mentions: e.mentions || 1,
          context: e.context,
        })),
        keyConcepts: extracted.keyConcepts || [],
        lastUpdated: new Date().toISOString(),
        messageCount: 0, // Will be set by caller
      };

      // Validate and clean state
      this.validateState(state);

      logger.info('Conversation state extracted', {
        topicsCount: state.topics.length,
        entitiesCount: state.entities.length,
        conceptsCount: state.keyConcepts.length,
        processingTimeMs: Date.now() - startTime,
      });

      return state;
    } catch (error: any) {
      if (error.message === 'Extraction timeout') {
        logger.warn('State extraction timeout, returning empty state', {
          timeoutMs: options.maxExtractionTimeMs,
        });
      } else {
        logger.error('Error calling extraction API', {
          error: error.message,
        });
      }
      
      return this.getEmptyState();
    }
  }

  /**
   * Validate and clean state
   */
  private static validateState(state: ConversationState): void {
    // Limit array sizes
    state.topics = state.topics.slice(0, 10);
    state.entities = state.entities.slice(0, 20);
    state.keyConcepts = state.keyConcepts.slice(0, 15);

    // Validate entity types
    const validTypes = ['person', 'organization', 'location', 'product', 'concept', 'other'];
    state.entities = state.entities.filter(e => validTypes.includes(e.type));

    // Remove empty values
    state.topics = state.topics.filter(t => t && t.trim().length > 0);
    state.keyConcepts = state.keyConcepts.filter(c => c && c.trim().length > 0);
    state.entities = state.entities.filter(e => e.name && e.name.trim().length > 0);
  }

  /**
   * Get empty state
   */
  private static getEmptyState(): ConversationState {
    return {
      topics: [],
      entities: [],
      keyConcepts: [],
      lastUpdated: new Date().toISOString(),
      messageCount: 0,
    };
  }

  /**
   * Truncate text to token budget
   */
  private static truncateToTokenBudget(
    text: string,
    maxTokens: number,
    encodingType: string
  ): string {
    const tokens = TokenCountService.countTokens(text, encodingType);
    
    if (tokens <= maxTokens) {
      return text;
    }

    // Binary search for truncation point
    let left = 0;
    let right = text.length;
    let bestLength = 0;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const truncated = text.substring(0, mid);
      const truncatedTokens = TokenCountService.countTokens(truncated, encodingType);

      if (truncatedTokens <= maxTokens) {
        bestLength = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return text.substring(0, bestLength) + '...';
  }

  /**
   * Get conversation state from database
   */
  static async getState(
    conversationId: string,
    userId: string
  ): Promise<ConversationState | null> {
    try {
      const { data: conversation, error } = await supabaseAdmin
        .from('conversations')
        .select('metadata')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Conversation not found
        }
        logger.error('Error fetching conversation state', { error: error.message });
        throw new AppError('Failed to fetch conversation state', 500, 'STATE_FETCH_ERROR');
      }

      if (!conversation || !conversation.metadata) {
        return null;
      }

      const state = conversation.metadata.state as ConversationState;
      if (!state) {
        return null;
      }

      return state;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error fetching conversation state', { error });
      throw new AppError('Failed to fetch conversation state', 500, 'STATE_FETCH_ERROR');
    }
  }

  /**
   * Update conversation state in database
   */
  static async updateState(
    conversationId: string,
    userId: string,
    state: ConversationState
  ): Promise<void> {
    try {
      // Get current metadata
      const { data: conversation, error: fetchError } = await supabaseAdmin
        .from('conversations')
        .select('metadata')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single();

      if (fetchError) {
        logger.error('Error fetching conversation for state update', { error: fetchError.message });
        throw new AppError('Failed to update conversation state', 500, 'STATE_UPDATE_ERROR');
      }

      // Merge state into metadata
      const currentMetadata = conversation.metadata || {};
      const updatedMetadata = {
        ...currentMetadata,
        state,
        stateLastUpdated: new Date().toISOString(),
      };

      // Update conversation
      const { error: updateError } = await supabaseAdmin
        .from('conversations')
        .update({ metadata: updatedMetadata })
        .eq('id', conversationId)
        .eq('user_id', userId);

      if (updateError) {
        logger.error('Error updating conversation state', { error: updateError.message });
        throw new AppError('Failed to update conversation state', 500, 'STATE_UPDATE_ERROR');
      }

      logger.info('Conversation state updated', {
        conversationId,
        topicsCount: state.topics.length,
        entitiesCount: state.entities.length,
        conceptsCount: state.keyConcepts.length,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error updating conversation state', { error });
      throw new AppError('Failed to update conversation state', 500, 'STATE_UPDATE_ERROR');
    }
  }

  /**
   * Merge new state with existing state
   */
  static mergeStates(
    existing: ConversationState | null,
    newState: ConversationState
  ): ConversationState {
    if (!existing) {
      return newState;
    }

    // Merge topics (deduplicate, prioritize new)
    const topicSet = new Set([...newState.topics, ...existing.topics]);
    const mergedTopics = Array.from(topicSet).slice(0, 10);

    // Merge entities (combine mentions, update context)
    const entityMap = new Map<string, Entity>();
    
    // Add existing entities
    existing.entities.forEach(e => {
      entityMap.set(e.name.toLowerCase(), { ...e });
    });

    // Merge new entities
    newState.entities.forEach(e => {
      const key = e.name.toLowerCase();
      const existing = entityMap.get(key);
      
      if (existing) {
        // Merge: combine mentions, update context if new is more recent
        existing.mentions += e.mentions;
        if (e.context && (!existing.context || e.context.length > existing.context.length)) {
          existing.context = e.context;
        }
      } else {
        entityMap.set(key, { ...e });
      }
    });

    const mergedEntities = Array.from(entityMap.values())
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 20);

    // Merge key concepts (deduplicate)
    const conceptSet = new Set([...newState.keyConcepts, ...existing.keyConcepts]);
    const mergedConcepts = Array.from(conceptSet).slice(0, 15);

    return {
      topics: mergedTopics,
      entities: mergedEntities,
      keyConcepts: mergedConcepts,
      lastUpdated: newState.lastUpdated,
      messageCount: newState.messageCount,
    };
  }

  /**
   * Format state for context inclusion
   */
  static formatStateForContext(state: ConversationState): string {
    const parts: string[] = [];

    if (state.topics.length > 0) {
      parts.push('**Topics discussed:**');
      parts.push(state.topics.map(t => `- ${t}`).join('\n'));
      parts.push('');
    }

    if (state.entities.length > 0) {
      parts.push('**Key entities:**');
      state.entities.slice(0, 10).forEach(e => {
        const context = e.context ? ` (${e.context})` : '';
        parts.push(`- ${e.name} (${e.type})${context}`);
      });
      parts.push('');
    }

    if (state.keyConcepts.length > 0) {
      parts.push('**Key concepts:**');
      parts.push(state.keyConcepts.slice(0, 10).map(c => `- ${c}`).join('\n'));
    }

    return parts.join('\n');
  }
}

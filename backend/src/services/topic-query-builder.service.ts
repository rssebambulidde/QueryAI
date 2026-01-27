/**
 * Topic Query Builder Service
 * Enhances search queries with topic-aware construction
 * Uses topic as context, not just prefix
 */

import { QueryOptimizerService, QuestionType } from './query-optimizer.service';
import logger from '../config/logger';

export interface TopicQueryOptions {
  useTopicAsContext?: boolean; // Use topic as context (default: true)
  extractTopicKeywords?: boolean; // Extract keywords from topic (default: true)
  useTopicTemplates?: boolean; // Use topic-specific templates (default: true)
  topicWeight?: 'high' | 'medium' | 'low'; // How strongly to emphasize topic (default: 'medium')
}

export interface TopicQueryResult {
  originalQuery: string;
  enhancedQuery: string;
  topic: string;
  topicKeywords: string[];
  queryTemplate: string;
  integrationMethod: 'template' | 'context' | 'prefix' | 'keywords';
}

/**
 * Topic-specific query templates
 * Templates are used to construct queries that better integrate topic and query
 */
const TOPIC_QUERY_TEMPLATES: Record<QuestionType, (topic: string, query: string, topicKeywords: string[]) => string> = {
  factual: (topic, query, topicKeywords) => {
    // For factual queries, integrate topic naturally
    if (query.toLowerCase().includes(topic.toLowerCase())) {
      return query; // Topic already in query
    }
    // Use topic keywords to enhance query
    if (topicKeywords.length > 0) {
      const topKeywords = topicKeywords.slice(0, 2).join(' ');
      return `${query} ${topKeywords}`;
    }
    return `${topic} ${query}`;
  },
  analytical: (topic, query, topicKeywords) => {
    // For analytical queries, use topic as context
    const topicPhrase = topic.includes(' ') ? `"${topic}"` : topic;
    return `${query} related to ${topicPhrase}`;
  },
  comparative: (topic, query, topicKeywords) => {
    // For comparative queries, integrate topic into comparison
    if (query.toLowerCase().includes('compare') || query.toLowerCase().includes('difference')) {
      return `${query} ${topic}`;
    }
    return `compare ${query} and ${topic}`;
  },
  procedural: (topic, query, topicKeywords) => {
    // For procedural queries, use topic as domain context
    const topicPhrase = topic.includes(' ') ? `"${topic}"` : topic;
    return `${query} in ${topicPhrase}`;
  },
  exploratory: (topic, query, topicKeywords) => {
    // For exploratory queries, use topic as primary focus
    const topicPhrase = topic.includes(' ') ? `"${topic}"` : topic;
    return `${topicPhrase} ${query}`;
  },
  unknown: (topic, query, topicKeywords) => {
    // Default: use topic as context
    const topicPhrase = topic.includes(' ') ? `"${topic}"` : topic;
    return `${query} ${topicPhrase}`;
  },
};

/**
 * Topic Query Builder Service
 * Builds topic-aware search queries
 */
export class TopicQueryBuilderService {
  /**
   * Extract keywords from topic
   */
  static extractTopicKeywords(topic: string): string[] {
    if (!topic || topic.trim().length === 0) {
      return [];
    }

    // Split topic into words
    const words = topic
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.replace(/[^\w]/g, '')) // Remove punctuation
      .filter(word => word.length >= 3); // Minimum length

    // Remove duplicates while preserving order
    return Array.from(new Set(words));
  }

  /**
   * Determine integration method based on query and topic
   */
  private static determineIntegrationMethod(
    query: string,
    topic: string,
    questionType: QuestionType
  ): 'template' | 'context' | 'prefix' | 'keywords' {
    const queryLower = query.toLowerCase();
    const topicLower = topic.toLowerCase();

    // If topic is already in query, use keywords extraction
    if (queryLower.includes(topicLower)) {
      return 'keywords';
    }

    // Use templates for specific question types
    if (questionType === 'exploratory' || questionType === 'analytical') {
      return 'template';
    }

    // Use context for other types
    if (questionType === 'procedural' || questionType === 'comparative') {
      return 'context';
    }

    // Default to prefix for factual/unknown
    return 'prefix';
  }

  /**
   * Build topic-aware query using template
   */
  private static buildTemplateQuery(
    query: string,
    topic: string,
    questionType: QuestionType,
    topicKeywords: string[]
  ): string {
    const template = TOPIC_QUERY_TEMPLATES[questionType];
    return template(topic, query, topicKeywords);
  }

  /**
   * Build topic-aware query using context integration
   */
  private static buildContextQuery(
    query: string,
    topic: string,
    topicKeywords: string[],
    weight: 'high' | 'medium' | 'low'
  ): string {
    const topicPhrase = topic.includes(' ') ? `"${topic}"` : topic;

    switch (weight) {
      case 'high':
        // High weight: topic first, then query
        return `${topicPhrase} ${query}`;
      case 'medium':
        // Medium weight: query first, then topic
        if (topicKeywords.length > 0) {
          const topKeywords = topicKeywords.slice(0, 2).join(' ');
          return `${query} ${topKeywords}`;
        }
        return `${query} ${topicPhrase}`;
      case 'low':
        // Low weight: only add topic keywords
        if (topicKeywords.length > 0) {
          const topKeywords = topicKeywords.slice(0, 1).join(' ');
          return `${query} ${topKeywords}`;
        }
        return query;
      default:
        return `${query} ${topicPhrase}`;
    }
  }

  /**
   * Build topic-aware query using keyword extraction
   */
  private static buildKeywordQuery(
    query: string,
    topicKeywords: string[]
  ): string {
    if (topicKeywords.length === 0) {
      return query;
    }

    // Add top 2-3 topic keywords to query
    const topKeywords = topicKeywords.slice(0, 3).join(' ');
    return `${query} ${topKeywords}`;
  }

  /**
   * Build topic-aware query using prefix (simple approach)
   */
  private static buildPrefixQuery(
    query: string,
    topic: string
  ): string {
    const topicPhrase = topic.includes(' ') ? `"${topic}"` : topic;
    return `${topicPhrase} ${query}`;
  }

  /**
   * Build topic-aware search query
   */
  static buildTopicQuery(
    query: string,
    topic: string,
    options: TopicQueryOptions = {}
  ): TopicQueryResult {
    const {
      useTopicAsContext = true,
      extractTopicKeywords = true,
      useTopicTemplates = true,
      topicWeight = 'medium',
    } = options;

    if (!topic || topic.trim().length === 0) {
      return {
        originalQuery: query,
        enhancedQuery: query,
        topic: '',
        topicKeywords: [],
        queryTemplate: 'none',
        integrationMethod: 'prefix',
      };
    }

    const originalQuery = query.trim();
    let enhancedQuery = originalQuery;
    const topicTrimmed = topic.trim();

    // Extract topic keywords
    const topicKeywords = extractTopicKeywords
      ? this.extractTopicKeywords(topicTrimmed)
      : [];

    // Classify question type
    const questionType = QueryOptimizerService.classifyQuestionType(originalQuery);

    // Determine integration method
    const integrationMethod = useTopicTemplates
      ? this.determineIntegrationMethod(originalQuery, topicTrimmed, questionType)
      : useTopicAsContext
      ? 'context'
      : 'prefix';

    // Build query based on integration method
    switch (integrationMethod) {
      case 'template':
        enhancedQuery = this.buildTemplateQuery(
          originalQuery,
          topicTrimmed,
          questionType,
          topicKeywords
        );
        break;

      case 'context':
        enhancedQuery = this.buildContextQuery(
          originalQuery,
          topicTrimmed,
          topicKeywords,
          topicWeight
        );
        break;

      case 'keywords':
        enhancedQuery = this.buildKeywordQuery(originalQuery, topicKeywords);
        break;

      case 'prefix':
      default:
        enhancedQuery = this.buildPrefixQuery(originalQuery, topicTrimmed);
        break;
    }

    // Get template name
    const queryTemplate = useTopicTemplates ? questionType : 'none';

    logger.debug('Topic-aware query built', {
      originalQuery: originalQuery.substring(0, 100),
      enhancedQuery: enhancedQuery.substring(0, 100),
      topic: topicTrimmed,
      questionType,
      integrationMethod,
      topicKeywordsCount: topicKeywords.length,
    });

    return {
      originalQuery,
      enhancedQuery: enhancedQuery.trim(),
      topic: topicTrimmed,
      topicKeywords,
      queryTemplate,
      integrationMethod,
    };
  }

  /**
   * Quick build (simplified version)
   */
  static quickBuildTopicQuery(query: string, topic: string): string {
    const result = this.buildTopicQuery(query, topic, {
      useTopicAsContext: true,
      extractTopicKeywords: true,
      useTopicTemplates: false, // Faster without templates
      topicWeight: 'medium',
    });
    return result.enhancedQuery;
  }

  /**
   * Check if topic should be integrated
   */
  static shouldIntegrateTopic(query: string, topic: string): boolean {
    if (!topic || topic.trim().length === 0) {
      return false;
    }

    const queryLower = query.toLowerCase();
    const topicLower = topic.toLowerCase();

    // Don't integrate if topic is already fully in query
    if (queryLower.includes(topicLower)) {
      return false;
    }

    // Check if topic keywords are already in query
    const topicKeywords = this.extractTopicKeywords(topic);
    const allKeywordsInQuery = topicKeywords.every(keyword =>
      queryLower.includes(keyword)
    );

    return !allKeywordsInQuery;
  }
}

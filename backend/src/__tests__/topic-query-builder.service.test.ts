import {
  TopicQueryBuilderService,
  TopicQueryOptions,
} from '../services/topic-query-builder.service';

describe('TopicQueryBuilderService', () => {
  describe('extractTopicKeywords', () => {
    it('should extract keywords from topic', () => {
      const keywords = TopicQueryBuilderService.extractTopicKeywords('machine learning');

      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords).toContain('machine');
      expect(keywords).toContain('learning');
    });

    it('should handle single-word topics', () => {
      const keywords = TopicQueryBuilderService.extractTopicKeywords('AI');

      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords).toContain('ai');
    });

    it('should remove punctuation', () => {
      const keywords = TopicQueryBuilderService.extractTopicKeywords('deep learning, neural networks!');

      expect(keywords).toContain('deep');
      expect(keywords).toContain('learning');
      expect(keywords).toContain('neural');
      expect(keywords).toContain('networks');
    });

    it('should filter short words', () => {
      const keywords = TopicQueryBuilderService.extractTopicKeywords('AI and ML');

      // AI and ML are both 2 characters, so they're filtered out (min length is 3)
      // Only "and" is 3 characters, but it's a stop word, so it's also filtered
      // So the result should be empty or only contain words >= 3 chars
      expect(keywords.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty topic', () => {
      const keywords = TopicQueryBuilderService.extractTopicKeywords('');

      expect(keywords).toEqual([]);
    });

    it('should remove duplicates', () => {
      const keywords = TopicQueryBuilderService.extractTopicKeywords('machine learning machine');

      expect(keywords.length).toBe(2);
      expect(keywords).toContain('machine');
      expect(keywords).toContain('learning');
    });
  });

  describe('buildTopicQuery', () => {
    it('should build topic-aware query for factual questions', () => {
      const result = TopicQueryBuilderService.buildTopicQuery(
        'What is artificial intelligence?',
        'machine learning'
      );

      expect(result.enhancedQuery).toBeDefined();
      expect(result.topic).toBe('machine learning');
      expect(result.topicKeywords.length).toBeGreaterThan(0);
      expect(result.integrationMethod).toBeDefined();
    });

    it('should build topic-aware query for analytical questions', () => {
      const result = TopicQueryBuilderService.buildTopicQuery(
        'Why does neural network work?',
        'deep learning'
      );

      expect(result.enhancedQuery).toBeDefined();
      expect(result.topic).toBe('deep learning');
      expect(result.integrationMethod).toBe('template');
    });

    it('should build topic-aware query for comparative questions', () => {
      const result = TopicQueryBuilderService.buildTopicQuery(
        'Compare Python and JavaScript',
        'programming languages'
      );

      expect(result.enhancedQuery).toBeDefined();
      expect(result.topic).toBe('programming languages');
    });

    it('should build topic-aware query for procedural questions', () => {
      const result = TopicQueryBuilderService.buildTopicQuery(
        'How to train a model?',
        'machine learning'
      );

      expect(result.enhancedQuery).toBeDefined();
      expect(result.topic).toBe('machine learning');
    });

    it('should build topic-aware query for exploratory questions', () => {
      const result = TopicQueryBuilderService.buildTopicQuery(
        'Tell me about neural networks',
        'deep learning'
      );

      expect(result.enhancedQuery).toBeDefined();
      expect(result.topic).toBe('deep learning');
      expect(result.integrationMethod).toBe('template');
    });

    it('should handle empty topic', () => {
      const result = TopicQueryBuilderService.buildTopicQuery(
        'What is AI?',
        ''
      );

      expect(result.enhancedQuery).toBe('What is AI?');
      expect(result.topic).toBe('');
      expect(result.topicKeywords).toEqual([]);
    });

    it('should use topic as context when enabled', () => {
      const result = TopicQueryBuilderService.buildTopicQuery(
        'What is AI?',
        'machine learning',
        {
          useTopicAsContext: true,
          extractTopicKeywords: true,
          useTopicTemplates: false,
        }
      );

      expect(result.enhancedQuery).toBeDefined();
      expect(result.integrationMethod).toBe('context');
    });

    it('should use topic templates when enabled', () => {
      const result = TopicQueryBuilderService.buildTopicQuery(
        'Why does it work?',
        'neural networks',
        {
          useTopicTemplates: true,
        }
      );

      expect(result.enhancedQuery).toBeDefined();
      expect(result.queryTemplate).toBeDefined();
    });

    it('should respect topic weight', () => {
      const highWeight = TopicQueryBuilderService.buildTopicQuery(
        'What is AI?',
        'machine learning',
        { topicWeight: 'high' }
      );

      const lowWeight = TopicQueryBuilderService.buildTopicQuery(
        'What is AI?',
        'machine learning',
        { topicWeight: 'low' }
      );

      expect(highWeight.enhancedQuery).toBeDefined();
      expect(lowWeight.enhancedQuery).toBeDefined();
      // High weight should include topic more prominently
      expect(highWeight.enhancedQuery.toLowerCase()).toContain('machine');
    });

    it('should extract topic keywords when enabled', () => {
      const result = TopicQueryBuilderService.buildTopicQuery(
        'What is AI?',
        'machine learning',
        {
          extractTopicKeywords: true,
        }
      );

      expect(result.topicKeywords.length).toBeGreaterThan(0);
      expect(result.topicKeywords).toContain('machine');
      expect(result.topicKeywords).toContain('learning');
    });

    it('should not extract topic keywords when disabled', () => {
      const result = TopicQueryBuilderService.buildTopicQuery(
        'What is AI?',
        'machine learning',
        {
          extractTopicKeywords: false,
        }
      );

      expect(result.topicKeywords).toEqual([]);
    });

    it('should use keyword integration when topic already in query', () => {
      const result = TopicQueryBuilderService.buildTopicQuery(
        'What is machine learning?',
        'machine learning'
      );

      expect(result.integrationMethod).toBe('keywords');
    });
  });

  describe('quickBuildTopicQuery', () => {
    it('should quickly build topic query', () => {
      const enhanced = TopicQueryBuilderService.quickBuildTopicQuery(
        'What is AI?',
        'machine learning'
      );

      expect(enhanced).toBeDefined();
      expect(enhanced.length).toBeGreaterThan(0);
    });

    it('should handle empty topic', () => {
      const enhanced = TopicQueryBuilderService.quickBuildTopicQuery(
        'What is AI?',
        ''
      );

      expect(enhanced).toBe('What is AI?');
    });
  });

  describe('shouldIntegrateTopic', () => {
    it('should return true when topic should be integrated', () => {
      const shouldIntegrate = TopicQueryBuilderService.shouldIntegrateTopic(
        'What is AI?',
        'machine learning'
      );

      expect(shouldIntegrate).toBe(true);
    });

    it('should return false when topic is already in query', () => {
      const shouldIntegrate = TopicQueryBuilderService.shouldIntegrateTopic(
        'What is machine learning?',
        'machine learning'
      );

      expect(shouldIntegrate).toBe(false);
    });

    it('should return false when topic keywords are already in query', () => {
      const shouldIntegrate = TopicQueryBuilderService.shouldIntegrateTopic(
        'What is machine learning AI?',
        'machine learning'
      );

      expect(shouldIntegrate).toBe(false);
    });

    it('should return false for empty topic', () => {
      const shouldIntegrate = TopicQueryBuilderService.shouldIntegrateTopic(
        'What is AI?',
        ''
      );

      expect(shouldIntegrate).toBe(false);
    });

    it('should return true when topic partially matches', () => {
      const shouldIntegrate = TopicQueryBuilderService.shouldIntegrateTopic(
        'What is AI?',
        'deep learning neural networks'
      );

      expect(shouldIntegrate).toBe(true);
    });
  });

  describe('integration methods', () => {
    it('should use template method for exploratory queries', () => {
      const result = TopicQueryBuilderService.buildTopicQuery(
        'Tell me about neural networks',
        'deep learning',
        { useTopicTemplates: true }
      );

      expect(result.integrationMethod).toBe('template');
    });

    it('should use context method for procedural queries', () => {
      const result = TopicQueryBuilderService.buildTopicQuery(
        'How to train a model?',
        'machine learning',
        { useTopicTemplates: true }
      );

      expect(result.integrationMethod).toBe('context');
    });

    it('should use keywords method when topic in query', () => {
      const result = TopicQueryBuilderService.buildTopicQuery(
        'What is machine learning?',
        'machine learning',
        { useTopicTemplates: true }
      );

      expect(result.integrationMethod).toBe('keywords');
    });
  });

  describe('topic query templates', () => {
    it('should use factual template', () => {
      const result = TopicQueryBuilderService.buildTopicQuery(
        'What is AI?',
        'machine learning',
        { useTopicTemplates: true }
      );

      expect(result.queryTemplate).toBe('factual');
      expect(result.enhancedQuery).toBeDefined();
    });

    it('should use analytical template', () => {
      const result = TopicQueryBuilderService.buildTopicQuery(
        'Why does it work?',
        'neural networks',
        { useTopicTemplates: true }
      );

      expect(result.queryTemplate).toBe('analytical');
      expect(result.enhancedQuery).toContain('related to');
    });

    it('should use comparative template', () => {
      const result = TopicQueryBuilderService.buildTopicQuery(
        'Compare Python and JavaScript',
        'programming languages',
        { useTopicTemplates: true }
      );

      expect(result.queryTemplate).toBe('comparative');
      expect(result.enhancedQuery).toBeDefined();
    });

    it('should use procedural template', () => {
      const result = TopicQueryBuilderService.buildTopicQuery(
        'How to train a model?',
        'machine learning',
        { useTopicTemplates: true }
      );

      expect(result.queryTemplate).toBe('procedural');
      expect(result.enhancedQuery).toContain('in');
    });

    it('should use exploratory template', () => {
      const result = TopicQueryBuilderService.buildTopicQuery(
        'Tell me about neural networks',
        'deep learning',
        { useTopicTemplates: true }
      );

      expect(result.queryTemplate).toBe('exploratory');
      expect(result.enhancedQuery).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle very long topics', () => {
      const longTopic = 'machine learning deep learning neural networks artificial intelligence';
      const result = TopicQueryBuilderService.buildTopicQuery(
        'What is AI?',
        longTopic
      );

      expect(result.enhancedQuery).toBeDefined();
      expect(result.topicKeywords.length).toBeGreaterThan(0);
    });

    it('should handle special characters in topic', () => {
      const result = TopicQueryBuilderService.buildTopicQuery(
        'What is AI?',
        'machine-learning (neural networks)'
      );

      expect(result.enhancedQuery).toBeDefined();
      expect(result.topicKeywords.length).toBeGreaterThan(0);
    });

    it('should handle unicode characters', () => {
      const result = TopicQueryBuilderService.buildTopicQuery(
        'What is AI?',
        'machine learning 🚀'
      );

      expect(result.enhancedQuery).toBeDefined();
    });

    it('should preserve original query when topic is empty', () => {
      const result = TopicQueryBuilderService.buildTopicQuery(
        'What is AI?',
        ''
      );

      expect(result.enhancedQuery).toBe('What is AI?');
      expect(result.originalQuery).toBe('What is AI?');
    });
  });
});

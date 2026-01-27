import {
  ResultQualityScorerService,
  QualityScoringConfig,
  DEFAULT_QUALITY_CONFIG,
} from '../services/result-quality-scorer.service';
import { SearchResult } from '../services/search.service';

describe('ResultQualityScorerService', () => {
  beforeEach(() => {
    // Reset to default config
    ResultQualityScorerService.setConfig(DEFAULT_QUALITY_CONFIG);
  });

  describe('configuration', () => {
    it('should set and get configuration', () => {
      const customConfig: Partial<QualityScoringConfig> = {
        contentLengthWeight: 0.3,
        readabilityWeight: 0.3,
        structureWeight: 0.2,
        completenessWeight: 0.2,
      };

      ResultQualityScorerService.setConfig(customConfig);
      const config = ResultQualityScorerService.getConfig();

      expect(config.contentLengthWeight).toBe(0.3);
      expect(config.readabilityWeight).toBe(0.3);
      expect(config.structureWeight).toBe(0.2);
      expect(config.completenessWeight).toBe(0.2);
    });

    it('should have valid default configuration', () => {
      const config = ResultQualityScorerService.getConfig();

      expect(config.contentLengthWeight).toBeGreaterThan(0);
      expect(config.readabilityWeight).toBeGreaterThan(0);
      expect(config.structureWeight).toBeGreaterThan(0);
      expect(config.completenessWeight).toBeGreaterThan(0);
      // Weights should sum to approximately 1.0
      const totalWeight =
        config.contentLengthWeight +
        config.readabilityWeight +
        config.structureWeight +
        config.completenessWeight;
      expect(totalWeight).toBeCloseTo(1.0, 1);
    });
  });

  describe('scoreResult', () => {
    it('should score a high-quality result', () => {
      const result: SearchResult = {
        title: 'High Quality Article',
        url: 'https://example.com/article',
        content: 'This is a well-structured article with multiple paragraphs. It contains sufficient content to be informative. The sentences are of appropriate length and complexity. The article provides comprehensive information on the topic.',
        score: 0.8,
      };

      const qualityScore = ResultQualityScorerService.scoreResult(result);

      expect(qualityScore.overallScore).toBeGreaterThan(0.6);
      expect(qualityScore.metrics.wordCount).toBeGreaterThan(20);
      expect(qualityScore.metrics.sentenceCount).toBeGreaterThan(3);
      expect(qualityScore.factors.contentLength).toBeGreaterThan(0);
      expect(qualityScore.factors.readability).toBeGreaterThan(0);
      expect(qualityScore.factors.structure).toBeGreaterThan(0);
      expect(qualityScore.factors.completeness).toBeGreaterThan(0);
    });

    it('should score a low-quality result (too short)', () => {
      const result: SearchResult = {
        title: 'Short',
        url: 'https://example.com/short',
        content: 'Too short.',
        score: 0.5,
      };

      const qualityScore = ResultQualityScorerService.scoreResult(result);

      expect(qualityScore.overallScore).toBeLessThan(0.5);
      expect(qualityScore.metrics.wordCount).toBeLessThan(20);
    });

    it('should score a result without title', () => {
      const result: SearchResult = {
        title: '',
        url: 'https://example.com/notitle',
        content: 'This is a good article with sufficient content. It has multiple sentences and paragraphs. The content is informative and well-structured.',
        score: 0.7,
      };

      const qualityScore = ResultQualityScorerService.scoreResult(result);

      // Should have lower structure score due to missing title
      expect(qualityScore.factors.structure).toBeLessThan(1.0);
    });

    it('should handle empty content', () => {
      const result: SearchResult = {
        title: 'Empty',
        url: 'https://example.com/empty',
        content: '',
        score: 0.3,
      };

      const qualityScore = ResultQualityScorerService.scoreResult(result);

      expect(qualityScore.overallScore).toBeLessThan(0.3);
      expect(qualityScore.metrics.wordCount).toBe(0);
      expect(qualityScore.metrics.sentenceCount).toBe(1); // At least 1 sentence
    });

    it('should score result with optimal content length', () => {
      // Create content around optimal length (500 chars)
      const optimalContent = Array(12)
        .fill('This is a sentence with appropriate length and good structure. ')
        .join('');
      
      const result: SearchResult = {
        title: 'Optimal Length Article',
        url: 'https://example.com/optimal',
        content: optimalContent,
        score: 0.8,
      };

      const qualityScore = ResultQualityScorerService.scoreResult(result);

      // Content length should be good (close to optimal)
      expect(qualityScore.factors.contentLength).toBeGreaterThan(0.7);
      expect(qualityScore.factors.completeness).toBeGreaterThan(0.6);
    });

    it('should penalize overly long content', () => {
      const longContent = Array(1000)
        .fill('This is a very long sentence that goes on and on. ')
        .join('');

      const result: SearchResult = {
        title: 'Very Long Article',
        url: 'https://example.com/long',
        content: longContent,
        score: 0.7,
      };

      const qualityScore = ResultQualityScorerService.scoreResult(result);

      // Should have some penalty for being too long
      expect(qualityScore.factors.contentLength).toBeLessThan(1.0);
    });
  });

  describe('readability scoring', () => {
    it('should score good readability (appropriate sentence length)', () => {
      const result: SearchResult = {
        title: 'Readable Article',
        url: 'https://example.com/readable',
        content: 'This is a good sentence. It has appropriate length. The sentences are clear. They are easy to read.',
        score: 0.8,
      };

      const qualityScore = ResultQualityScorerService.scoreResult(result);

      expect(qualityScore.factors.readability).toBeGreaterThan(0.6);
    });

    it('should penalize very short sentences', () => {
      const result: SearchResult = {
        title: 'Short Sentences',
        url: 'https://example.com/short-sentences',
        content: 'Too. Short. Sentences. Fragment. Bad.',
        score: 0.5,
      };

      const qualityScore = ResultQualityScorerService.scoreResult(result);

      expect(qualityScore.factors.readability).toBeLessThan(0.7);
    });

    it('should penalize very long sentences', () => {
      const longSentence = Array(50)
        .fill('word ')
        .join('') + '.';
      
      const result: SearchResult = {
        title: 'Long Sentences',
        url: 'https://example.com/long-sentences',
        content: longSentence,
        score: 0.6,
      };

      const qualityScore = ResultQualityScorerService.scoreResult(result);

      expect(qualityScore.factors.readability).toBeLessThan(0.8);
    });

    it('should boost results with multiple sentences', () => {
      const result: SearchResult = {
        title: 'Multiple Sentences',
        url: 'https://example.com/multiple',
        content: 'First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence.',
        score: 0.7,
      };

      const qualityScore = ResultQualityScorerService.scoreResult(result);

      // With 5 sentences and good sentence length, readability should be good
      expect(qualityScore.factors.readability).toBeGreaterThan(0.6);
    });
  });

  describe('structure scoring', () => {
    it('should score well-structured content with paragraphs', () => {
      const result: SearchResult = {
        title: 'Structured Article',
        url: 'https://example.com/structured',
        content: 'First paragraph with content.\n\nSecond paragraph with more content.\n\nThird paragraph.',
        score: 0.8,
      };

      const qualityScore = ResultQualityScorerService.scoreResult(result);

      expect(qualityScore.factors.structure).toBeGreaterThan(0.6);
      expect(qualityScore.metrics.paragraphCount).toBeGreaterThan(1);
    });

    it('should boost content with formatting', () => {
      const result: SearchResult = {
        title: 'Formatted Article',
        url: 'https://example.com/formatted',
        content: '# Header\n\n- List item 1\n- List item 2\n\nParagraph content.',
        score: 0.8,
      };

      const qualityScore = ResultQualityScorerService.scoreResult(result);

      expect(qualityScore.factors.structure).toBeGreaterThan(0.7);
    });

    it('should penalize content without title', () => {
      const result: SearchResult = {
        title: '',
        url: 'https://example.com/no-title',
        content: 'Good content with paragraphs.\n\nMore paragraphs here.',
        score: 0.7,
      };

      const qualityScore = ResultQualityScorerService.scoreResult(result);

      expect(qualityScore.factors.structure).toBeLessThan(0.8);
    });
  });

  describe('completeness scoring', () => {
    it('should score complete content', () => {
      const completeContent = Array(50)
        .fill('This is a complete sentence with sufficient words. ')
        .join('');

      const result: SearchResult = {
        title: 'Complete Article',
        url: 'https://example.com/complete',
        content: completeContent,
        score: 0.8,
      };

      const qualityScore = ResultQualityScorerService.scoreResult(result);

      expect(qualityScore.factors.completeness).toBeGreaterThan(0.7);
    });

    it('should penalize incomplete content (too short)', () => {
      const result: SearchResult = {
        title: 'Incomplete',
        url: 'https://example.com/incomplete',
        content: 'Too short.',
        score: 0.4,
      };

      const qualityScore = ResultQualityScorerService.scoreResult(result);

      expect(qualityScore.factors.completeness).toBeLessThan(0.5);
    });
  });

  describe('scoreResults', () => {
    it('should score multiple results', () => {
      const results: SearchResult[] = [
        {
          title: 'Article 1',
          url: 'https://example.com/1',
          content: 'Good content with multiple sentences. It is well-structured. The content is informative.',
          score: 0.8,
        },
        {
          title: 'Article 2',
          url: 'https://example.com/2',
          content: 'Short.',
          score: 0.5,
        },
      ];

      const scored = ResultQualityScorerService.scoreResults(results);

      expect(scored).toHaveLength(2);
      expect(scored[0].qualityScore.overallScore).toBeGreaterThan(
        scored[1].qualityScore.overallScore
      );
    });
  });

  describe('filterByQuality', () => {
    it('should filter results by quality threshold', () => {
      const results: SearchResult[] = [
        {
          title: 'High Quality',
          url: 'https://example.com/high',
          content: 'This is a high-quality article with sufficient content. It has multiple sentences and paragraphs. The content is well-structured and informative.',
          score: 0.8,
        },
        {
          title: 'Low Quality',
          url: 'https://example.com/low',
          content: 'Too short.',
          score: 0.3,
        },
        {
          title: 'Medium Quality',
          url: 'https://example.com/medium',
          content: 'This is a medium quality article. It has some content. But not too much.',
          score: 0.6,
        },
      ];

      const filtered = ResultQualityScorerService.filterByQuality(results, 0.5);

      expect(filtered.length).toBeLessThanOrEqual(results.length);
      // High quality should be included
      expect(filtered.some(r => r.url.includes('high'))).toBe(true);
    });

    it('should return all results if threshold is 0', () => {
      const results: SearchResult[] = [
        {
          title: 'Article',
          url: 'https://example.com/article',
          content: 'Content here.',
          score: 0.5,
        },
      ];

      const filtered = ResultQualityScorerService.filterByQuality(results, 0);

      expect(filtered).toHaveLength(results.length);
    });
  });

  describe('sortByQuality', () => {
    it('should sort results by quality score (descending)', () => {
      const results: SearchResult[] = [
        {
          title: 'Low Quality',
          url: 'https://example.com/low',
          content: 'Short.',
          score: 0.3,
        },
        {
          title: 'High Quality',
          url: 'https://example.com/high',
          content: 'This is a high-quality article with sufficient content. It has multiple sentences and paragraphs. The content is well-structured and informative.',
          score: 0.8,
        },
        {
          title: 'Medium Quality',
          url: 'https://example.com/medium',
          content: 'This is a medium quality article. It has some content.',
          score: 0.6,
        },
      ];

      const sorted = ResultQualityScorerService.sortByQuality(results);

      expect(sorted[0].url).toContain('high');
      expect(sorted[sorted.length - 1].url).toContain('low');
    });
  });

  describe('filterAndSortByQuality', () => {
    it('should filter and sort results by quality', () => {
      const results: SearchResult[] = [
        {
          title: 'Low Quality',
          url: 'https://example.com/low',
          content: 'Short.',
          score: 0.3,
        },
        {
          title: 'High Quality',
          url: 'https://example.com/high',
          content: 'This is a high-quality article with sufficient content. It has multiple sentences and paragraphs. The content is well-structured and informative.',
          score: 0.8,
        },
        {
          title: 'Medium Quality',
          url: 'https://example.com/medium',
          content: 'This is a medium quality article. It has some content.',
          score: 0.6,
        },
      ];

      const filteredAndSorted = ResultQualityScorerService.filterAndSortByQuality(
        results,
        0.4
      );

      expect(filteredAndSorted.length).toBeGreaterThan(0);
      expect(filteredAndSorted[0].url).toContain('high');
      // Low quality should be filtered out if threshold is high enough
    });
  });

  describe('performance', () => {
    it('should score results quickly (< 100ms per result)', () => {
      const result: SearchResult = {
        title: 'Test Article',
        url: 'https://example.com/test',
        content: Array(100)
          .fill('This is a test sentence with appropriate length. ')
          .join(''),
        score: 0.8,
      };

      const startTime = Date.now();
      ResultQualityScorerService.scoreResult(result);
      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(100);
    });

    it('should handle multiple results efficiently', () => {
      const results: SearchResult[] = Array.from({ length: 20 }, (_, i) => ({
        title: `Article ${i}`,
        url: `https://example.com/${i}`,
        content: Array(50)
          .fill('This is test content. ')
          .join(''),
        score: 0.7,
      }));

      const startTime = Date.now();
      ResultQualityScorerService.scoreResults(results);
      const processingTime = Date.now() - startTime;

      // Should process 20 results in reasonable time
      expect(processingTime).toBeLessThan(2000); // 2 seconds for 20 results
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in content', () => {
      const result: SearchResult = {
        title: 'Special Characters',
        url: 'https://example.com/special',
        content: 'Content with émojis 🎉 and special chars: @#$%^&*()',
        score: 0.7,
      };

      const qualityScore = ResultQualityScorerService.scoreResult(result);

      expect(qualityScore.overallScore).toBeGreaterThanOrEqual(0);
      expect(qualityScore.overallScore).toBeLessThanOrEqual(1);
    });

    it('should handle HTML content', () => {
      const result: SearchResult = {
        title: 'HTML Content',
        url: 'https://example.com/html',
        content: '<p>First paragraph.</p><p>Second paragraph.</p><h2>Header</h2>',
        score: 0.7,
      };

      const qualityScore = ResultQualityScorerService.scoreResult(result);

      expect(qualityScore.overallScore).toBeGreaterThanOrEqual(0);
      expect(qualityScore.metrics.paragraphCount).toBeGreaterThan(0);
    });

    it('should handle markdown content', () => {
      const result: SearchResult = {
        title: 'Markdown Content',
        url: 'https://example.com/markdown',
        content: '# Header\n\nParagraph one.\n\n## Subheader\n\nParagraph two.',
        score: 0.7,
      };

      const qualityScore = ResultQualityScorerService.scoreResult(result);

      expect(qualityScore.overallScore).toBeGreaterThanOrEqual(0);
      expect(qualityScore.factors.structure).toBeGreaterThan(0.5);
    });

    it('should handle very long content', () => {
      const longContent = Array(2000)
        .fill('This is a very long sentence. ')
        .join('');

      const result: SearchResult = {
        title: 'Very Long Content',
        url: 'https://example.com/long',
        content: longContent,
        score: 0.7,
      };

      const qualityScore = ResultQualityScorerService.scoreResult(result);

      expect(qualityScore.overallScore).toBeGreaterThanOrEqual(0);
      expect(qualityScore.overallScore).toBeLessThanOrEqual(1);
    });
  });
});

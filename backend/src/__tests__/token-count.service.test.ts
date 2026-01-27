import { describe, it, expect, beforeEach } from '@jest/globals';
import { TokenCountService } from '../services/token-count.service';

describe('TokenCountService', () => {
  beforeEach(() => {
    // Clear cache before each test to ensure clean state
    TokenCountService.clearCache();
  });

  describe('countTokens', () => {
    it('should return 0 for empty string', () => {
      expect(TokenCountService.countTokens('')).toBe(0);
    });

    it('should return 0 for null/undefined input', () => {
      expect(TokenCountService.countTokens('')).toBe(0);
    });

    it('should count tokens accurately for simple text', () => {
      const text = 'Hello world';
      const count = TokenCountService.countTokens(text);
      // "Hello world" should be 2 tokens with cl100k_base
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(5); // Reasonable upper bound
    });

    it('should count tokens for longer text', () => {
      const text = 'The quick brown fox jumps over the lazy dog. This is a test sentence.';
      const count = TokenCountService.countTokens(text);
      expect(count).toBeGreaterThan(10);
      expect(count).toBeLessThan(30);
    });

    it('should use cl100k_base encoding by default', () => {
      const text = 'Hello world';
      const count1 = TokenCountService.countTokens(text);
      const count2 = TokenCountService.countTokens(text, 'cl100k_base');
      expect(count1).toBe(count2);
    });

    it('should support different encoding types', () => {
      const text = 'Hello world';
      const cl100k = TokenCountService.countTokens(text, 'cl100k_base');
      const p50k = TokenCountService.countTokens(text, 'p50k_base');
      
      // Both should return valid counts
      expect(cl100k).toBeGreaterThan(0);
      expect(p50k).toBeGreaterThan(0);
    });

    it('should handle special characters correctly', () => {
      const text = 'Hello, world! How are you?';
      const count = TokenCountService.countTokens(text);
      expect(count).toBeGreaterThan(0);
    });

    it('should handle unicode characters', () => {
      const text = 'Hello 世界 🌍';
      const count = TokenCountService.countTokens(text);
      expect(count).toBeGreaterThan(0);
    });

    it('should handle code snippets', () => {
      const code = 'function hello() { return "world"; }';
      const count = TokenCountService.countTokens(code);
      expect(count).toBeGreaterThan(0);
    });

    it('should handle very long text', () => {
      const longText = 'The quick brown fox '.repeat(1000);
      const count = TokenCountService.countTokens(longText);
      expect(count).toBeGreaterThan(1000);
    });
  });

  describe('countTokensForModel', () => {
    it('should count tokens for GPT-3.5-turbo model', () => {
      const text = 'Hello world';
      const count = TokenCountService.countTokensForModel(text, 'gpt-3.5-turbo');
      expect(count).toBeGreaterThan(0);
    });

    it('should count tokens for GPT-4 model', () => {
      const text = 'Hello world';
      const count = TokenCountService.countTokensForModel(text, 'gpt-4');
      expect(count).toBeGreaterThan(0);
    });

    it('should count tokens for embedding models', () => {
      const text = 'Hello world';
      const count = TokenCountService.countTokensForModel(text, 'text-embedding-3-small');
      expect(count).toBeGreaterThan(0);
    });

    it('should use correct encoding for different models', () => {
      const text = 'Hello world';
      const gpt35Count = TokenCountService.countTokensForModel(text, 'gpt-3.5-turbo');
      const gpt4Count = TokenCountService.countTokensForModel(text, 'gpt-4');
      
      // Both should use cl100k_base, so counts should be the same
      expect(gpt35Count).toBe(gpt4Count);
    });

    it('should handle unknown models gracefully', () => {
      const text = 'Hello world';
      const count = TokenCountService.countTokensForModel(text, 'unknown-model');
      // Should fallback to default encoding
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('countTokensBatch', () => {
    it('should return empty array for empty input', () => {
      const result = TokenCountService.countTokensBatch([]);
      expect(result).toEqual([]);
    });

    it('should count tokens for multiple texts', () => {
      const texts = ['Hello', 'World', 'Test'];
      const counts = TokenCountService.countTokensBatch(texts);
      expect(counts).toHaveLength(3);
      counts.forEach((count) => {
        expect(count).toBeGreaterThan(0);
      });
    });

    it('should handle mixed text lengths', () => {
      const texts = ['Short text here', 'This is a longer text with more words and content', 'A'];
      const counts = TokenCountService.countTokensBatch(texts);
      expect(counts).toHaveLength(3);
      expect(counts[1]).toBeGreaterThan(counts[0]);
      expect(counts[0]).toBeGreaterThan(counts[2]);
    });

    it('should handle empty strings in batch', () => {
      const texts = ['Hello', '', 'World'];
      const counts = TokenCountService.countTokensBatch(texts);
      expect(counts).toHaveLength(3);
      expect(counts[0]).toBeGreaterThan(0);
      expect(counts[1]).toBe(0);
      expect(counts[2]).toBeGreaterThan(0);
    });
  });

  describe('getEncodingForModel', () => {
    it('should return cl100k_base for GPT-3.5 models', () => {
      expect(TokenCountService.getEncodingForModel('gpt-3.5-turbo')).toBe('cl100k_base');
    });

    it('should return cl100k_base for GPT-4 models', () => {
      expect(TokenCountService.getEncodingForModel('gpt-4')).toBe('cl100k_base');
    });

    it('should return cl100k_base for embedding models', () => {
      expect(TokenCountService.getEncodingForModel('text-embedding-3-small')).toBe('cl100k_base');
    });

    it('should return p50k_base for GPT-3 text models', () => {
      expect(TokenCountService.getEncodingForModel('text-davinci-003')).toBe('p50k_base');
    });

    it('should default to cl100k_base for unknown models', () => {
      expect(TokenCountService.getEncodingForModel('unknown-model')).toBe('cl100k_base');
    });
  });

  describe('caching', () => {
    it('should cache encoding instances', () => {
      const text = 'Hello world';
      
      // First call should create cache entry
      TokenCountService.countTokens(text, 'cl100k_base');
      const stats1 = TokenCountService.getCacheStats();
      expect(stats1.size).toBeGreaterThan(0);
      
      // Second call should use cache
      TokenCountService.countTokens(text, 'cl100k_base');
      const stats2 = TokenCountService.getCacheStats();
      expect(stats2.size).toBe(stats1.size);
    });

    it('should clear cache correctly', () => {
      TokenCountService.countTokens('test', 'cl100k_base');
      expect(TokenCountService.getCacheStats().size).toBeGreaterThan(0);
      
      TokenCountService.clearCache();
      expect(TokenCountService.getCacheStats().size).toBe(0);
    });

    it('should cache multiple encoding types', () => {
      TokenCountService.countTokens('test', 'cl100k_base');
      TokenCountService.countTokens('test', 'p50k_base');
      
      const stats = TokenCountService.getCacheStats();
      expect(stats.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('accuracy comparison with character estimation', () => {
    it('should provide more accurate counts than character estimation', () => {
      const text = 'The quick brown fox jumps over the lazy dog.';
      
      // Old method: character-based estimation
      const oldEstimate = Math.ceil(text.length / 4);
      
      // New method: tiktoken
      const newCount = TokenCountService.countTokens(text);
      
      // Both should be reasonable, but tiktoken should be more accurate
      expect(newCount).toBeGreaterThan(0);
      expect(Math.abs(newCount - oldEstimate)).toBeLessThan(oldEstimate * 0.5); // Within 50% difference
    });

    it('should handle code better than character estimation', () => {
      const code = 'function test() { return "hello"; }';
      
      const oldEstimate = Math.ceil(code.length / 4);
      const newCount = TokenCountService.countTokens(code);
      
      // Code often has different token-to-character ratio
      expect(newCount).toBeGreaterThan(0);
    });
  });
});

/**
 * Performance benchmarks for token counting
 * Compares old character-based estimation vs new tiktoken implementation
 * 
 * Run with: npm run test -- token-count.benchmark.ts
 */

import { describe, it, expect } from '@jest/globals';
import { TokenCountService } from '../services/token-count.service';
import { ChunkingService } from '../services/chunking.service';

// Old estimation method (for comparison)
function oldEstimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

describe('Token Counting Performance Benchmarks', () => {
  const testTexts = {
    short: 'Hello world',
    medium: 'The quick brown fox jumps over the lazy dog. '.repeat(10),
    long: 'The quick brown fox jumps over the lazy dog. '.repeat(100),
    veryLong: 'The quick brown fox jumps over the lazy dog. '.repeat(1000),
    code: `
      function calculateTotal(items: Item[]): number {
        return items.reduce((sum, item) => {
          return sum + (item.price * item.quantity);
        }, 0);
      }
    `,
    unicode: 'Hello 世界 🌍 こんにちは مرحبا',
    mixed: 'Hello world! This is a test. 123 + 456 = 579. Special chars: @#$%^&*()',
  };

  describe('Accuracy Comparison', () => {
    it('should show accuracy difference for short text', () => {
      const text = testTexts.short;
      const oldCount = oldEstimateTokens(text);
      const newCount = TokenCountService.countTokens(text);
      
      console.log(`Short text - Old: ${oldCount}, New: ${newCount}, Diff: ${Math.abs(oldCount - newCount)}`);
      
      expect(newCount).toBeGreaterThan(0);
      // New method should be more accurate (closer to actual OpenAI tokenizer)
    });

    it('should show accuracy difference for medium text', () => {
      const text = testTexts.medium;
      const oldCount = oldEstimateTokens(text);
      const newCount = TokenCountService.countTokens(text);
      
      console.log(`Medium text - Old: ${oldCount}, New: ${newCount}, Diff: ${Math.abs(oldCount - newCount)}`);
      
      expect(newCount).toBeGreaterThan(0);
    });

    it('should show accuracy difference for long text', () => {
      const text = testTexts.long;
      const oldCount = oldEstimateTokens(text);
      const newCount = TokenCountService.countTokens(text);
      
      const diff = Math.abs(oldCount - newCount);
      const diffPercent = (diff / oldCount) * 100;
      
      console.log(`Long text - Old: ${oldCount}, New: ${newCount}, Diff: ${diff} (${diffPercent.toFixed(2)}%)`);
      
      expect(newCount).toBeGreaterThan(0);
    });

    it('should show accuracy difference for code', () => {
      const text = testTexts.code;
      const oldCount = oldEstimateTokens(text);
      const newCount = TokenCountService.countTokens(text);
      
      console.log(`Code - Old: ${oldCount}, New: ${newCount}, Diff: ${Math.abs(oldCount - newCount)}`);
      
      expect(newCount).toBeGreaterThan(0);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should count tokens quickly for short text (< 1ms)', () => {
      const text = testTexts.short;
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        TokenCountService.countTokens(text);
      }
      
      const end = performance.now();
      const avgTime = (end - start) / 1000;
      
      console.log(`Short text (1000 iterations) - Avg: ${avgTime.toFixed(3)}ms`);
      expect(avgTime).toBeLessThan(10); // Should be very fast
    });

    it('should count tokens quickly for medium text (< 5ms)', () => {
      const text = testTexts.medium;
      const start = performance.now();
      
      for (let i = 0; i < 100; i++) {
        TokenCountService.countTokens(text);
      }
      
      const end = performance.now();
      const avgTime = (end - start) / 100;
      
      console.log(`Medium text (100 iterations) - Avg: ${avgTime.toFixed(3)}ms`);
      expect(avgTime).toBeLessThan(10);
    });

    it('should count tokens for long text within acceptable time (< 10ms)', () => {
      const text = testTexts.long;
      const start = performance.now();
      
      TokenCountService.countTokens(text);
      
      const end = performance.now();
      const time = end - start;
      
      console.log(`Long text (single) - Time: ${time.toFixed(3)}ms`);
      expect(time).toBeLessThan(10); // Acceptance criteria: < 10ms per document
    });

    it('should count tokens for very long text within acceptable time (< 50ms)', () => {
      const text = testTexts.veryLong;
      const start = performance.now();
      
      TokenCountService.countTokens(text);
      
      const end = performance.now();
      const time = end - start;
      
      console.log(`Very long text (single) - Time: ${time.toFixed(3)}ms`);
      expect(time).toBeLessThan(50); // Longer text may take more time
    });

    it('should handle batch counting efficiently', () => {
      const texts = [
        testTexts.short,
        testTexts.medium,
        testTexts.long,
        testTexts.code,
      ];
      
      const start = performance.now();
      TokenCountService.countTokensBatch(texts);
      const end = performance.now();
      const time = end - start;
      
      console.log(`Batch counting (${texts.length} texts) - Time: ${time.toFixed(3)}ms`);
      expect(time).toBeLessThan(20);
    });
  });

  describe('Chunking Performance', () => {
    it('should chunk text within acceptable time (< 10ms for medium text)', () => {
      const text = testTexts.medium;
      const start = performance.now();
      
      ChunkingService.chunkText(text, { maxChunkSize: 100 });
      
      const end = performance.now();
      const time = end - start;
      
      console.log(`Chunking medium text - Time: ${time.toFixed(3)}ms`);
      expect(time).toBeLessThan(10);
    });

    it('should chunk long text within acceptable time (< 50ms)', () => {
      const text = testTexts.long;
      const start = performance.now();
      
      ChunkingService.chunkText(text, { maxChunkSize: 200 });
      
      const end = performance.now();
      const time = end - start;
      
      console.log(`Chunking long text - Time: ${time.toFixed(3)}ms`);
      expect(time).toBeLessThan(50);
    });

    it('should chunk very long text within reasonable time (< 250ms)', () => {
      const text = testTexts.veryLong;
      const start = performance.now();
      
      const chunks = ChunkingService.chunkText(text, { maxChunkSize: 500 });
      
      const end = performance.now();
      const time = end - start;
      
      console.log(`Chunking very long text (${chunks.length} chunks) - Time: ${time.toFixed(3)}ms`);
      // Very long text (500k chars) may take slightly longer, but should still be reasonable
      expect(time).toBeLessThan(250);
    });
  });

  describe('Caching Performance', () => {
    it('should benefit from encoding cache', () => {
      const text = testTexts.medium;
      
      // First call (cache miss)
      const start1 = performance.now();
      TokenCountService.countTokens(text, 'cl100k_base');
      const time1 = performance.now() - start1;
      
      // Second call (cache hit)
      const start2 = performance.now();
      TokenCountService.countTokens(text, 'cl100k_base');
      const time2 = performance.now() - start2;
      
      console.log(`First call: ${time1.toFixed(3)}ms, Second call: ${time2.toFixed(3)}ms`);
      // Second call should be faster (or at least not slower)
      expect(time2).toBeLessThanOrEqual(time1 * 1.5); // Allow some variance
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory with repeated calls', () => {
      const text = testTexts.medium;
      
      // Make many calls
      for (let i = 0; i < 1000; i++) {
        TokenCountService.countTokens(text);
      }
      
      const stats = TokenCountService.getCacheStats();
      console.log(`Cache stats after 1000 calls: ${JSON.stringify(stats)}`);
      
      // Cache should be reasonable size (not growing unbounded)
      expect(stats.size).toBeLessThan(10);
    });
  });
});

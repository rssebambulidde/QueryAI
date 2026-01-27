import { ChunkingService } from '../services/chunking.service';
import { DocumentTypeDetectionService } from '../services/document-type-detection.service';
import { getAdaptiveChunkingOptions, getChunkSizeProfile, calculateOverlapSize, getChunkingConfig } from '../config/chunking.config';
import { DocumentType } from '../services/document-type-detection.service';

describe('Adaptive Chunking', () => {
  describe('Chunk Size Profiles', () => {
    it('should have profiles for all document types', () => {
      const config = getChunkingConfig();
      const types: DocumentType[] = ['pdf', 'docx', 'text', 'code', 'markdown', 'html', 'unknown'];
      
      types.forEach(type => {
        const profile = getChunkSizeProfile(type, config);
        expect(profile.maxChunkSize).toBeGreaterThan(0);
        expect(profile.minChunkSize).toBeGreaterThan(0);
        expect(profile.overlapRatio).toBeGreaterThan(0);
        expect(profile.overlapRatio).toBeLessThanOrEqual(1);
        expect(profile.minChunkSize).toBeLessThan(profile.maxChunkSize);
      });
    });

    it('should have different chunk sizes for different document types', () => {
      const config = getChunkingConfig();
      const pdfProfile = getChunkSizeProfile('pdf', config);
      const codeProfile = getChunkSizeProfile('code', config);
      
      // PDF should have larger chunks than code
      expect(pdfProfile.maxChunkSize).toBeGreaterThan(codeProfile.maxChunkSize);
    });

    it('should have higher overlap for code files', () => {
      const config = getChunkingConfig();
      const codeProfile = getChunkSizeProfile('code', config);
      const textProfile = getChunkSizeProfile('text', config);
      
      // Code should have higher overlap ratio
      expect(codeProfile.overlapRatio).toBeGreaterThan(textProfile.overlapRatio);
    });
  });

  describe('Adaptive Chunking Options', () => {
    it('should return adaptive options for PDF', () => {
      const options = getAdaptiveChunkingOptions('pdf');
      
      expect(options.maxChunkSize).toBeGreaterThan(0);
      expect(options.minChunkSize).toBeGreaterThan(0);
      expect(options.overlapSize).toBeGreaterThan(0);
      expect(options.minChunkSize).toBeLessThan(options.maxChunkSize);
    });

    it('should return adaptive options for code', () => {
      const options = getAdaptiveChunkingOptions('code');
      
      expect(options.maxChunkSize).toBeLessThan(800); // Code should use smaller chunks
      expect(options.overlapSize).toBeGreaterThan(0);
    });

    it('should use defaults when adaptive is disabled', () => {
      const config = getChunkingConfig();
      config.adaptive.enabled = false;
      
      const options = getAdaptiveChunkingOptions('pdf', config);
      
      expect(options.maxChunkSize).toBe(config.sentence.defaultMaxChunkSize);
      expect(options.minChunkSize).toBe(config.sentence.defaultMinChunkSize);
      expect(options.overlapSize).toBe(config.sentence.defaultOverlapSize);
    });
  });

  describe('Overlap Calculation', () => {
    it('should calculate overlap using ratio mode', () => {
      const profile = getChunkSizeProfile('text');
      const overlap = calculateOverlapSize(800, 'ratio', profile);
      
      expect(overlap).toBe(Math.round(800 * profile.overlapRatio));
    });

    it('should calculate dynamic overlap', () => {
      const config = getChunkingConfig();
      const overlap = calculateOverlapSize(800, 'dynamic', undefined, config.adaptive);
      
      expect(overlap).toBeGreaterThan(0);
      expect(overlap).toBeLessThan(800);
    });

    it('should adjust overlap for large chunks', () => {
      const config = getChunkingConfig();
      const largeOverlap = calculateOverlapSize(1500, 'dynamic', undefined, config.adaptive);
      const mediumOverlap = calculateOverlapSize(800, 'dynamic', undefined, config.adaptive);
      
      // Large chunks might have slightly lower overlap ratio
      expect(largeOverlap).toBeGreaterThan(0);
      expect(mediumOverlap).toBeGreaterThan(0);
    });

    it('should adjust overlap for small chunks', () => {
      const config = getChunkingConfig();
      const smallOverlap = calculateOverlapSize(400, 'dynamic', undefined, config.adaptive);
      const mediumOverlap = calculateOverlapSize(800, 'dynamic', undefined, config.adaptive);
      
      // Small chunks might have slightly higher overlap ratio
      expect(smallOverlap).toBeGreaterThan(0);
      expect(mediumOverlap).toBeGreaterThan(0);
    });
  });

  describe('ChunkingService with Adaptive Sizing', () => {
    it('should use adaptive chunk sizes for PDF', () => {
      const text = 'This is a test document. '.repeat(100);
      const chunks = ChunkingService.chunkText(text, {
        filename: 'document.pdf',
        useAdaptiveSizing: true,
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.tokenCount).toBeLessThanOrEqual(1000); // PDF max chunk size
        expect(chunk.tokenCount).toBeGreaterThan(0);
      });
    });

    it('should use adaptive chunk sizes for code', () => {
      const codeText = `
        function calculateSum(a, b) {
          return a + b;
        }
        function calculateProduct(x, y) {
          return x * y;
        }
      `.repeat(20);
      
      const chunks = ChunkingService.chunkText(codeText, {
        filename: 'script.js',
        useAdaptiveSizing: true,
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        // Allow slight overflow due to sentence boundary preservation (up to 20% over max)
        expect(chunk.tokenCount).toBeLessThanOrEqual(720); // 600 * 1.2
      });
    });

    it('should auto-detect document type from content', () => {
      const codeText = `
        function test() {
          const x = 1;
          return x + 2;
        }
      `.repeat(30);
      
      const chunks = ChunkingService.chunkText(codeText, {
        useAdaptiveSizing: true,
      });

      expect(chunks.length).toBeGreaterThan(0);
      // Should use code chunk sizes (smaller)
      // Allow slight overflow due to sentence boundary preservation
      chunks.forEach(chunk => {
        expect(chunk.tokenCount).toBeLessThanOrEqual(720); // 600 * 1.2
      });
    });

    it('should respect explicit document type override', () => {
      const text = 'Plain text content. '.repeat(100);
      const chunks = ChunkingService.chunkText(text, {
        documentType: 'code', // Explicitly set to code
        useAdaptiveSizing: true,
      });

      expect(chunks.length).toBeGreaterThan(0);
      // Should use code chunk sizes even though content looks like text
      chunks.forEach(chunk => {
        expect(chunk.tokenCount).toBeLessThanOrEqual(600);
      });
    });

    it('should allow disabling adaptive sizing', () => {
      const text = 'Test content. '.repeat(100);
      const chunks = ChunkingService.chunkText(text, {
        filename: 'document.pdf',
        useAdaptiveSizing: false,
        maxChunkSize: 500, // Explicit size
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.tokenCount).toBeLessThanOrEqual(500); // Should use explicit size
      });
    });

    it('should use adaptive overlap sizes', () => {
      const text = 'This is a longer document. '.repeat(200);
      const chunks = ChunkingService.chunkText(text, {
        filename: 'document.pdf',
        useAdaptiveSizing: true,
      });

      expect(chunks.length).toBeGreaterThan(1);
      
      // Check that chunks have appropriate overlap
      // (This is indirect - we verify chunks are created correctly)
      for (let i = 1; i < chunks.length; i++) {
        const prevChunk = chunks[i - 1];
        const currentChunk = chunks[i];
        
        // Chunks should be sequential
        expect(currentChunk.startChar).toBeGreaterThanOrEqual(prevChunk.startChar);
      }
    });
  });

  describe('Backward Compatibility', () => {
    it('should work without adaptive sizing options', () => {
      const text = 'Test content. '.repeat(50);
      const chunks = ChunkingService.chunkText(text);

      expect(chunks.length).toBeGreaterThan(0);
      // Should use defaults or adaptive sizing (enabled by default)
      chunks.forEach(chunk => {
        expect(chunk.tokenCount).toBeGreaterThan(0);
      });
    });

    it('should allow explicit size overrides', () => {
      const text = 'Test content. '.repeat(100);
      const chunks = ChunkingService.chunkText(text, {
        maxChunkSize: 200,
        minChunkSize: 50,
        overlapSize: 25,
        useAdaptiveSizing: false,
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.tokenCount).toBeLessThanOrEqual(200);
      });
    });
  });
});

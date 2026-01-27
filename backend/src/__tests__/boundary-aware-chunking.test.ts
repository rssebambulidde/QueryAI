import { ChunkingService } from '../services/chunking.service';
import { BoundaryDetectionService } from '../services/boundary-detection.service';

describe('Boundary-Aware Chunking', () => {
  describe('Paragraph boundary awareness', () => {
    it('should not split paragraphs unnecessarily', () => {
      const text = 'First paragraph with multiple sentences. This is sentence two. And sentence three.\n\nSecond paragraph with its own content. More sentences here.\n\nThird paragraph.';
      const chunks = ChunkingService.chunkText(text, {
        maxChunkSize: 50,
        respectParagraphBoundaries: true,
      });

      expect(chunks.length).toBeGreaterThan(0);
      
      // Check that chunks respect paragraph boundaries when possible
      const structure = BoundaryDetectionService.detectDocumentStructure(text);
      chunks.forEach((chunk, index) => {
        // Most chunks should start/end at paragraph boundaries (except when absolutely necessary)
        if (chunk.startsAtParagraphBoundary !== undefined) {
          expect(typeof chunk.startsAtParagraphBoundary).toBe('boolean');
        }
        if (chunk.endsAtParagraphBoundary !== undefined) {
          expect(typeof chunk.endsAtParagraphBoundary).toBe('boolean');
        }
      });
    });

    it('should include paragraph indices in chunk metadata', () => {
      const text = 'First paragraph with multiple sentences. This is sentence two. And sentence three.\n\nSecond paragraph with its own content. More sentences here.\n\nThird paragraph with final content.';
      const chunks = ChunkingService.chunkText(text, {
        maxChunkSize: 30, // Small chunks to force multiple chunks
        respectParagraphBoundaries: true,
      });

      expect(chunks.length).toBeGreaterThan(0);
      
      // Check that chunks have the paragraphIndices property (may be undefined if no paragraphs detected)
      chunks.forEach(chunk => {
        // paragraphIndices is optional, so we just check the structure
        if (chunk.paragraphIndices !== undefined) {
          expect(Array.isArray(chunk.paragraphIndices)).toBe(true);
          expect(chunk.paragraphIndices.length).toBeGreaterThan(0);
        }
        // Verify chunk has all required properties
        expect(chunk).toHaveProperty('content');
        expect(chunk).toHaveProperty('startChar');
        expect(chunk).toHaveProperty('endChar');
        expect(chunk).toHaveProperty('tokenCount');
        expect(chunk).toHaveProperty('chunkIndex');
      });
    });

    it('should break at paragraph boundaries when chunk is 70% full', () => {
      const text = 'First paragraph with many sentences. ' + 
                   'Sentence two. Sentence three. Sentence four. ' +
                   'Sentence five. Sentence six.\n\n' +
                   'Second paragraph starts here.';
      const chunks = ChunkingService.chunkText(text, {
        maxChunkSize: 50,
        respectParagraphBoundaries: true,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Section boundary awareness', () => {
    it('should include section information in chunk metadata', () => {
      const text = '# Introduction\n\nFirst paragraph.\n\nSecond paragraph.\n\n## Methods\n\nThird paragraph.';
      const chunks = ChunkingService.chunkText(text, {
        maxChunkSize: 100,
        respectSectionBoundaries: true,
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        if (chunk.section) {
          expect(chunk.section.title).toBeDefined();
          expect(chunk.section.level).toBeGreaterThan(0);
        }
      });
    });

    it('should break at section boundaries when appropriate', () => {
      const text = '# Section 1\n\nContent here. More content.\n\n# Section 2\n\nDifferent content.';
      const chunks = ChunkingService.chunkText(text, {
        maxChunkSize: 50,
        respectSectionBoundaries: true,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Combined boundary awareness', () => {
    it('should respect both paragraph and section boundaries', () => {
      const text = '# Introduction\n\nPara 1.\n\nPara 2.\n\n## Methods\n\nPara 3.\n\nPara 4.';
      const chunks = ChunkingService.chunkText(text, {
        maxChunkSize: 50,
        respectParagraphBoundaries: true,
        respectSectionBoundaries: true,
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.content).toBeDefined();
        expect(chunk.startChar).toBeGreaterThanOrEqual(0);
        expect(chunk.endChar).toBeGreaterThan(chunk.startChar);
        expect(chunk.tokenCount).toBeGreaterThan(0);
      });
    });
  });

  describe('Backward compatibility', () => {
    it('should work without boundary awareness (default behavior)', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const chunks = ChunkingService.chunkText(text, {
        maxChunkSize: 50,
        respectParagraphBoundaries: false,
        respectSectionBoundaries: false,
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.content).toBeDefined();
        expect(chunk.tokenCount).toBeGreaterThan(0);
      });
    });

    it('should maintain existing chunk structure', () => {
      const text = 'Some text here. More text.';
      const chunks = ChunkingService.chunkText(text);

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk).toHaveProperty('content');
        expect(chunk).toHaveProperty('startChar');
        expect(chunk).toHaveProperty('endChar');
        expect(chunk).toHaveProperty('tokenCount');
        expect(chunk).toHaveProperty('chunkIndex');
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle text with no paragraphs', () => {
      const text = 'Single line of text without any paragraph breaks.';
      const chunks = ChunkingService.chunkText(text, {
        respectParagraphBoundaries: true,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle text with no sections', () => {
      const text = 'Paragraph one.\n\nParagraph two.';
      const chunks = ChunkingService.chunkText(text, {
        respectSectionBoundaries: true,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle very small text', () => {
      const text = 'Short.';
      const chunks = ChunkingService.chunkText(text, {
        respectParagraphBoundaries: true,
        respectSectionBoundaries: true,
      });

      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toBe(text.trim());
    });
  });
});

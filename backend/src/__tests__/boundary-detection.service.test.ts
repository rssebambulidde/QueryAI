import { BoundaryDetectionService } from '../services/boundary-detection.service';

describe('BoundaryDetectionService', () => {
  describe('detectParagraphs', () => {
    it('should detect paragraphs separated by double newlines', () => {
      const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
      const paragraphs = BoundaryDetectionService.detectParagraphs(text);

      expect(paragraphs).toHaveLength(3);
      expect(paragraphs[0].index).toBe(0);
      expect(paragraphs[0].startChar).toBe(0);
      expect(paragraphs[1].index).toBe(1);
      expect(paragraphs[2].index).toBe(2);
    });

    it('should detect HTML paragraph tags', () => {
      const text = '<p>First paragraph.</p><p>Second paragraph.</p>';
      const paragraphs = BoundaryDetectionService.detectParagraphs(text);

      expect(paragraphs.length).toBeGreaterThan(0);
    });

    it('should handle text with no paragraph breaks', () => {
      const text = 'This is a single paragraph without any breaks.';
      const paragraphs = BoundaryDetectionService.detectParagraphs(text);

      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0].startChar).toBe(0);
      expect(paragraphs[0].endChar).toBe(text.length);
    });

    it('should handle empty text', () => {
      const text = '';
      const paragraphs = BoundaryDetectionService.detectParagraphs(text);

      expect(paragraphs).toHaveLength(0);
    });
  });

  describe('detectSections', () => {
    it('should detect markdown headers', () => {
      const text = '# Section 1\n\nContent here.\n\n## Subsection 1.1\n\nMore content.';
      const sections = BoundaryDetectionService.detectSections(text);

      expect(sections.length).toBeGreaterThan(0);
      expect(sections[0].title).toContain('Section 1');
      expect(sections[0].level).toBe(1);
    });

    it('should detect HTML headings', () => {
      const text = '<h1>Main Title</h1><p>Content</p><h2>Subtitle</h2>';
      const sections = BoundaryDetectionService.detectSections(text);

      expect(sections.length).toBeGreaterThan(0);
      expect(sections.some(s => s.level === 1)).toBe(true);
      expect(sections.some(s => s.level === 2)).toBe(true);
    });

    it('should detect numbered sections', () => {
      const text = '1. First Section\n\nContent.\n\n1.1 Subsection\n\nMore content.';
      const sections = BoundaryDetectionService.detectSections(text);

      expect(sections.length).toBeGreaterThan(0);
    });

    it('should set end positions for sections', () => {
      const text = '# Section 1\n\nContent.\n\n# Section 2\n\nMore content.';
      const sections = BoundaryDetectionService.detectSections(text);

      expect(sections.length).toBeGreaterThanOrEqual(2);
      if (sections.length >= 2) {
        expect(sections[0].endChar).toBe(sections[1].startChar);
        expect(sections[sections.length - 1].endChar).toBe(text.length);
      }
    });
  });

  describe('detectDocumentStructure', () => {
    it('should detect complete document structure', () => {
      const text = '# Introduction\n\nFirst paragraph.\n\nSecond paragraph.\n\n## Methods\n\nThird paragraph.';
      const structure = BoundaryDetectionService.detectDocumentStructure(text);

      expect(structure.paragraphs.length).toBeGreaterThan(0);
      expect(structure.sections.length).toBeGreaterThan(0);
      expect(structure.hasMarkdownHeaders).toBe(true);
    });

    it('should link paragraphs to sections', () => {
      const text = '# Section 1\n\nPara 1.\n\nPara 2.\n\n# Section 2\n\nPara 3.';
      const structure = BoundaryDetectionService.detectDocumentStructure(text);

      expect(structure.paragraphs.length).toBeGreaterThan(0);
      expect(structure.paragraphs.some(p => p.sectionIndex !== undefined)).toBe(true);
    });
  });

  describe('findSectionAtPosition', () => {
    it('should find section at given position', () => {
      const text = '# Section 1\n\nContent.\n\n# Section 2\n\nMore.';
      const structure = BoundaryDetectionService.detectDocumentStructure(text);
      const section = BoundaryDetectionService.findSectionAtPosition(structure.sections, 20);

      expect(section).toBeDefined();
    });

    it('should return undefined for position outside sections', () => {
      const text = '# Section 1\n\nContent.';
      const structure = BoundaryDetectionService.detectDocumentStructure(text);
      const section = BoundaryDetectionService.findSectionAtPosition(structure.sections, 10000);

      expect(section).toBeUndefined();
    });
  });

  describe('findParagraphsInRange', () => {
    it('should find paragraphs in character range', () => {
      const text = 'Para 1.\n\nPara 2.\n\nPara 3.';
      const structure = BoundaryDetectionService.detectDocumentStructure(text);
      const paragraphs = BoundaryDetectionService.findParagraphsInRange(
        structure.paragraphs,
        0,
        20
      );

      expect(paragraphs.length).toBeGreaterThan(0);
    });
  });

  describe('isParagraphBoundary', () => {
    it('should identify paragraph boundaries', () => {
      const text = 'Para 1.\n\nPara 2.';
      const structure = BoundaryDetectionService.detectDocumentStructure(text);
      const isBoundary = BoundaryDetectionService.isParagraphBoundary(
        structure.paragraphs,
        structure.paragraphs[0]?.endChar || 0
      );

      expect(typeof isBoundary).toBe('boolean');
    });
  });
});

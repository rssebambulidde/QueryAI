import { DocumentTypeDetectionService, DocumentType } from '../services/document-type-detection.service';

describe('DocumentTypeDetectionService', () => {
  describe('detectDocumentType', () => {
    it('should detect PDF from filename', () => {
      const type = DocumentTypeDetectionService.detectDocumentType('document.pdf');
      expect(type).toBe('pdf');
    });

    it('should detect DOCX from filename', () => {
      const type = DocumentTypeDetectionService.detectDocumentType('document.docx');
      expect(type).toBe('docx');
    });

    it('should detect code files from extension', () => {
      expect(DocumentTypeDetectionService.detectDocumentType('script.js')).toBe('code');
      expect(DocumentTypeDetectionService.detectDocumentType('app.ts')).toBe('code');
      expect(DocumentTypeDetectionService.detectDocumentType('main.py')).toBe('code');
      expect(DocumentTypeDetectionService.detectDocumentType('file.java')).toBe('code');
    });

    it('should detect markdown from extension', () => {
      expect(DocumentTypeDetectionService.detectDocumentType('readme.md')).toBe('markdown');
      expect(DocumentTypeDetectionService.detectDocumentType('docs.markdown')).toBe('markdown');
    });

    it('should detect HTML from extension', () => {
      expect(DocumentTypeDetectionService.detectDocumentType('page.html')).toBe('html');
      expect(DocumentTypeDetectionService.detectDocumentType('index.htm')).toBe('html');
    });

    it('should detect text from extension', () => {
      expect(DocumentTypeDetectionService.detectDocumentType('notes.txt')).toBe('text');
    });

    it('should detect code from content', () => {
      const codeContent = `
        function calculateSum(a, b) {
          return a + b;
        }
        const result = calculateSum(5, 3);
      `;
      const type = DocumentTypeDetectionService.detectDocumentType(undefined, undefined, codeContent);
      expect(type).toBe('code');
    });

    it('should detect HTML from content', () => {
      const htmlContent = '<html><head><title>Test</title></head><body><p>Content</p></body></html>';
      const type = DocumentTypeDetectionService.detectDocumentType(undefined, undefined, htmlContent);
      expect(type).toBe('html');
    });

    it('should detect markdown from content', () => {
      const markdownContent = '# Title\n\n## Subtitle\n\n- List item 1\n- List item 2\n\n[Link](url)';
      const type = DocumentTypeDetectionService.detectDocumentType(undefined, undefined, markdownContent);
      expect(type).toBe('markdown');
    });

    it('should default to text for plain content', () => {
      const textContent = 'This is plain text without any special formatting.';
      const type = DocumentTypeDetectionService.detectDocumentType(undefined, undefined, textContent);
      expect(type).toBe('text');
    });

    it('should return unknown for empty input', () => {
      const type = DocumentTypeDetectionService.detectDocumentType();
      expect(type).toBe('unknown');
    });
  });

  describe('getDocumentCharacteristics', () => {
    it('should return characteristics for PDF type', () => {
      const chars = DocumentTypeDetectionService.getDocumentCharacteristics('pdf');
      expect(chars.averageSentenceLength).toBeGreaterThan(0);
      expect(chars.averageParagraphLength).toBeGreaterThan(0);
      expect(['low', 'medium', 'high']).toContain(chars.structureComplexity);
    });

    it('should return characteristics for code type', () => {
      const chars = DocumentTypeDetectionService.getDocumentCharacteristics('code');
      expect(chars.codeDensity).toBeGreaterThan(0);
      expect(chars.structureComplexity).toBe('high');
    });

    it('should analyze content when provided', () => {
      const content = 'First sentence. Second sentence.\n\nSecond paragraph with more content.';
      const chars = DocumentTypeDetectionService.getDocumentCharacteristics('text', content);
      
      expect(chars.averageSentenceLength).toBeGreaterThan(0);
      expect(chars.averageParagraphLength).toBeGreaterThan(0);
    });

    it('should calculate code density for code content', () => {
      const codeContent = 'function test() { return 1 + 2; } const x = test();';
      const chars = DocumentTypeDetectionService.getDocumentCharacteristics('code', codeContent);
      
      expect(chars.codeDensity).toBeGreaterThan(0);
      expect(chars.codeDensity).toBeLessThanOrEqual(1);
    });

    it('should determine structure complexity correctly', () => {
      const simpleText = 'Short text.';
      const simpleChars = DocumentTypeDetectionService.getDocumentCharacteristics('text', simpleText);
      expect(['low', 'medium']).toContain(simpleChars.structureComplexity);

      const complexText = Array(25).fill('Paragraph content.\n\n').join('');
      const complexChars = DocumentTypeDetectionService.getDocumentCharacteristics('text', complexText);
      expect(complexChars.structureComplexity).toBe('high');
    });
  });
});

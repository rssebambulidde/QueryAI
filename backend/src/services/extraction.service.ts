// pdf-parse uses CommonJS, so we need to import it differently
const pdfParseLib = require('pdf-parse');
const pdfParse = pdfParseLib.default || pdfParseLib;
import mammoth from 'mammoth';
import logger from '../config/logger';
import { AppError } from '../types/error';

export interface ExtractionResult {
  text: string;
  stats: {
    length: number;
    wordCount: number;
    pageCount?: number; // For PDFs
    paragraphCount?: number;
  };
  metadata?: Record<string, any>;
}

export interface TextStats {
  length: number;
  wordCount: number;
  pageCount?: number;
  paragraphCount?: number;
}

const MAX_TEXT_LENGTH = 1_000_000; // 1 million characters
const EXTRACTION_TIMEOUT = 60000; // 60 seconds

export class ExtractionService {
  /**
   * Extract text from a document buffer
   */
  static async extractText(
    buffer: Buffer,
    fileType: 'pdf' | 'docx' | 'txt' | 'md',
    fileName: string
  ): Promise<ExtractionResult> {
    if (!buffer || buffer.length === 0) {
      throw new AppError('File buffer is empty', 400, 'EMPTY_FILE');
    }

    logger.info('Starting text extraction', {
      fileType,
      fileName,
      fileSize: buffer.length,
    });

    let text: string;
    let metadata: Record<string, any> = {};

    try {
      switch (fileType) {
        case 'pdf':
          ({ text, metadata } = await this.extractFromPDF(buffer));
          break;
        case 'docx':
          text = await this.extractFromDOCX(buffer);
          break;
        case 'txt':
        case 'md':
          text = await this.extractFromText(buffer);
          break;
        default:
          throw new AppError(`Unsupported file type: ${fileType}`, 400, 'UNSUPPORTED_TYPE');
      }

      // Validate extracted text
      if (!text || text.trim().length === 0) {
        throw new AppError('No extractable text found in document', 400, 'NO_TEXT');
      }

      // Check text length limit
      if (text.length > MAX_TEXT_LENGTH) {
        logger.warn('Extracted text exceeds maximum length', {
          fileName,
          textLength: text.length,
          maxLength: MAX_TEXT_LENGTH,
        });
        text = text.substring(0, MAX_TEXT_LENGTH);
        metadata.truncated = true;
      }

      // Clean and validate text
      text = this.cleanText(text);

      // Calculate statistics
      const stats = this.calculateStats(text, metadata);

      logger.info('Text extraction completed', {
        fileName,
        textLength: stats.length,
        wordCount: stats.wordCount,
      });

      return {
        text,
        stats,
        metadata,
      };
    } catch (error: any) {
      logger.error('Text extraction failed', {
        fileName,
        fileType,
        error: error.message,
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        `Failed to extract text: ${error.message}`,
        500,
        'EXTRACTION_FAILED'
      );
    }
  }

  /**
   * Extract text from PDF
   */
  private static async extractFromPDF(buffer: Buffer): Promise<{
    text: string;
    metadata: Record<string, any>;
  }> {
    try {
      const data = await Promise.race([
        pdfParse(buffer),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('PDF extraction timeout')), EXTRACTION_TIMEOUT)
        ),
      ]);

      const text = data.text || '';
      const metadata: Record<string, any> = {
        pageCount: data.numpages || 0,
        info: data.info || {},
      };

      return { text, metadata };
    } catch (error: any) {
      if (error.message.includes('timeout')) {
        throw new AppError('PDF extraction timed out. File may be too large or corrupted.', 400, 'TIMEOUT');
      }
      if (error.message.includes('password') || error.message.includes('encrypted')) {
        throw new AppError('Password-protected PDFs are not supported', 400, 'PASSWORD_PROTECTED');
      }
      throw new AppError(`PDF extraction failed: ${error.message}`, 400, 'PDF_EXTRACTION_FAILED');
    }
  }

  /**
   * Extract text from DOCX
   */
  private static async extractFromDOCX(buffer: Buffer): Promise<string> {
    try {
      const result = await Promise.race([
        mammoth.extractRawText({ buffer }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DOCX extraction timeout')), EXTRACTION_TIMEOUT)
        ),
      ]);

      return result.value || '';
    } catch (error: any) {
      if (error.message.includes('timeout')) {
        throw new AppError('DOCX extraction timed out. File may be too large or corrupted.', 400, 'TIMEOUT');
      }
      throw new AppError(`DOCX extraction failed: ${error.message}`, 400, 'DOCX_EXTRACTION_FAILED');
    }
  }

  /**
   * Extract text from TXT/MD files
   */
  private static async extractFromText(buffer: Buffer): Promise<string> {
    try {
      // Try UTF-8 first, fallback to latin1 if needed
      let text = buffer.toString('utf-8');
      
      // If UTF-8 decoding produces replacement characters, try latin1
      if (text.includes('\ufffd')) {
        text = buffer.toString('latin1');
      }

      return text;
    } catch (error: any) {
      throw new AppError(`Text extraction failed: ${error.message}`, 400, 'TEXT_EXTRACTION_FAILED');
    }
  }

  /**
   * Validate and clean extracted text
   */
  private static cleanText(text: string): string {
    if (!text) {
      return '';
    }

    // Remove excessive whitespace
    text = text.replace(/\s+/g, ' ');

    // Remove control characters except newlines and tabs
    text = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

    // Normalize line breaks
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Trim
    text = text.trim();

    return text;
  }

  /**
   * Calculate text statistics
   */
  private static calculateStats(
    text: string,
    metadata: Record<string, any>
  ): TextStats {
    const length = text.length;
    const wordCount = text.split(/\s+/).filter((word) => word.length > 0).length;
    const paragraphCount = text.split(/\n\n+/).filter((para) => para.trim().length > 0).length;

    return {
      length,
      wordCount,
      pageCount: metadata.pageCount,
      paragraphCount,
    };
  }
}

// pdf-parse v2 uses a class-based API
const { PDFParse } = require('pdf-parse');
import mammoth from 'mammoth';
import logger from '../config/logger';
import { AppError } from '../types/error';

// Optional OCR support (Tesseract.js) - will be loaded dynamically if available
let Tesseract: any = null;
try {
  Tesseract = require('tesseract.js');
} catch (e) {
  // Tesseract.js not installed - OCR will be skipped
  logger.info('Tesseract.js not installed - OCR support disabled');
}

export interface ExtractionResult {
  text: string;
  stats: {
    length: number;
    wordCount: number;
    pageCount?: number; // For PDFs
    paragraphCount?: number;
  };
  metadata?: Record<string, any>;
  tables?: Array<{
    page?: number; // Page number (for PDFs)
    rows: Array<Array<string>>;
    headers?: string[];
  }>; // Extracted tables from PDF or DOCX
  images?: Array<{
    page?: number; // Page number (for PDFs)
    index: number;
    width: number;
    height: number;
    format: string;
    dataUrl?: string; // Base64 data URL
    size?: number; // Size in bytes
  }>; // Extracted images
  ocrUsed?: boolean; // True if OCR was used (scanned PDF)
}

export interface TextStats {
  length: number;
  wordCount: number;
  pageCount?: number;
  paragraphCount?: number;
}

const MAX_TEXT_LENGTH = 1_000_000; // 1 million characters
const EXTRACTION_TIMEOUT = 300000; // 5 minutes for large PDFs

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
    let tables: Array<{
      page?: number;
      rows: Array<Array<string>>;
      headers?: string[];
    }> | undefined = undefined;
    let images: Array<{
      page?: number;
      index: number;
      width: number;
      height: number;
      format: string;
      dataUrl?: string;
      size?: number;
    }> | undefined = undefined;
    let ocrUsed: boolean = false;

    try {
      switch (fileType) {
        case 'pdf':
          ({ text, metadata, tables, images, ocrUsed } = await this.extractFromPDF(buffer));
          break;
        case 'docx':
          ({ text, tables, images } = await this.extractFromDOCX(buffer));
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

      // Include tables in metadata if available
      if (tables && tables.length > 0) {
        metadata.tables = tables;
        metadata.tableCount = tables.length;
      }

      // Include images in metadata if available
      if (images && images.length > 0) {
        metadata.images = images.map(img => ({
          page: img.page,
          index: img.index,
          width: img.width,
          height: img.height,
          format: img.format,
          size: img.size,
        })); // Store metadata only, not full data URLs (too large)
        metadata.imageCount = images.length;
      }

      // Mark if OCR was used
      if (ocrUsed) {
        metadata.ocr = true;
      }

      logger.info('Text extraction completed', {
        fileName,
        textLength: stats.length,
        wordCount: stats.wordCount,
        pageCount: stats.pageCount,
        tableCount: tables?.length || 0,
        imageCount: images?.length || 0,
        ocrUsed,
      });

      return {
        text,
        stats,
        metadata,
        tables,
        images,
        ocrUsed,
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
   * Extract text, tables, and images from PDF
   * Also handles scanned PDFs with OCR if needed
   */
  private static async extractFromPDF(buffer: Buffer): Promise<{
    text: string;
    metadata: Record<string, any>;
    tables?: Array<{
      page: number;
      rows: Array<Array<string>>;
      headers?: string[];
    }>;
    images?: Array<{
      page: number;
      index: number;
      width: number;
      height: number;
      format: string;
      dataUrl?: string;
      size?: number;
    }>;
    ocrUsed: boolean;
  }> {
    try {
      const parser = new PDFParse({ data: buffer });
      
      // Extract text first (required)
      const textData = await Promise.race([
        parser.getText(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('PDF text extraction timeout')), EXTRACTION_TIMEOUT)
        ),
      ]);

      let text = textData.text || '';
      const pageCount = textData.pages?.length || 0;
      let ocrUsed = false;

      // Check if PDF is scanned (very little or no text extracted)
      const isScannedPDF = text.trim().length < 100 && pageCount > 0;

      // If scanned PDF, try OCR (optional - requires tesseract.js)
      if (isScannedPDF) {
        try {
          logger.info('Detected scanned PDF, attempting OCR');
          const ocrText = await this.extractTextWithOCR(parser);
          if (ocrText && ocrText.length > text.length) {
            text = ocrText;
            ocrUsed = true;
            logger.info('OCR extraction successful', { textLength: text.length });
          }
        } catch (ocrError: any) {
          logger.warn('OCR extraction failed or not available', {
            error: ocrError.message,
          });
          // Continue with regular extraction
        }
      }

      // Extract images (optional - don't fail if this fails)
      let images: Array<{
        page: number;
        index: number;
        width: number;
        height: number;
        format: string;
        dataUrl?: string;
        size?: number;
      }> | undefined = undefined;

      try {
        const imagesData = await Promise.race([
          parser.getImage().catch(() => null), // getImage() method
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('PDF image extraction timeout')), EXTRACTION_TIMEOUT)
          ),
        ]);

        if (imagesData && imagesData.pages) {
          const allImages: Array<{
            page: number;
            index: number;
            width: number;
            height: number;
            format: string;
            dataUrl?: string;
            size?: number;
          }> = [];

          imagesData.pages.forEach((pageData: any, pageIndex: number) => {
            if (pageData.images && Array.isArray(pageData.images)) {
              pageData.images.forEach((image: any, imgIndex: number) => {
                if (image && (image.data || image.dataUrl)) {
                  allImages.push({
                    page: pageIndex + 1,
                    index: imgIndex,
                    width: image.width || 0,
                    height: image.height || 0,
                    format: image.format || 'png',
                    dataUrl: image.dataUrl, // Base64 data URL
                    size: image.data?.length || 0,
                  });
                }
              });
            }
          });

          if (allImages.length > 0) {
            images = allImages;
          }
        }
      } catch (imageError: any) {
        logger.warn('Image extraction failed (non-critical)', {
          error: imageError.message,
        });
      }

      // Extract tables (optional - don't fail if this fails)
      let tables: Array<{
        page: number;
        rows: Array<Array<string>>;
        headers?: string[];
      }> | undefined = undefined;

      try {
        const tablesData = await Promise.race([
          parser.getTable().catch(() => null), // getTable() method
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('PDF table extraction timeout')), EXTRACTION_TIMEOUT)
          ),
        ]);

        if (tablesData && tablesData.pages) {
          // Extract tables from all pages
          const allTables: Array<{
            page: number;
            rows: Array<Array<string>>;
            headers?: string[];
          }> = [];

          tablesData.pages.forEach((pageData: any, pageIndex: number) => {
            if (pageData.tables && Array.isArray(pageData.tables)) {
              pageData.tables.forEach((table: any) => {
                if (table && Array.isArray(table) && table.length > 0) {
                  // Table is an array of rows
                  const rows = table.map((row: any) => 
                    Array.isArray(row) ? row.map((cell: any) => String(cell || '')) : []
                  );
                  
                  if (rows.length > 0) {
                    allTables.push({
                      page: pageIndex + 1,
                      rows: rows,
                      headers: rows[0] || undefined, // First row as headers
                    });
                  }
                }
              });
            }
          });

          if (allTables.length > 0) {
            tables = allTables;
          }
        }
      } catch (tableError: any) {
        // Log but don't fail extraction if table parsing fails
        logger.warn('Table extraction failed (non-critical)', {
          error: tableError.message,
        });
      }

      const metadata: Record<string, any> = {
        pageCount,
        info: textData.info || {},
        tableCount: tables?.length || 0,
        imageCount: images?.length || 0,
        isScanned: ocrUsed,
      };

      return { text, metadata, tables, images, ocrUsed: ocrUsed || false };
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
   * Extract text, tables, and images from DOCX
   */
  private static async extractFromDOCX(buffer: Buffer): Promise<{
    text: string;
    tables?: Array<{
      rows: Array<Array<string>>;
      headers?: string[];
    }>;
    images?: Array<{
      index: number;
      width: number;
      height: number;
      format: string;
      dataUrl?: string;
      size?: number;
    }>;
  }> {
    try {
      // Extract text
      const textResult = await Promise.race([
        mammoth.extractRawText({ buffer }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DOCX text extraction timeout')), EXTRACTION_TIMEOUT)
        ),
      ]);

      const text = textResult.value || '';

      // Extract HTML (for tables and images)
      let tables: Array<{
        rows: Array<Array<string>>;
        headers?: string[];
      }> | undefined = undefined;
      let images: Array<{
        index: number;
        width: number;
        height: number;
        format: string;
        dataUrl?: string;
        size?: number;
      }> | undefined = undefined;

      try {
        const htmlResult = await Promise.race([
          mammoth.convertToHtml({ buffer }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('DOCX HTML conversion timeout')), EXTRACTION_TIMEOUT)
          ),
        ]);

        // Parse HTML to extract tables
        if (htmlResult.value) {
          tables = this.extractTablesFromHTML(htmlResult.value);
          images = this.extractImagesFromHTML(htmlResult.value);
        }
      } catch (htmlError: any) {
        // HTML conversion failed, but we have text - log and continue
        logger.warn('DOCX HTML conversion failed (non-critical)', {
          error: htmlError.message,
        });
      }

      return { text, tables, images };
    } catch (error: any) {
      if (error.message.includes('timeout')) {
        throw new AppError('DOCX extraction timed out. File may be too large or corrupted.', 400, 'TIMEOUT');
      }
      throw new AppError(`DOCX extraction failed: ${error.message}`, 400, 'DOCX_EXTRACTION_FAILED');
    }
  }

  /**
   * Extract tables from HTML string
   */
  private static extractTablesFromHTML(html: string): Array<{
    rows: Array<Array<string>>;
    headers?: string[];
  }> {
    const tables: Array<{
      rows: Array<Array<string>>;
      headers?: string[];
    }> = [];

    try {
      // Simple regex-based table extraction (for basic tables)
      // For production, consider using a proper HTML parser like jsdom or cheerio
      const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
      let match;

      while ((match = tableRegex.exec(html)) !== null) {
        const tableHTML = match[1];
        const rows: Array<Array<string>> = [];

        // Extract rows
        const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let rowMatch;
        let isFirstRow = true;
        let headers: string[] | undefined = undefined;

        while ((rowMatch = rowRegex.exec(tableHTML)) !== null) {
          const rowHTML = rowMatch[1];
          const cells: string[] = [];

          // Extract cells (td or th)
          const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
          let cellMatch;

          while ((cellMatch = cellRegex.exec(rowHTML)) !== null) {
            // Remove HTML tags and decode entities
            let cellText = cellMatch[1]
              .replace(/<[^>]+>/g, '') // Remove HTML tags
              .replace(/&nbsp;/g, ' ') // Replace &nbsp;
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .trim();

            cells.push(cellText);
          }

          if (cells.length > 0) {
            if (isFirstRow) {
              headers = cells;
              isFirstRow = false;
            }
            rows.push(cells);
          }
        }

        if (rows.length > 0) {
          tables.push({ rows, headers });
        }
      }
    } catch (error: any) {
      logger.warn('Failed to extract tables from HTML', { error: error.message });
    }

    return tables;
  }

  /**
   * Extract images from HTML string (base64 embedded images)
   */
  private static extractImagesFromHTML(html: string): Array<{
    index: number;
    width: number;
    height: number;
    format: string;
    dataUrl?: string;
    size?: number;
  }> {
    const images: Array<{
      index: number;
      width: number;
      height: number;
      format: string;
      dataUrl?: string;
      size?: number;
    }> = [];

    try {
      // Extract base64 images from HTML
      const imgRegex = /<img[^>]+src="data:image\/(\w+);base64,([^"]+)"/gi;
      let match;
      let index = 0;

      while ((match = imgRegex.exec(html)) !== null) {
        const format = match[1].toLowerCase();
        const base64Data = match[2];
        const dataUrl = `data:image/${format};base64,${base64Data}`;

        // Calculate size from base64
        const size = Math.floor((base64Data.length * 3) / 4);

        // Try to get dimensions from img tag attributes
        const imgTag = match[0];
        const widthMatch = imgTag.match(/width="?(\d+)"?/i);
        const heightMatch = imgTag.match(/height="?(\d+)"?/i);

        images.push({
          index: index++,
          width: widthMatch ? parseInt(widthMatch[1], 10) : 0,
          height: heightMatch ? parseInt(heightMatch[1], 10) : 0,
          format,
          dataUrl, // Store full data URL (can be large)
          size,
        });
      }
    } catch (error: any) {
      logger.warn('Failed to extract images from HTML', { error: error.message });
    }

    return images;
  }

  /**
   * Extract text from scanned PDF using OCR (Tesseract.js)
   * This is called automatically when a scanned PDF is detected
   */
  private static async extractTextWithOCR(parser: any): Promise<string> {
    if (!Tesseract) {
      throw new AppError('OCR not available - Tesseract.js not installed', 500, 'OCR_NOT_AVAILABLE');
    }

    try {
      logger.info('Starting OCR extraction for scanned PDF');
      const allText: string[] = [];

      // Get page count
      const info = await parser.getInfo();
      const pageCount = info.total || 1;

      // Process each page
      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        try {
          // Convert PDF page to image
          const screenshot = await parser.getScreenshot({
            partial: [pageNum],
            scale: 2.0, // Higher scale = better OCR accuracy
          });

          if (screenshot.pages && screenshot.pages[0] && screenshot.pages[0].data) {
            const imageBuffer = screenshot.pages[0].data;

            // Run OCR on the image
            const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng', {
              logger: (m: any) => {
                if (m.status === 'recognizing text') {
                  logger.debug(`OCR progress: ${m.progress * 100}%`);
                }
              },
            });

            if (text && text.trim().length > 0) {
              allText.push(text.trim());
              logger.info(`OCR completed for page ${pageNum}`, {
                textLength: text.length,
              });
            }
          }
        } catch (pageError: any) {
          logger.warn(`OCR failed for page ${pageNum}`, {
            error: pageError.message,
          });
          // Continue with next page
        }
      }

      const combinedText = allText.join('\n\n');
      logger.info('OCR extraction completed', {
        pageCount,
        totalTextLength: combinedText.length,
      });

      return combinedText;
    } catch (error: any) {
      logger.error('OCR extraction failed', { error: error.message });
      throw new AppError(`OCR extraction failed: ${error.message}`, 500, 'OCR_FAILED');
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

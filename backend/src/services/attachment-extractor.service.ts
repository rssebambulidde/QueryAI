/**
 * Attachment Extractor Service
 *
 * Extracts text content from inline chat attachments (documents).
 * Supports PDF, DOCX, TXT, and CSV files encoded as base64 data URIs.
 * Used by the AI pipeline to include document content in the prompt
 * without persisting files to storage.
 */

import logger from '../config/logger';

interface AttachmentInput {
  type: 'image' | 'document';
  name: string;
  mimeType: string;
  /** Base64 data URI (e.g. "data:application/pdf;base64,JVBERi0...") */
  data: string;
}

interface ExtractedText {
  name: string;
  text: string;
  mimeType: string;
}

/** Per-file extraction status. Emitted via SSE so the frontend can show badges. */
export interface ExtractionStatusItem {
  /** Original filename */
  name: string;
  /** 'success' = fully extracted, 'truncated' = smart-truncated to fit budget, 'failed' = extraction error */
  status: 'success' | 'truncated' | 'failed';
  /** Number of characters after extraction (0 for failed) */
  chars: number;
  /** Human-readable reason (populated for truncated/failed) */
  reason?: string;
  /** True when text was recovered via OCR (scanned PDF fallback) */
  ocrApplied?: boolean;
}

export class AttachmentExtractorService {
  /** Minimum chars from pdf-parse before we consider a PDF "scanned" */
  private static readonly SCANNED_PDF_THRESHOLD = 50;
  /** Max PDF pages to OCR (limit cost and time) */
  private static readonly MAX_OCR_PAGES = 5;
  /** DPI scale for PDF page rendering (higher = better OCR, slower) */
  private static readonly PDF_RENDER_SCALE = 2.0;

  /**
   * Strip the data-URI prefix and return raw base64 bytes as a Buffer.
   */
  private static toBuffer(dataUri: string): Buffer {
    // data:image/png;base64,iVBOR... → iVBOR...
    const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
    return Buffer.from(base64, 'base64');
  }

  // ── PDF → PNG page rendering (for OCR) ────────────────────────────

  /**
   * Render the first N pages of a PDF to PNG buffers using pdfjs-dist + canvas.
   * Returns an array of PNG Buffers (one per page).
   */
  private static async renderPdfPagesToImages(
    pdfBuffer: Buffer,
    maxPages?: number,
  ): Promise<Buffer[]> {
    const limit = maxPages ?? this.MAX_OCR_PAGES;
    const { createCanvas } = require('canvas') as typeof import('canvas');
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');

    // Custom canvas factory for pdfjs-dist Node.js rendering
    const canvasFactory = {
      create(width: number, height: number) {
        const canvas = createCanvas(width, height);
        return { canvas, context: canvas.getContext('2d') };
      },
      reset(canvasAndContext: any, width: number, height: number) {
        canvasAndContext.canvas.width = width;
        canvasAndContext.canvas.height = height;
      },
      destroy(canvasAndContext: any) {
        // node-canvas doesn't need explicit cleanup
        canvasAndContext.canvas.width = 0;
        canvasAndContext.canvas.height = 0;
      },
    };

    const doc = await pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      canvasFactory,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;

    const pageCount = Math.min(doc.numPages, limit);
    const images: Buffer[] = [];

    for (let i = 1; i <= pageCount; i++) {
      try {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: this.PDF_RENDER_SCALE });
        const { canvas, context } = canvasFactory.create(
          Math.floor(viewport.width),
          Math.floor(viewport.height),
        );

        await page.render({ canvasContext: context, viewport }).promise;
        images.push(canvas.toBuffer('image/png'));
      } catch (pageErr: any) {
        logger.warn('Failed to render PDF page for OCR', { page: i, error: pageErr.message });
      }
    }

    await doc.destroy();
    return images;
  }

  // ── Tesseract.js OCR (Fallback 1 — free, local) ──────────────────

  /**
   * Run tesseract.js OCR on an array of PNG image buffers.
   * Returns concatenated text from all pages.
   */
  private static async ocrWithTesseract(imageBuffers: Buffer[]): Promise<string> {
    const { recognize } = require('tesseract.js') as typeof import('tesseract.js');
    const pageTexts: string[] = [];

    for (const buf of imageBuffers) {
      try {
        const result = await recognize(buf, 'eng', {
          logger: () => {}, // suppress progress logs
        });
        const text = result.data.text?.trim();
        if (text) pageTexts.push(text);
      } catch (ocrErr: any) {
        logger.warn('Tesseract OCR failed for page', { error: ocrErr.message });
      }
    }

    return pageTexts.join('\n\n');
  }

  // ── OpenAI Vision OCR (Fallback 2 — higher quality, costs money) ──

  /**
   * Send rendered page images to OpenAI vision model for text extraction.
   * Used when tesseract.js yields poor results.
   */
  private static async ocrWithVision(imageBuffers: Buffer[]): Promise<string> {
    try {
      const { OpenAIPool } = await import('../config/openai.config');
      const client = OpenAIPool.getClient();

      // Build multi-image content parts
      const imageParts = imageBuffers.map((buf) => ({
        type: 'image_url' as const,
        image_url: {
          url: `data:image/png;base64,${buf.toString('base64')}`,
          detail: 'high' as const,
        },
      }));

      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract ALL text from these scanned document pages. Preserve the original formatting, paragraph breaks, headings, and lists as closely as possible. Output only the extracted text — no commentary.',
              },
              ...imageParts,
            ],
          },
        ],
        temperature: 0,
        max_tokens: 4096,
      });

      return response.choices?.[0]?.message?.content?.trim() || '';
    } catch (visionErr: any) {
      logger.warn('OpenAI vision OCR failed', { error: visionErr.message });
      return '';
    }
  }

  // ── PDF OCR orchestrator ──────────────────────────────────────────

  /**
   * Attempt OCR on a scanned PDF buffer.
   * Tries tesseract.js first (free); falls back to OpenAI vision if text is poor.
   * Returns `{ text, method }` where method indicates which OCR path succeeded.
   */
  private static async ocrFallbackForPdf(
    pdfBuffer: Buffer,
  ): Promise<{ text: string; method: 'tesseract' | 'vision' | 'none' }> {
    // Step 1: render PDF pages to images
    let images: Buffer[];
    try {
      images = await this.renderPdfPagesToImages(pdfBuffer);
    } catch (renderErr: any) {
      logger.error('Failed to render PDF pages for OCR', { error: renderErr.message });
      return { text: '', method: 'none' };
    }

    if (images.length === 0) {
      return { text: '', method: 'none' };
    }

    // Step 2: Fallback 1 — tesseract.js (free, local)
    try {
      const tesseractText = await this.ocrWithTesseract(images);
      if (tesseractText.length >= this.SCANNED_PDF_THRESHOLD) {
        logger.info('Tesseract OCR succeeded for scanned PDF', { chars: tesseractText.length });
        return { text: tesseractText, method: 'tesseract' };
      }
      logger.info('Tesseract OCR returned minimal text, trying OpenAI vision', {
        chars: tesseractText.length,
      });
    } catch (tessErr: any) {
      logger.warn('Tesseract OCR threw error, trying OpenAI vision', { error: tessErr.message });
    }

    // Step 3: Fallback 2 — OpenAI vision (better quality, costs money)
    try {
      const visionText = await this.ocrWithVision(images);
      if (visionText.length >= this.SCANNED_PDF_THRESHOLD) {
        logger.info('OpenAI vision OCR succeeded for scanned PDF', { chars: visionText.length });
        return { text: visionText, method: 'vision' };
      }
    } catch (visErr: any) {
      logger.warn('OpenAI vision OCR failed', { error: visErr.message });
    }

    return { text: '', method: 'none' };
  }

  /**
   * Extract text from a single document attachment.
   * Returns empty string for images (handled separately as vision input).
   *
   * For PDFs: if pdf-parse returns minimal text (< 50 chars), assumes a scanned
   * document and tries OCR fallbacks (tesseract.js → OpenAI vision).
   * Sets `_ocrApplied` on the returned object when OCR was used.
   */
  static async extractText(
    attachment: AttachmentInput,
  ): Promise<string> {
    if (attachment.type === 'image') return '';

    const buffer = this.toBuffer(attachment.data);
    const mime = attachment.mimeType.toLowerCase();
    const ext = attachment.name.split('.').pop()?.toLowerCase();

    try {
      // ── PDF ───────────────────────────────────────────────────────
      if (mime === 'application/pdf' || ext === 'pdf') {
        // pdf-parse v2 uses a class-based API (same as extraction.service.ts)
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        const textData = await parser.getText();
        const pdfText = textData.text?.trim() || '';

        // Check for scanned/image-based PDF
        if (pdfText.length < this.SCANNED_PDF_THRESHOLD) {
          logger.info('PDF text extraction returned minimal text — attempting OCR fallback', {
            name: attachment.name,
            pdfParseChars: pdfText.length,
          });

          const { text: ocrText, method } = await this.ocrFallbackForPdf(buffer);
          if (ocrText && method !== 'none') {
            // Tag the result so callers know OCR was applied
            (this as any)._lastOcrMethod = method;
            return ocrText;
          }

          // OCR also failed — return whatever pdf-parse got (may be empty)
          logger.warn('All OCR fallbacks failed for scanned PDF', { name: attachment.name });
        }

        return pdfText;
      }

      // ── DOCX ──────────────────────────────────────────────────────
      if (
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        ext === 'docx'
      ) {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return result.value?.trim() || '';
      }

      // ── TXT / CSV (plain text) ────────────────────────────────────
      if (mime === 'text/plain' || mime === 'text/csv' || ext === 'txt' || ext === 'csv') {
        return buffer.toString('utf-8').trim();
      }

      // ── DOC (legacy) — basic fallback ─────────────────────────────
      if (mime === 'application/msword' || ext === 'doc') {
        // mammoth can sometimes handle older .doc files
        try {
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ buffer });
          return result.value?.trim() || '';
        } catch {
          return buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ').trim();
        }
      }

      logger.warn('Unsupported attachment MIME type for text extraction', {
        name: attachment.name,
        mimeType: attachment.mimeType,
      });
      return '';
    } catch (err: any) {
      logger.error('Failed to extract text from attachment', {
        name: attachment.name,
        mimeType: attachment.mimeType,
        error: err.message,
      });
      return '';
    }
  }

  /**
   * Internal extraction that returns both text and OCR metadata.
   */
  private static async extractTextWithMeta(
    attachment: AttachmentInput,
  ): Promise<{ text: string; ocrApplied: boolean; ocrMethod?: 'tesseract' | 'vision' }> {
    const text = await this.extractText(attachment);
    const ocrMethod = (this as any)._lastOcrMethod as 'tesseract' | 'vision' | undefined;
    // Reset the flag after reading
    (this as any)._lastOcrMethod = undefined;
    return {
      text,
      ocrApplied: !!ocrMethod,
      ocrMethod,
    };
  }

  /**
   * Extract text from all document attachments in a request.
   * Returns an array of { name, text, mimeType } for non-empty extractions.
   */
  static async extractAll(attachments: AttachmentInput[]): Promise<ExtractedText[]> {
    const docs = attachments.filter((a) => a.type === 'document');
    if (docs.length === 0) return [];

    const results = await Promise.all(
      docs.map(async (att) => {
        const text = await this.extractText(att);
        return text ? { name: att.name, text, mimeType: att.mimeType } : null;
      }),
    );

    return results.filter((r): r is ExtractedText => r !== null);
  }

  /** Max chars per document used in formatAsContext */
  static readonly MAX_CHARS_PER_DOC = 8000;

  /**
   * Extract text from all document attachments and return per-file status.
   * Unlike `extractAll`, this preserves information about failures and truncation.
   */
  static async extractAllWithStatus(
    attachments: AttachmentInput[],
  ): Promise<{ extracted: ExtractedText[]; statuses: ExtractionStatusItem[] }> {
    const docs = attachments.filter((a) => a.type === 'document');
    if (docs.length === 0) return { extracted: [], statuses: [] };

    const extracted: ExtractedText[] = [];
    const statuses: ExtractionStatusItem[] = [];

    await Promise.all(
      docs.map(async (att) => {
        const { text, ocrApplied, ocrMethod } = await this.extractTextWithMeta(att);
        if (!text) {
          statuses.push({
            name: att.name,
            status: 'failed',
            chars: 0,
            reason: ocrApplied
              ? 'OCR was attempted but could not extract readable text'
              : 'Could not extract text from this file',
          });
          return;
        }

        extracted.push({ name: att.name, text, mimeType: att.mimeType });

        const ocrNote = ocrApplied
          ? ` (OCR via ${ocrMethod === 'vision' ? 'AI vision' : 'tesseract'} — scanned PDF)`
          : '';

        if (text.length > this.MAX_CHARS_PER_DOC) {
          statuses.push({
            name: att.name,
            status: 'truncated',
            chars: text.length,
            reason: `Document was ${text.length.toLocaleString()} chars — smart-truncated to ${this.MAX_CHARS_PER_DOC.toLocaleString()}${ocrNote}`,
            ocrApplied,
          });
        } else {
          statuses.push({
            name: att.name,
            status: 'success',
            chars: text.length,
            ...(ocrApplied && {
              reason: `Text extracted via OCR${ocrNote}`,
              ocrApplied: true,
            }),
          });
        }
      }),
    );

    return { extracted, statuses };
  }

  /**
   * Format extracted document texts into a context block for the prompt.
   *
   * When a `question` is provided, uses smart truncation: splits each document
   * into ~500-char paragraphs, scores them by keyword overlap with the question,
   * and keeps the highest-scoring paragraphs (in document order) up to the char
   * budget.  This is a lightweight heuristic (no API call / no embeddings).
   *
   * When no question is provided, falls back to naive first-N-chars truncation.
   */
  static formatAsContext(
    extracted: ExtractedText[],
    question?: string,
  ): string {
    if (extracted.length === 0) return '';

    const MAX_CHARS_PER_DOC = 8000;
    const sections = extracted.map((doc, i) => {
      let text = doc.text;
      if (text.length > MAX_CHARS_PER_DOC) {
        text = question
          ? this.smartTruncate(text, question, MAX_CHARS_PER_DOC)
          : text.substring(0, MAX_CHARS_PER_DOC) + '\n... [truncated]';
      }
      return `=== Attached Document ${i + 1}: ${doc.name} ===\n${text}`;
    });

    return `\n\n## User-Attached Documents\nThe user has attached the following document(s) to their message. Use this content to answer their question.\n\n${sections.join('\n\n')}`;
  }

  // ── Smart truncation ────────────────────────────────────────────────

  /**
   * Split text into paragraph-sized chunks (~500 chars each).
   * Prefers splitting on double-newlines, then single newlines, then
   * sentence boundaries, and finally at the hard limit.
   */
  private static splitIntoParagraphs(text: string, targetSize = 500): Array<{ text: string; index: number }> {
    // First split on double-newline (real paragraph breaks)
    const rawBlocks = text.split(/\n{2,}/);
    const chunks: Array<{ text: string; index: number }> = [];
    let globalIdx = 0;

    for (const block of rawBlocks) {
      const trimmed = block.trim();
      if (!trimmed) {
        globalIdx++; // account for the split separator
        continue;
      }

      if (trimmed.length <= targetSize) {
        chunks.push({ text: trimmed, index: globalIdx });
      } else {
        // Sub-split long blocks on single newlines or sentence boundaries
        const subParts = trimmed.split(/(?<=\.)\s+|\n/);
        let buffer = '';
        for (const part of subParts) {
          if (buffer.length + part.length + 1 > targetSize && buffer.length > 0) {
            chunks.push({ text: buffer.trim(), index: globalIdx });
            globalIdx++;
            buffer = part;
          } else {
            buffer += (buffer ? ' ' : '') + part;
          }
        }
        if (buffer.trim()) {
          chunks.push({ text: buffer.trim(), index: globalIdx });
        }
      }
      globalIdx++;
    }

    return chunks;
  }

  /**
   * Extract lowercased keywords from a string.
   * Strips common stop-words so scoring focuses on meaningful terms.
   */
  private static extractKeywords(text: string): Set<string> {
    const STOP_WORDS = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
      'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
      'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
      'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
      'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
      'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
      'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
      'just', 'because', 'but', 'and', 'or', 'if', 'while', 'about', 'up',
      'its', 'it', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we',
      'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them',
      'their', 'what', 'which', 'who', 'whom', 'whose', 'tell', 'give',
      'show', 'find', 'get', 'make', 'also', 'like', 'many',
    ]);

    const words = text.toLowerCase().match(/[a-z0-9]{2,}/g) || [];
    return new Set(words.filter((w) => !STOP_WORDS.has(w)));
  }

  /**
   * Score a paragraph by keyword overlap with the question.
   * Returns a value between 0 and 1.
   */
  private static scoreChunk(chunkText: string, questionKeywords: Set<string>): number {
    if (questionKeywords.size === 0) return 0;
    const chunkWords = this.extractKeywords(chunkText);
    let hits = 0;
    for (const kw of questionKeywords) {
      if (chunkWords.has(kw)) hits++;
    }
    return hits / questionKeywords.size;
  }

  /**
   * Smart-truncate a document to fit within `maxChars` by keeping the
   * paragraphs most relevant to the user's question, in their original
   * document order.
   *
   * Algorithm:
   *  1. Split the document into ~500-char paragraphs.
   *  2. Score each paragraph by keyword overlap with the question.
   *  3. Always include the first paragraph (document intro / context).
   *  4. Sort remaining by score descending; pick top-K that fit the budget.
   *  5. Re-sort selected paragraphs by their original document order.
   *  6. Join and return.
   */
  static smartTruncate(text: string, question: string, maxChars: number): string {
    const chunks = this.splitIntoParagraphs(text);
    if (chunks.length === 0) return text.substring(0, maxChars);
    if (chunks.length === 1) return chunks[0].text.substring(0, maxChars);

    const questionKeywords = this.extractKeywords(question);

    // Always keep the first paragraph for document context
    const first = chunks[0];
    const scored = chunks.slice(1).map((c) => ({
      ...c,
      score: this.scoreChunk(c.text, questionKeywords),
    }));

    // Sort by score descending (ties broken by earlier position)
    scored.sort((a, b) => b.score - a.score || a.index - b.index);

    // Greedily pick chunks that fit
    const selected: Array<{ text: string; index: number }> = [first];
    let budget = maxChars - first.text.length;

    for (const chunk of scored) {
      const needed = chunk.text.length + 2; // +2 for join separator
      if (needed <= budget) {
        selected.push(chunk);
        budget -= needed;
      }
      if (budget <= 0) break;
    }

    // Re-sort by original document order
    selected.sort((a, b) => a.index - b.index);

    const result = selected.map((c) => c.text).join('\n\n');
    const suffix = selected.length < chunks.length
      ? '\n... [less relevant sections omitted]'
      : '';

    return result + suffix;
  }
}

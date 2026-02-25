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

export class AttachmentExtractorService {
  /**
   * Strip the data-URI prefix and return raw base64 bytes as a Buffer.
   */
  private static toBuffer(dataUri: string): Buffer {
    // data:image/png;base64,iVBOR... → iVBOR...
    const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
    return Buffer.from(base64, 'base64');
  }

  /**
   * Extract text from a single document attachment.
   * Returns empty string for images (handled separately as vision input).
   */
  static async extractText(attachment: AttachmentInput): Promise<string> {
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
        return textData.text?.trim() || '';
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

  /**
   * Format extracted document texts into a context block for the prompt.
   * Truncates each document to ~8000 chars to manage token budget.
   */
  static formatAsContext(extracted: ExtractedText[]): string {
    if (extracted.length === 0) return '';

    const MAX_CHARS_PER_DOC = 8000;
    const sections = extracted.map((doc, i) => {
      let text = doc.text;
      if (text.length > MAX_CHARS_PER_DOC) {
        text = text.substring(0, MAX_CHARS_PER_DOC) + '\n... [truncated]';
      }
      return `=== Attached Document ${i + 1}: ${doc.name} ===\n${text}`;
    });

    return `\n\n## User-Attached Documents\nThe user has attached the following document(s) to their message. Use this content to answer their question.\n\n${sections.join('\n\n')}`;
  }
}

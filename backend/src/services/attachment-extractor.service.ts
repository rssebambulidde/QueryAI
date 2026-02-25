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
        const text = await this.extractText(att);
        if (!text) {
          statuses.push({
            name: att.name,
            status: 'failed',
            chars: 0,
            reason: 'Could not extract text from this file',
          });
          return;
        }

        extracted.push({ name: att.name, text, mimeType: att.mimeType });

        if (text.length > this.MAX_CHARS_PER_DOC) {
          statuses.push({
            name: att.name,
            status: 'truncated',
            chars: text.length,
            reason: `Document was ${text.length.toLocaleString()} chars — smart-truncated to ${this.MAX_CHARS_PER_DOC.toLocaleString()}`,
          });
        } else {
          statuses.push({
            name: att.name,
            status: 'success',
            chars: text.length,
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

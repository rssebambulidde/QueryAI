/**
 * Conversation Export Service
 *
 * Generates full conversation exports in Markdown, PDF, and DOCX formats
 * with per-message footnotes/sources and a deduplicated bibliography section.
 *
 * Key design:
 *  1.  Parse markdown answer content into structured ContentBlocks
 *      (paragraphs, headings, bullets, numbered lists, code blocks).
 *  2.  Render each block with proper visual formatting in both PDF and DOCX,
 *      preserving bold, inline code, and list structure.
 */

import PDFDocument from 'pdfkit';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ExternalHyperlink,
  BorderStyle,
  Footer,
  Header,
  PageNumber,
  NumberFormat,
  ShadingType,
  convertInchesToTwip,
} from 'docx';
import { Database } from '../types/database';
import logger from '../config/logger';

// ── Public types ───────────────────────────────────────────────────────

export type ExportFormat = 'pdf' | 'markdown' | 'docx';

export interface ExportOptions {
  format: ExportFormat;
  includeSources?: boolean;       // default true
  includeBibliography?: boolean;  // default true
}

export interface ExportResult {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

// ── Internal types ─────────────────────────────────────────────────────

interface SourceEntry {
  type: 'document' | 'web';
  title: string;
  url?: string;
  snippet?: string;
  globalIndex: number; // 1-based bibliography number
}

/** A parsed block of answer content */
interface ContentBlock {
  type: 'paragraph' | 'heading' | 'bullet' | 'numbered' | 'codeBlock' | 'separator';
  runs?: InlineRun[];
  text?: string;        // codeBlock raw text
  level?: number;       // heading level (1-6)
  num?: number;         // numbered list ordinal
  language?: string;    // code block language hint
}

/** An inline run within a paragraph / list item / heading */
interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

// ── Small helpers ──────────────────────────────────────────────────────

function sourceKey(s: { title?: string; url?: string; type?: string }): string {
  return `${s.type || ''}|${(s.url || s.title || '').toLowerCase().trim()}`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return dateStr; }
}

function sanitizeFilename(name: string): string {
  return (name || 'conversation')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

// ── Citation replacement ───────────────────────────────────────────────

/** Replace [Web Source N] / [Document N] / [Source N] with [globalIndex] */
function replaceCitationsWithFootnotes(
  content: string,
  messageSources: Array<Record<string, any>>,
  globalMap: Map<string, SourceEntry>,
): string {
  let result = content;
  messageSources.forEach((src, idx) => {
    const key = sourceKey(src);
    const entry = globalMap.get(key);
    if (!entry) return;
    const num = entry.globalIndex;
    for (const pat of [
      new RegExp(`\\[Web Source\\s+${idx + 1}\\]`, 'gi'),
      new RegExp(`\\[Document\\s+${idx + 1}\\]`, 'gi'),
      new RegExp(`\\[Source\\s+${idx + 1}\\]`, 'gi'),
    ]) {
      result = result.replace(pat, `[${num}]`);
    }
  });
  return result;
}

// ── Markdown → structured blocks parser ────────────────────────────────

/**
 * Parse inline formatting: **bold**, `code`.
 * Returns an array of InlineRun objects preserving text order.
 */
function parseInlineRuns(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  // Bold (**…** or __…__) and inline code (`…`)
  const re = /(\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    if (m[2] || m[3]) runs.push({ text: m[2] || m[3], bold: true });
    else if (m[4]) runs.push({ text: m[4], code: true });
    last = re.lastIndex;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs.length > 0 ? runs : [{ text }];
}

/**
 * Parse markdown answer content into a list of ContentBlock items,
 * preserving headings, bullet / numbered lists, code blocks, and paragraphs.
 */
function parseMarkdownBlocks(raw: string): ContentBlock[] {
  // Remove follow-up questions tail
  const content = raw.replace(/FOLLOW_UP_QUESTIONS:[\s\S]*$/i, '').trim();
  // Remove markdown link syntax but keep label text
  const cleaned = content.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  const blocks: ContentBlock[] = [];
  const lines = cleaned.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines
    if (!line.trim()) { i++; continue; }

    // ── Code block ──
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      blocks.push({ type: 'codeBlock', text: codeLines.join('\n'), language: lang || undefined });
      continue;
    }

    // ── Heading ──
    const hMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (hMatch) {
      blocks.push({ type: 'heading', level: hMatch[1].length, runs: parseInlineRuns(hMatch[2]) });
      i++;
      continue;
    }

    // ── Horizontal rule ──
    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      blocks.push({ type: 'separator' });
      i++;
      continue;
    }

    // ── Bullet list (consecutive lines starting with - / * / +) ──
    if (/^\s*[-*+]\s/.test(line)) {
      while (i < lines.length && /^\s*[-*+]\s/.test(lines[i])) {
        const text = lines[i].replace(/^\s*[-*+]\s+/, '');
        blocks.push({ type: 'bullet', runs: parseInlineRuns(text) });
        i++;
      }
      continue;
    }

    // ── Numbered list ──
    const nMatch = line.match(/^\s*(\d+)\.\s+(.+)/);
    if (nMatch) {
      while (i < lines.length) {
        const nm = lines[i].match(/^\s*(\d+)\.\s+(.+)/);
        if (!nm) break;
        blocks.push({ type: 'numbered', num: parseInt(nm[1], 10), runs: parseInlineRuns(nm[2]) });
        i++;
      }
      continue;
    }

    // ── Blockquote → treat as paragraph ──
    if (line.startsWith('>')) {
      const text = line.replace(/^>\s*/, '');
      blocks.push({ type: 'paragraph', runs: parseInlineRuns(text) });
      i++;
      continue;
    }

    // ── Regular paragraph — collect contiguous non-special lines ──
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].match(/^#{1,6}\s/) &&
      !lines[i].match(/^\s*[-*+]\s/) &&
      !lines[i].match(/^\s*\d+\.\s/) &&
      !/^[-*_]{3,}\s*$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', runs: parseInlineRuns(paraLines.join(' ')) });
    }
  }

  return blocks;
}

/** Flatten an answer's markdown to plain text (used by the Markdown export) */
function stripMarkdown(text: string): string {
  return text
    .replace(/FOLLOW_UP_QUESTIONS:[\s\S]*$/i, '')
    .replace(/^#{1,6}\s+(.+)$/gm, '$1')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/^[-*_]{3,}$/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[\s]*[-*+]\s/gm, '• ')
    .replace(/^[\s]*\d+\.\s/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ════════════════════════════════════════════════════════════════════════
// Service
// ════════════════════════════════════════════════════════════════════════

export class ExportService {
  /**
   * Export a conversation with messages to the requested format.
   */
  static async exportConversation(
    conversation: Database.Conversation,
    messages: Database.Message[],
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { format, includeSources = true, includeBibliography = true } = options;
    const baseName = sanitizeFilename(conversation.title || 'conversation');

    // Build global deduplicated source bibliography
    const globalMap = new Map<string, SourceEntry>();
    let globalIdx = 0;
    if (includeSources) {
      for (const msg of messages) {
        if (msg.role !== 'assistant' || !msg.sources) continue;
        for (const src of msg.sources) {
          const key = sourceKey(src);
          if (!globalMap.has(key)) {
            globalIdx++;
            globalMap.set(key, {
              type: (src.type as 'document' | 'web') || 'web',
              title: src.title || `Source ${globalIdx}`,
              url: src.url,
              snippet: src.snippet,
              globalIndex: globalIdx,
            });
          }
        }
      }
    }

    switch (format) {
      case 'markdown':
        return this.toMarkdown(conversation, messages, globalMap, baseName, includeSources, includeBibliography);
      case 'pdf':
        return this.toPdf(conversation, messages, globalMap, baseName, includeSources, includeBibliography);
      case 'docx':
        return this.toDocx(conversation, messages, globalMap, baseName, includeSources, includeBibliography);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Markdown
  // ═══════════════════════════════════════════════════════════════════

  private static toMarkdown(
    conversation: Database.Conversation,
    messages: Database.Message[],
    globalMap: Map<string, SourceEntry>,
    baseName: string,
    includeSources: boolean,
    includeBibliography: boolean,
  ): ExportResult {
    const lines: string[] = [];
    const title = conversation.title || 'Untitled Conversation';
    const date = formatDate(conversation.created_at);

    lines.push(`# ${title}`);
    lines.push('');
    lines.push(`**Date:** ${date}`);
    lines.push(`**Exported:** ${formatDate(new Date().toISOString())}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    let questionNum = 0;
    for (const msg of messages) {
      if (msg.role === 'user') {
        questionNum++;
        lines.push(`## Question ${questionNum}`);
        lines.push('');
        lines.push(msg.content);
        lines.push('');
      } else if (msg.role === 'assistant') {
        lines.push('### Answer');
        lines.push('');
        let content = stripMarkdown(msg.content);
        if (includeSources && msg.sources?.length) {
          content = replaceCitationsWithFootnotes(content, msg.sources, globalMap);
        }
        lines.push(content);
        lines.push('');

        if (includeSources && msg.sources?.length) {
          lines.push('**Sources:**');
          for (const src of msg.sources) {
            const entry = globalMap.get(sourceKey(src));
            if (entry) {
              const url = entry.url ? ` (${entry.url})` : '';
              lines.push(`[${entry.globalIndex}] ${entry.title}${url}`);
            }
          }
          lines.push('');
        }
        lines.push('---');
        lines.push('');
      }
    }

    if (includeBibliography && globalMap.size > 0) {
      lines.push('## Bibliography');
      lines.push('');
      const sorted = [...globalMap.values()].sort((a, b) => a.globalIndex - b.globalIndex);
      for (const entry of sorted) {
        const url = entry.url ? ` — ${entry.url}` : '';
        const accessed = `, accessed ${formatDate(new Date().toISOString())}`;
        lines.push(`${entry.globalIndex}. ${entry.title}${url}${accessed}`);
      }
      lines.push('');
    }

    return {
      buffer: Buffer.from(lines.join('\n'), 'utf-8'),
      mimeType: 'text/markdown; charset=utf-8',
      filename: `${baseName}.md`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // PDF  (pdfkit)
  // ═══════════════════════════════════════════════════════════════════

  private static async toPdf(
    conversation: Database.Conversation,
    messages: Database.Message[],
    globalMap: Map<string, SourceEntry>,
    baseName: string,
    includeSources: boolean,
    includeBibliography: boolean,
  ): Promise<ExportResult> {
    return new Promise((resolve, reject) => {
      try {
        const LEFT = 50;
        const RIGHT = 50;
        const TOP = 55;
        const BOTTOM = 60;

        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: TOP, bottom: BOTTOM, left: LEFT, right: RIGHT },
          bufferPages: true,  // needed for page-number footer
          info: {
            Title: conversation.title || 'Conversation Export',
            Author: 'QueryAI',
            Creator: 'QueryAI Export Service',
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => {
          resolve({
            buffer: Buffer.concat(chunks),
            mimeType: 'application/pdf',
            filename: `${baseName}.pdf`,
          });
        });
        doc.on('error', reject);

        const PAGE_W = doc.page.width;
        const PW = PAGE_W - LEFT - RIGHT;   // printable width
        const PH = doc.page.height;
        const FOOT_Y = PH - BOTTOM + 15;
        const SAFE_Y = PH - BOTTOM - 10;    // stop rendering here

        const BRAND_COLOR = '#E65100';       // orange-800
        const GRAY_600 = '#555555';
        const GRAY_400 = '#999999';
        const GRAY_200 = '#DDDDDD';
        const CODE_BG = '#F5F5F5';

        const title = conversation.title || 'Untitled Conversation';
        const date = formatDate(conversation.created_at);
        const exportDate = formatDate(new Date().toISOString());

        // ── Helpers ──────────────────────────────────────────────
        const ensureSpace = (need: number) => {
          if (doc.y + need > SAFE_Y) doc.addPage();
        };

        /** Render an array of InlineRuns at current cursor */
        const renderRuns = (runs: InlineRun[], fontSize: number, color = '#000000') => {
          doc.fontSize(fontSize).fillColor(color);
          for (let r = 0; r < runs.length; r++) {
            const run = runs[r];
            const isLast = r === runs.length - 1;
            if (run.bold) doc.font('Helvetica-Bold');
            else if (run.code) doc.font('Courier');
            else doc.font('Helvetica');
            doc.text(run.text, { width: PW, continued: !isLast, lineGap: 2 });
          }
          doc.font('Helvetica').fillColor('#000000');
        };

        // ── Header ───────────────────────────────────────────────
        doc.fontSize(22).font('Helvetica-Bold').fillColor(BRAND_COLOR)
          .text('QueryAI', LEFT, TOP, { width: PW });
        doc.moveDown(0.15);

        doc.fontSize(16).font('Helvetica-Bold').fillColor('#1A1A1A')
          .text(title, { width: PW });
        doc.moveDown(0.25);

        doc.fontSize(9).font('Helvetica').fillColor(GRAY_400)
          .text(`Date: ${date}   •   Exported: ${exportDate}`, { width: PW });
        doc.moveDown(0.5);

        // Orange accent line
        const lineY = doc.y;
        doc.moveTo(LEFT, lineY).lineTo(LEFT + PW, lineY)
          .strokeColor(BRAND_COLOR).lineWidth(1.5).stroke();
        doc.moveDown(1.2);

        // ── Messages ─────────────────────────────────────────────
        let questionNum = 0;
        for (const msg of messages) {
          if (msg.role === 'user') {
            questionNum++;
            ensureSpace(60);

            // Question label
            doc.fontSize(13).font('Helvetica-Bold').fillColor(BRAND_COLOR)
              .text(`Question ${questionNum}`, { width: PW });
            doc.moveDown(0.25);

            // Question text in a light background box
            doc.fontSize(11).font('Helvetica');
            const qTextHeight = doc.heightOfString(msg.content, { width: PW - 20 });
            const boxTop = doc.y;
            const boxH = qTextHeight + 16;
            ensureSpace(boxH + 10);

            doc.save();
            doc.roundedRect(LEFT, doc.y, PW, boxH, 4).fill('#FFF3E0'); // light orange bg
            doc.restore();

            // Orange left accent bar
            doc.save();
            doc.roundedRect(LEFT, doc.y, 3, boxH, 1.5).fill(BRAND_COLOR);
            doc.restore();

            doc.fontSize(11).font('Helvetica').fillColor('#333333')
              .text(msg.content, LEFT + 12, boxTop + 8, { width: PW - 20, lineGap: 2 });
            doc.y = boxTop + boxH + 10;
            doc.x = LEFT;

          } else if (msg.role === 'assistant') {
            ensureSpace(40);

            // Answer label
            doc.fontSize(12).font('Helvetica-Bold').fillColor(GRAY_600)
              .text('Answer', LEFT, doc.y, { width: PW });
            doc.moveDown(0.3);

            // Parse answer markdown into blocks
            let answerContent = msg.content;
            if (includeSources && msg.sources?.length) {
              answerContent = replaceCitationsWithFootnotes(answerContent, msg.sources, globalMap);
            }
            const blocks = parseMarkdownBlocks(answerContent);

            for (const block of blocks) {
              switch (block.type) {
                case 'heading': {
                  ensureSpace(25);
                  const hSize = block.level === 1 ? 13 : block.level === 2 ? 12 : 11;
                  doc.font('Helvetica-Bold').fontSize(hSize).fillColor('#222222');
                  if (block.runs) renderRuns(block.runs, hSize, '#222222');
                  doc.moveDown(0.35);
                  break;
                }
                case 'bullet': {
                  ensureSpace(15);
                  doc.font('Helvetica').fontSize(10.5).fillColor('#000000');
                  const bulletX = LEFT + 12;
                  doc.text('•', bulletX, doc.y, { continued: true, width: PW - 12 });
                  doc.text('  ', { continued: true });
                  if (block.runs) {
                    for (let r = 0; r < block.runs.length; r++) {
                      const run = block.runs[r];
                      const isLast = r === block.runs.length - 1;
                      if (run.bold) doc.font('Helvetica-Bold');
                      else if (run.code) doc.font('Courier');
                      else doc.font('Helvetica');
                      doc.text(run.text, { width: PW - 24, continued: !isLast, lineGap: 1.5 });
                    }
                    doc.font('Helvetica');
                  }
                  doc.moveDown(0.15);
                  break;
                }
                case 'numbered': {
                  ensureSpace(15);
                  doc.font('Helvetica').fontSize(10.5).fillColor('#000000');
                  const numX = LEFT + 12;
                  doc.text(`${block.num}.`, numX, doc.y, { continued: true, width: PW - 12 });
                  doc.text(' ', { continued: true });
                  if (block.runs) {
                    for (let r = 0; r < block.runs.length; r++) {
                      const run = block.runs[r];
                      const isLast = r === block.runs.length - 1;
                      if (run.bold) doc.font('Helvetica-Bold');
                      else if (run.code) doc.font('Courier');
                      else doc.font('Helvetica');
                      doc.text(run.text, { width: PW - 28, continued: !isLast, lineGap: 1.5 });
                    }
                    doc.font('Helvetica');
                  }
                  doc.moveDown(0.15);
                  break;
                }
                case 'codeBlock': {
                  const code = block.text || '';
                  doc.font('Courier').fontSize(9);
                  const codeH = doc.heightOfString(code, { width: PW - 24 }) + 16;
                  ensureSpace(codeH + 8);
                  const cbTop = doc.y;
                  doc.save();
                  doc.roundedRect(LEFT + 4, cbTop, PW - 8, codeH, 4).fill(CODE_BG);
                  doc.restore();
                  doc.font('Courier').fontSize(9).fillColor('#333333')
                    .text(code, LEFT + 16, cbTop + 8, { width: PW - 24, lineGap: 1.5 });
                  doc.y = cbTop + codeH + 6;
                  doc.x = LEFT;
                  break;
                }
                case 'separator': {
                  doc.moveDown(0.3);
                  doc.moveTo(LEFT + 20, doc.y).lineTo(LEFT + PW - 20, doc.y)
                    .strokeColor(GRAY_200).lineWidth(0.4).stroke();
                  doc.moveDown(0.4);
                  break;
                }
                default: { // paragraph
                  ensureSpace(18);
                  if (block.runs) renderRuns(block.runs, 10.5);
                  doc.moveDown(0.45);
                  break;
                }
              }
            }

            // ── Per-message sources ──
            if (includeSources && msg.sources?.length) {
              ensureSpace(20);
              doc.moveDown(0.2);
              doc.fontSize(9).font('Helvetica-Bold').fillColor(GRAY_600)
                .text('Sources', LEFT, doc.y, { width: PW });
              doc.moveDown(0.15);

              for (const src of msg.sources) {
                const entry = globalMap.get(sourceKey(src));
                if (!entry) continue;
                ensureSpace(12);
                const num = entry.globalIndex;
                const srcTitle = entry.title;
                doc.font('Helvetica-Bold').fontSize(8.5).fillColor(GRAY_600)
                  .text(`[${num}]`, LEFT + 8, doc.y, { continued: true, width: PW - 8 });
                doc.font('Helvetica').text(` ${srcTitle}`, { width: PW - 30, lineGap: 1 });
                if (entry.url) {
                  doc.fontSize(7.5).fillColor('#1565C0')
                    .text(entry.url.length > 80 ? entry.url.slice(0, 77) + '…' : entry.url,
                      LEFT + 24, doc.y, { width: PW - 30, lineGap: 0.5 });
                }
                doc.fillColor('#000000');
              }
            }

            // Separator between Q&A pairs
            doc.moveDown(0.6);
            doc.moveTo(LEFT, doc.y).lineTo(LEFT + PW, doc.y)
              .strokeColor('#EEEEEE').lineWidth(0.5).stroke();
            doc.moveDown(0.8);
          }
        }

        // ── Bibliography ──────────────────────────────────────────
        if (includeBibliography && globalMap.size > 0) {
          ensureSpace(50);
          doc.moveDown(0.5);
          doc.fontSize(15).font('Helvetica-Bold').fillColor('#222222')
            .text('Bibliography', LEFT, doc.y, { width: PW });
          doc.moveDown(0.5);

          const sorted = [...globalMap.values()].sort((a, b) => a.globalIndex - b.globalIndex);
          for (const entry of sorted) {
            ensureSpace(22);
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000')
              .text(`${entry.globalIndex}.`, LEFT + 4, doc.y, { continued: true, width: PW });
            doc.font('Helvetica')
              .text(` ${entry.title}`, { continued: !!entry.url, width: PW - 20, lineGap: 1 });
            if (entry.url) {
              doc.text('');  // end continued
              doc.fontSize(8.5).fillColor('#1565C0')
                .text(entry.url.length > 90 ? entry.url.slice(0, 87) + '…' : entry.url,
                  LEFT + 18, doc.y, { width: PW - 24, lineGap: 0.5 });
            }
            doc.fillColor('#000000');
            doc.moveDown(0.25);
          }
        }

        // ── Page numbers (footer on every page) ──────────────────
        const pages = doc.bufferedPageRange();
        const total = pages.count;
        for (let p = pages.start; p < pages.start + total; p++) {
          doc.switchToPage(p);
          doc.fontSize(8).font('Helvetica').fillColor(GRAY_400);
          doc.text(
            `QueryAI  •  Page ${p + 1} of ${total}`,
            LEFT, FOOT_Y,
            { width: PW, align: 'center' },
          );
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // DOCX  (docx npm package)
  // ═══════════════════════════════════════════════════════════════════

  private static async toDocx(
    conversation: Database.Conversation,
    messages: Database.Message[],
    globalMap: Map<string, SourceEntry>,
    baseName: string,
    includeSources: boolean,
    includeBibliography: boolean,
  ): Promise<ExportResult> {
    const title = conversation.title || 'Untitled Conversation';
    const date = formatDate(conversation.created_at);
    const exportDate = formatDate(new Date().toISOString());
    const children: Paragraph[] = [];

    // ── Helpers ──────────────────────────────────────────────
    /** Convert InlineRun[] to TextRun[] for docx */
    const toTextRuns = (runs: InlineRun[], baseSizePt = 11, baseColor = '000000'): TextRun[] =>
      runs.map((r) => {
        if (r.bold) return new TextRun({ text: r.text, bold: true, size: baseSizePt * 2, color: baseColor });
        if (r.code) return new TextRun({ text: r.text, font: 'Courier New', size: baseSizePt * 2, color: '333333', shading: { type: ShadingType.SOLID, color: 'F0F0F0', fill: 'F0F0F0' } });
        return new TextRun({ text: r.text, size: baseSizePt * 2, color: baseColor });
      });

    // ── Title section ────────────────────────────────────────
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'QueryAI', size: 20, color: 'E65100', font: 'Helvetica' }),
        ],
        spacing: { after: 40 },
      }),
    );
    children.push(
      new Paragraph({
        children: [new TextRun({ text: title, bold: true, size: 36, color: '1A1A1A' })],
        spacing: { after: 80 },
      }),
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Date: ${date}   •   Exported: ${exportDate}`, size: 18, color: '888888' }),
        ],
        spacing: { after: 160 },
      }),
    );
    // Orange accent line
    children.push(
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'E65100' } },
        spacing: { after: 360 },
      }),
    );

    // ── Messages ─────────────────────────────────────────────
    let questionNum = 0;
    for (const msg of messages) {
      if (msg.role === 'user') {
        questionNum++;

        // "Question N" heading
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `Question ${questionNum}`, bold: true, size: 26, color: 'E65100' })],
            spacing: { before: 320, after: 100 },
          }),
        );

        // Question text with light orange shading and left border
        children.push(
          new Paragraph({
            children: [new TextRun({ text: msg.content, size: 22, color: '333333' })],
            spacing: { after: 200, line: 300 },
            indent: { left: convertInchesToTwip(0.15) },
            border: {
              left: { style: BorderStyle.SINGLE, size: 12, color: 'E65100', space: 8 },
            },
            shading: { type: ShadingType.SOLID, color: 'FFF3E0', fill: 'FFF3E0' },
          }),
        );

      } else if (msg.role === 'assistant') {
        // "Answer" heading
        children.push(
          new Paragraph({
            children: [new TextRun({ text: 'Answer', bold: true, size: 24, color: '444444' })],
            spacing: { before: 120, after: 100 },
          }),
        );

        // Parse content blocks
        let answerContent = msg.content;
        if (includeSources && msg.sources?.length) {
          answerContent = replaceCitationsWithFootnotes(answerContent, msg.sources, globalMap);
        }
        const blocks = parseMarkdownBlocks(answerContent);

        for (const block of blocks) {
          switch (block.type) {
            case 'heading': {
              const hlevel = (block.level || 2) <= 2 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_4;
              children.push(
                new Paragraph({
                  children: toTextRuns(block.runs || [], block.level === 1 ? 13 : 12, '222222'),
                  heading: hlevel,
                  spacing: { before: 200, after: 80 },
                }),
              );
              break;
            }
            case 'bullet': {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: '•  ', size: 22 }),
                    ...toTextRuns(block.runs || [], 11),
                  ],
                  spacing: { after: 60, line: 276 },
                  indent: { left: convertInchesToTwip(0.35), hanging: convertInchesToTwip(0.2) },
                }),
              );
              break;
            }
            case 'numbered': {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: `${block.num}.  `, size: 22, bold: true }),
                    ...toTextRuns(block.runs || [], 11),
                  ],
                  spacing: { after: 60, line: 276 },
                  indent: { left: convertInchesToTwip(0.35), hanging: convertInchesToTwip(0.25) },
                }),
              );
              break;
            }
            case 'codeBlock': {
              const codeText = block.text || '';
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: codeText, font: 'Courier New', size: 18, color: '333333' }),
                  ],
                  spacing: { before: 100, after: 100, line: 260 },
                  indent: { left: convertInchesToTwip(0.2), right: convertInchesToTwip(0.2) },
                  shading: { type: ShadingType.SOLID, color: 'F5F5F5', fill: 'F5F5F5' },
                }),
              );
              break;
            }
            case 'separator': {
              children.push(
                new Paragraph({
                  border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' } },
                  spacing: { before: 120, after: 120 },
                }),
              );
              break;
            }
            default: {
              // paragraph
              children.push(
                new Paragraph({
                  children: toTextRuns(block.runs || [], 11),
                  spacing: { after: 120, line: 276 },
                }),
              );
              break;
            }
          }
        }

        // ── Per-message sources ──
        if (includeSources && msg.sources?.length) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: 'Sources', bold: true, size: 18, color: '555555' })],
              spacing: { before: 160, after: 60 },
            }),
          );
          for (const src of msg.sources) {
            const entry = globalMap.get(sourceKey(src));
            if (!entry) continue;
            const footnoteChildren: (TextRun | ExternalHyperlink)[] = [
              new TextRun({ text: `[${entry.globalIndex}]  `, bold: true, size: 18, color: '555555' }),
              new TextRun({ text: entry.title, size: 18, color: '555555' }),
            ];
            if (entry.url) {
              footnoteChildren.push(
                new TextRun({ text: '  —  ', size: 18, color: '999999' }),
                new ExternalHyperlink({
                  children: [new TextRun({ text: entry.url.length > 70 ? entry.url.slice(0, 67) + '…' : entry.url, color: '1565C0', size: 16, underline: {} })],
                  link: entry.url,
                }),
              );
            }
            children.push(
              new Paragraph({
                children: footnoteChildren,
                spacing: { after: 40 },
                indent: { left: convertInchesToTwip(0.2) },
              }),
            );
          }
        }

        // Q&A separator
        children.push(
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'EEEEEE' } },
            spacing: { before: 240, after: 280 },
          }),
        );
      }
    }

    // ── Bibliography ─────────────────────────────────────────
    if (includeBibliography && globalMap.size > 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: 'Bibliography', bold: true, size: 32, color: '222222' })],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
      );

      const sorted = [...globalMap.values()].sort((a, b) => a.globalIndex - b.globalIndex);
      for (const entry of sorted) {
        const bibChildren: (TextRun | ExternalHyperlink)[] = [
          new TextRun({ text: `${entry.globalIndex}.  `, bold: true, size: 20 }),
          new TextRun({ text: entry.title, size: 20 }),
        ];
        if (entry.url) {
          bibChildren.push(
            new TextRun({ text: '\n', size: 20 }),
            new TextRun({ text: '     ', size: 20 }),
            new ExternalHyperlink({
              children: [new TextRun({ text: entry.url, color: '1565C0', size: 18, underline: {} })],
              link: entry.url,
            }),
          );
        }
        bibChildren.push(
          new TextRun({ text: `\n     Accessed ${formatDate(new Date().toISOString())}`, size: 18, color: '888888', italics: true }),
        );
        children.push(
          new Paragraph({
            children: bibChildren,
            spacing: { after: 140, line: 260 },
            indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.25) },
          }),
        );
      }
    }

    // ── Assemble Document ────────────────────────────────────
    const document = new Document({
      creator: 'QueryAI',
      title,
      description: `Exported conversation: ${title}`,
      styles: {
        default: {
          document: {
            run: { font: 'Calibri', size: 22, color: '000000' },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1200, bottom: 1200, left: 1080, right: 1080 },
              pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({ text: 'QueryAI  •  ', size: 14, color: '999999', font: 'Calibri' }),
                    new TextRun({ text: title.length > 40 ? title.slice(0, 37) + '…' : title, size: 14, color: '999999', italics: true }),
                  ],
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ text: 'Page ', size: 16, color: '999999' }),
                    new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '999999' }),
                    new TextRun({ text: ' of ', size: 16, color: '999999' }),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '999999' }),
                  ],
                }),
              ],
            }),
          },
          children,
        },
      ],
    });

    const buffer = await Packer.toBuffer(document);
    return {
      buffer: Buffer.from(buffer),
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      filename: `${baseName}.docx`,
    };
  }
}

/**
 * Conversation Export Service
 *
 * Generates full conversation exports in Markdown, PDF, and DOCX formats
 * with per-message footnotes and a deduplicated bibliography section.
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
  PageBreak,
  BorderStyle,
  Footer,
  PageNumber,
  NumberFormat,
} from 'docx';
import { Database } from '../types/database';
import logger from '../config/logger';

// ── Types ──────────────────────────────────────────────────────────────

export type ExportFormat = 'pdf' | 'markdown' | 'docx';

export interface ExportOptions {
  format: ExportFormat;
  includeSources?: boolean;   // default true
  includeBibliography?: boolean; // default true
}

export interface ExportResult {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

interface SourceEntry {
  type: 'document' | 'web';
  title: string;
  url?: string;
  snippet?: string;
  globalIndex: number; // 1-based bibliography number
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Unique key for deduplication */
function sourceKey(s: { title?: string; url?: string; type?: string }): string {
  return `${s.type || ''}|${(s.url || s.title || '').toLowerCase().trim()}`;
}

/** Strip markdown formatting to plain prose */
function stripMarkdown(text: string): string {
  return text
    // Remove follow-up questions block
    .replace(/FOLLOW_UP_QUESTIONS:[\s\S]*$/i, '')
    // Headers → text + newline
    .replace(/^#{1,6}\s+(.+)$/gm, '$1')
    // Bold / italic
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    // Inline code
    .replace(/`([^`]+)`/g, '$1')
    // Code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Links → text (URL)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    // Images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Blockquotes
    .replace(/^>\s?/gm, '')
    // Unordered lists
    .replace(/^[\s]*[-*+]\s/gm, '• ')
    // Ordered lists
    .replace(/^[\s]*\d+\.\s/gm, '')
    // Extra blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Replace citation patterns [Web Source N] / [Document N] with footnote numbers */
function replaceCitationsWithFootnotes(
  content: string,
  messageSources: Array<Record<string, any>>,
  globalMap: Map<string, SourceEntry>
): string {
  let result = content;
  messageSources.forEach((src, idx) => {
    const key = sourceKey(src);
    const entry = globalMap.get(key);
    if (!entry) return;
    const num = entry.globalIndex;
    // Replace various citation patterns
    const patterns = [
      new RegExp(`\\[Web Source\\s+${idx + 1}\\]`, 'gi'),
      new RegExp(`\\[Document\\s+${idx + 1}\\]`, 'gi'),
      new RegExp(`\\[Source\\s+${idx + 1}\\]`, 'gi'),
    ];
    for (const pat of patterns) {
      result = result.replace(pat, `[${num}]`);
    }
  });
  return result;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function sanitizeFilename(name: string): string {
  return (name || 'conversation')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

// ── Service ────────────────────────────────────────────────────────────

export class ExportService {
  /**
   * Export a conversation with messages to the requested format.
   */
  static async exportConversation(
    conversation: Database.Conversation,
    messages: Database.Message[],
    options: ExportOptions
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
    includeBibliography: boolean
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

        // Per-message footnotes
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

    // Bibliography
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

    const content = lines.join('\n');
    return {
      buffer: Buffer.from(content, 'utf-8'),
      mimeType: 'text/markdown; charset=utf-8',
      filename: `${baseName}.md`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // PDF (pdfkit)
  // ═══════════════════════════════════════════════════════════════════

  private static async toPdf(
    conversation: Database.Conversation,
    messages: Database.Message[],
    globalMap: Map<string, SourceEntry>,
    baseName: string,
    includeSources: boolean,
    includeBibliography: boolean
  ): Promise<ExportResult> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 60, bottom: 60, left: 50, right: 50 },
          info: {
            Title: conversation.title || 'Conversation Export',
            Author: 'QueryAI',
            Creator: 'QueryAI Export Service',
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => {
          resolve({
            buffer: Buffer.concat(chunks),
            mimeType: 'application/pdf',
            filename: `${baseName}.pdf`,
          });
        });
        doc.on('error', reject);

        const pageWidth = doc.page.width - 100; // 50 margin each side
        const title = conversation.title || 'Untitled Conversation';
        const date = formatDate(conversation.created_at);

        // ── Header ──
        doc.fontSize(20).font('Helvetica-Bold').text(title, { width: pageWidth });
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica').fillColor('#666666')
          .text(`Date: ${date}  •  Exported: ${formatDate(new Date().toISOString())}`, { width: pageWidth });
        doc.moveDown(0.5);
        doc.fillColor('#000000');

        // Separator
        doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#dddddd').lineWidth(0.5).stroke();
        doc.moveDown(1);

        // ── Messages ──
        let questionNum = 0;
        for (const msg of messages) {
          // Page break check
          if (doc.y > doc.page.height - 120) {
            doc.addPage();
          }

          if (msg.role === 'user') {
            questionNum++;
            doc.fontSize(14).font('Helvetica-Bold').fillColor('#333333')
              .text(`Question ${questionNum}`, { width: pageWidth });
            doc.moveDown(0.3);
            doc.fontSize(11).font('Helvetica').fillColor('#000000')
              .text(msg.content, { width: pageWidth });
            doc.moveDown(0.8);
          } else if (msg.role === 'assistant') {
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#555555')
              .text('Answer', { width: pageWidth });
            doc.moveDown(0.3);

            let content = stripMarkdown(msg.content);
            if (includeSources && msg.sources?.length) {
              content = replaceCitationsWithFootnotes(content, msg.sources, globalMap);
            }

            doc.fontSize(11).font('Helvetica').fillColor('#000000')
              .text(content, { width: pageWidth, lineGap: 2 });
            doc.moveDown(0.3);

            // Per-message footnotes
            if (includeSources && msg.sources?.length) {
              doc.fontSize(9).font('Helvetica').fillColor('#666666');
              for (const src of msg.sources) {
                const entry = globalMap.get(sourceKey(src));
                if (entry) {
                  const url = entry.url ? ` (${entry.url})` : '';
                  doc.text(`[${entry.globalIndex}] ${entry.title}${url}`, { width: pageWidth });
                }
              }
              doc.fillColor('#000000');
            }

            doc.moveDown(0.5);
            doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#eeeeee').lineWidth(0.3).stroke();
            doc.moveDown(0.8);
          }
        }

        // ── Bibliography ──
        if (includeBibliography && globalMap.size > 0) {
          if (doc.y > doc.page.height - 160) {
            doc.addPage();
          }
          doc.moveDown(1);
          doc.fontSize(16).font('Helvetica-Bold').fillColor('#333333')
            .text('Bibliography', { width: pageWidth });
          doc.moveDown(0.5);

          const sorted = [...globalMap.values()].sort((a, b) => a.globalIndex - b.globalIndex);
          doc.fontSize(10).font('Helvetica').fillColor('#000000');
          for (const entry of sorted) {
            if (doc.y > doc.page.height - 80) {
              doc.addPage();
            }
            const url = entry.url ? ` — ${entry.url}` : '';
            const accessed = `, accessed ${formatDate(new Date().toISOString())}`;
            doc.text(`${entry.globalIndex}. ${entry.title}${url}${accessed}`, {
              width: pageWidth,
              lineGap: 1,
            });
            doc.moveDown(0.2);
          }
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // DOCX (docx npm package)
  // ═══════════════════════════════════════════════════════════════════

  private static async toDocx(
    conversation: Database.Conversation,
    messages: Database.Message[],
    globalMap: Map<string, SourceEntry>,
    baseName: string,
    includeSources: boolean,
    includeBibliography: boolean
  ): Promise<ExportResult> {
    const title = conversation.title || 'Untitled Conversation';
    const date = formatDate(conversation.created_at);
    const exportDate = formatDate(new Date().toISOString());
    const children: Paragraph[] = [];

    // ── Title ──
    children.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.TITLE,
        spacing: { after: 120 },
      })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Date: ${date}  •  Exported: ${exportDate}`, color: '666666', size: 20 }),
        ],
        spacing: { after: 200 },
      })
    );
    children.push(
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' } },
        spacing: { after: 300 },
      })
    );

    // ── Messages ──
    let questionNum = 0;
    for (const msg of messages) {
      if (msg.role === 'user') {
        questionNum++;
        children.push(
          new Paragraph({
            text: `Question ${questionNum}`,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 },
          })
        );
        children.push(
          new Paragraph({
            children: [new TextRun({ text: msg.content })],
            spacing: { after: 200 },
          })
        );
      } else if (msg.role === 'assistant') {
        children.push(
          new Paragraph({
            text: 'Answer',
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 120, after: 80 },
          })
        );

        let content = stripMarkdown(msg.content);
        if (includeSources && msg.sources?.length) {
          content = replaceCitationsWithFootnotes(content, msg.sources, globalMap);
        }

        // Split by paragraphs
        const paragraphs = content.split(/\n{2,}/);
        for (const para of paragraphs) {
          if (para.trim()) {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: para.trim(), size: 22 })],
                spacing: { after: 120, line: 276 },
              })
            );
          }
        }

        // Per-message footnotes
        if (includeSources && msg.sources?.length) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: 'Sources:', bold: true, size: 18, color: '555555' })],
              spacing: { before: 120, after: 60 },
            })
          );
          for (const src of msg.sources) {
            const entry = globalMap.get(sourceKey(src));
            if (entry) {
              const footnoteChildren: (TextRun | ExternalHyperlink)[] = [
                new TextRun({ text: `[${entry.globalIndex}] ${entry.title}`, size: 18, color: '555555' }),
              ];
              if (entry.url) {
                footnoteChildren.push(
                  new TextRun({ text: ' — ', size: 18, color: '555555' }),
                  new ExternalHyperlink({
                    children: [new TextRun({ text: entry.url, color: '1155CC', size: 18, underline: {} })],
                    link: entry.url,
                  })
                );
              }
              children.push(
                new Paragraph({ children: footnoteChildren, spacing: { after: 40 } })
              );
            }
          }
        }

        // Separator
        children.push(
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'EEEEEE' } },
            spacing: { before: 200, after: 200 },
          })
        );
      }
    }

    // ── Bibliography ──
    if (includeBibliography && globalMap.size > 0) {
      children.push(
        new Paragraph({
          text: 'Bibliography',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      const sorted = [...globalMap.values()].sort((a, b) => a.globalIndex - b.globalIndex);
      for (const entry of sorted) {
        const bibChildren: (TextRun | ExternalHyperlink)[] = [
          new TextRun({ text: `${entry.globalIndex}. ${entry.title}`, size: 20 }),
        ];
        if (entry.url) {
          bibChildren.push(
            new TextRun({ text: ' — ', size: 20 }),
            new ExternalHyperlink({
              children: [new TextRun({ text: entry.url, color: '1155CC', size: 20, underline: {} })],
              link: entry.url,
            })
          );
        }
        bibChildren.push(
          new TextRun({ text: `, accessed ${formatDate(new Date().toISOString())}`, size: 20, color: '888888' })
        );
        children.push(
          new Paragraph({ children: bibChildren, spacing: { after: 80 } })
        );
      }
    }

    const document = new Document({
      creator: 'QueryAI',
      title: title,
      description: `Exported conversation: ${title}`,
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1440, bottom: 1440, left: 1200, right: 1200 },
              pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
            },
          },
          headers: {},
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ text: 'QueryAI Export  •  Page ', size: 16, color: '999999' }),
                    new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '999999' }),
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

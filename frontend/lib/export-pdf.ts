import { jsPDF } from 'jspdf';
import type { Source } from '@/lib/api';

const MARGIN = 20;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM_MARGIN = PAGE_HEIGHT - MARGIN;
const LINE_HEIGHT = 5;
const FONT_SIZE_BODY = 10;
const FONT_SIZE_LABEL = 11;

/** Strip markdown for plain-text export (bold, code, headings, links). */
function stripMarkdownForExport(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let s = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) -> text
    .replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

/** Format one source line for the PDF. */
function formatSourceLine(source: Source, index: number): string {
  const n = index + 1;
  const title = source.title || (source.type === 'web' ? 'Web Source' : 'Document');
  if (source.type === 'web' && source.url) {
    return `[${n}] ${title} – ${source.url}`;
  }
  if (source.type === 'document' && source.url) {
    return `[${n}] ${title} – ${source.url}`;
  }
  return `[${n}] ${title}`;
}

/** Sanitize filename: remove invalid chars, limit length. */
function sanitizeFilename(s: string): string {
  return s
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50);
}

/**
 * Draw wrapped text and return the new y. Adds new pages as needed.
 */
function drawWrapped(doc: jsPDF, text: string, x: number, y: number, maxWidth: number): number {
  const spl = typeof (doc as any).splitTextToSize === 'function'
    ? (doc as any).splitTextToSize(text, maxWidth) as string[]
    : text.split(/\n/).flatMap((line) => {
        const words = line.split(' ');
        const out: string[] = [];
        let cur = '';
        for (const w of words) {
          const next = cur ? `${cur} ${w}` : w;
          if (doc.getTextWidth(next) <= maxWidth) cur = next;
          else {
            if (cur) out.push(cur);
            cur = w;
          }
        }
        if (cur) out.push(cur);
        return out;
      });
  for (const line of spl) {
    if (y > BOTTOM_MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
    doc.text(line, x, y);
    y += LINE_HEIGHT;
  }
  return y;
}

/**
 * Export a single Q&A (question, answer, sources) as a PDF and trigger download.
 */
export function exportToPdf(params: {
  question: string;
  answer: string;
  sources: Source[];
}): void {
  const { question, answer, sources } = params;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFontSize(FONT_SIZE_BODY);
  doc.setFont('helvetica', 'normal');

  let y = MARGIN;

  // Header
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('QueryAI – Export', MARGIN, y);
  y += 5;
  doc.text(`Exported: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`, MARGIN, y);
  y += 8;
  doc.setTextColor(0, 0, 0);

  // Question
  doc.setFontSize(FONT_SIZE_LABEL);
  doc.setFont('helvetica', 'bold');
  doc.text('Question:', MARGIN, y);
  y += LINE_HEIGHT;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_SIZE_BODY);
  const q = stripMarkdownForExport(question || '(no question)');
  y = drawWrapped(doc, q, MARGIN, y, CONTENT_WIDTH) + 4;

  // Answer (strip FOLLOW_UP_QUESTIONS first)
  const ans = stripMarkdownForExport(answer.replace(/FOLLOW_UP_QUESTIONS:[\s\S]*$/i, '').trim() || '');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_SIZE_LABEL);
  doc.text('Answer:', MARGIN, y);
  y += LINE_HEIGHT;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_SIZE_BODY);
  y = drawWrapped(doc, ans, MARGIN, y, CONTENT_WIDTH) + 6;

  // Sources
  if (sources && sources.length > 0) {
    if (y > BOTTOM_MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONT_SIZE_LABEL);
    doc.text('Sources:', MARGIN, y);
    y += LINE_HEIGHT;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT_SIZE_BODY);
    for (let i = 0; i < sources.length; i++) {
      if (y > BOTTOM_MARGIN) {
        doc.addPage();
        y = MARGIN;
      }
      const line = formatSourceLine(sources[i], i);
      y = drawWrapped(doc, line, MARGIN, y, CONTENT_WIDTH);
    }
  }

  // Filename
  const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(/:/g, '');
  const slug = sanitizeFilename(question || 'export');
  const filename = `QueryAI-export-${slug}-${stamp}.pdf`;

  doc.save(filename);
}

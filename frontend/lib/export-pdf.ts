import { jsPDF } from 'jspdf';
import type { Source } from '@/lib/api';

// Layout
const MARGIN = 24;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM_MARGIN = PAGE_HEIGHT - MARGIN - 12;
const LINE_HEIGHT = 5.5;

// Typography
const FONT_HEADER = 16;
const FONT_SECTION = 12;
const FONT_BODY = 10;
const FONT_SMALL = 9;

/** Strip markdown for plain-text export. Keeps [Web Source N] / [Document N] for citation parsing. */
function stripMarkdownForExport(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, (_, lab) => /^(Web Source|Document)\s+\d+$/i.test(lab) ? `[${lab}]` : lab)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Resolve [Web Source N] / [Document N] to 1-based index and URL. */
function getSourceRef(kind: 'web' | 'document', typeIndex: number, sources: Source[]): { num: number; url?: string } | null {
  const list = sources.map((s, i) => ({ s, i })).filter(({ s }) => s.type === kind);
  const e = list[typeIndex - 1];
  return e ? { num: e.i + 1, url: e.s.url } : null;
}

export type ContentSegment = { text: string; url?: string };

/** Split content into segments: plain text and citations. Citations become [n] with url. */
function parseContentToSegments(content: string, sources: Source[]): ContentSegment[] {
  const stripped = stripMarkdownForExport(content);
  const out: ContentSegment[] = [];
  const re = /\[(Web Source|Document)\s+(\d+)\](?:\([^)]*\))?/gi;
  let last = 0;
  let m;
  while ((m = re.exec(stripped)) !== null) {
    if (m.index > last) out.push({ text: stripped.slice(last, m.index) });
    const kind = m[1].toLowerCase() === 'web source' ? 'web' : 'document';
    const ref = getSourceRef(kind, parseInt(m[2], 10), sources);
    if (ref) out.push({ text: `[${ref.num}]`, url: ref.url });
    else out.push({ text: m[0] });
    last = re.lastIndex;
  }
  if (last < stripped.length) out.push({ text: stripped.slice(last) });
  return out;
}

function sanitizeFilename(s: string): string {
  return s.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, '-').slice(0, 50);
}

function splitToWidth(doc: jsPDF, text: string, maxW: number): string[] {
  const fn = (doc as { splitTextToSize?: (t: string, w: number) => string[] }).splitTextToSize;
  if (typeof fn === 'function') return fn.call(doc, text, maxW) as string[];
  const lines: string[] = [];
  for (const line of text.split(/\n/)) {
    const words = line.split(' ');
    let cur = '';
    for (const w of words) {
      const next = cur ? cur + ' ' + w : w;
      if (doc.getTextWidth(next) <= maxW) cur = next;
      else { if (cur) lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
  }
  return lines;
}

function drawWrapped(doc: jsPDF, text: string, x: number, y: number, maxW: number): number {
  for (const line of splitToWidth(doc, text, maxW)) {
    if (y > BOTTOM_MARGIN) { doc.addPage(); y = MARGIN; }
    doc.text(line, x, y);
    y += LINE_HEIGHT;
  }
  return y;
}

function drawSegment(doc: jsPDF, seg: ContentSegment, x: number, y: number, maxW: number): number {
  if (!seg.text) return y;
  const txt = (doc as any).textWithLink;
  if (seg.url && typeof txt === 'function') {
    for (const line of splitToWidth(doc, seg.text, maxW)) {
      if (y > BOTTOM_MARGIN) { doc.addPage(); y = MARGIN; }
      txt.call(doc, line, x, y, { url: seg.url });
      y += LINE_HEIGHT;
    }
    return y;
  }
  return drawWrapped(doc, seg.text, x, y, maxW);
}

function drawSegments(doc: jsPDF, segs: ContentSegment[], x: number, y: number, maxW: number): number {
  for (const s of segs) y = drawSegment(doc, s, x, y, maxW);
  return y;
}

/**
 * Export Q&A as PDF with clear structure, typography, alignment,
 * and inline clickable hyperlinks for sources (in body and in References).
 */
export function exportToPdf(params: { question: string; answer: string; sources: Source[] }): void {
  const { question, answer, sources = [] } = params;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_BODY);

  let y = MARGIN;

  // —— Header ——
  doc.setFontSize(FONT_HEADER);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('QueryAI', MARGIN, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_SMALL);
  doc.setTextColor(110, 110, 110);
  doc.text('Exported: ' + new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }), MARGIN, y);
  y += 6;

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.35);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 12;
  doc.setTextColor(0, 0, 0);

  // —— Question ——
  doc.setFontSize(FONT_SECTION);
  doc.setFont('helvetica', 'bold');
  doc.text('Question', MARGIN, y);
  y += LINE_HEIGHT + 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_BODY);
  y = drawWrapped(doc, stripMarkdownForExport(question || '(No question)'), MARGIN, y, CONTENT_WIDTH) + 10;

  // —— Answer (with inline clickable [1],[2] where applicable) ——
  const body = (answer || '').replace(/FOLLOW_UP_QUESTIONS:[\s\S]*$/i, '').trim();
  doc.setFontSize(FONT_SECTION);
  doc.setFont('helvetica', 'bold');
  doc.text('Answer', MARGIN, y);
  y += LINE_HEIGHT + 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_BODY);
  y = drawSegments(doc, parseContentToSegments(body, sources), MARGIN, y, CONTENT_WIDTH) + 10;

  // —— References (each [n] Title as clickable hyperlink, inline; optional URL on next line) ——
  if (sources.length > 0) {
    if (y > BOTTOM_MARGIN) { doc.addPage(); y = MARGIN; }
    doc.setFontSize(FONT_SECTION);
    doc.setFont('helvetica', 'bold');
    doc.text('References', MARGIN, y);
    y += LINE_HEIGHT + 3;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT_BODY);

    const twl = (doc as any).textWithLink;
    for (let i = 0; i < sources.length; i++) {
      if (y > BOTTOM_MARGIN) { doc.addPage(); y = MARGIN; }
      const s = sources[i];
      const n = i + 1;
      const title = s.title || (s.type === 'web' ? 'Web Source' : 'Document');
      const prefix = `[${n}] `;
      const w = doc.getTextWidth(prefix);
      doc.text(prefix, MARGIN, y);
      if (s.url && typeof twl === 'function') twl.call(doc, title, MARGIN + w, y, { url: s.url });
      else doc.text(title, MARGIN + w, y);
      y += LINE_HEIGHT + 1;

      // URL on next line: smaller, gray; clickable when textWithLink is available
      if (s.url && y <= BOTTOM_MARGIN) {
        doc.setFontSize(FONT_SMALL);
        doc.setTextColor(95, 95, 95);
        const url = s.url.length > 72 ? s.url.slice(0, 69) + '...' : s.url;
        const urlLines = splitToWidth(doc, url, CONTENT_WIDTH - 5);
        for (const ln of urlLines) {
          if (y > BOTTOM_MARGIN) break;
          if (typeof twl === 'function') twl.call(doc, ln, MARGIN + 5, y, { url: s.url });
          else doc.text(ln, MARGIN + 5, y);
          y += LINE_HEIGHT;
        }
        y += 2;
        doc.setFontSize(FONT_BODY);
        doc.setTextColor(0, 0, 0);
      }
    }
  }

  // Footer
  const n = (doc as any).getNumberOfPages?.() ?? 1;
  doc.setFontSize(FONT_SMALL);
  doc.setTextColor(140, 140, 140);
  doc.text('— ' + n + ' of ' + n + ' —', PAGE_WIDTH / 2, PAGE_HEIGHT - 10, { align: 'center' });

  const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(/:/g, '');
  doc.save('QueryAI-export-' + sanitizeFilename(question || 'export') + '-' + stamp + '.pdf');
}

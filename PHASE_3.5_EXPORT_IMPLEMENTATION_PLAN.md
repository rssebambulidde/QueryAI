# Phase 3.5 Export Functionality – Implementation Plan

## Overview

This plan covers **3.5 Export Functionality** from the [Development Roadmap](./DEVELOPMENT_ROADMAP.md):

- [ ] Implement PDF export  
- [ ] Format answers for export  
- [ ] Include sources in export  
- [ ] Add export button to UI  

**Goal:** Let users export an AI answer (and its sources) as a PDF from the chat, with one click.

---

## Scope

| What | In scope |
|------|----------|
| **Export unit** | Single assistant message (one Q&A pair: user question + AI answer + sources) |
| **Format** | PDF only (Phase 3.5) |
| **Where** | Export button on each assistant message, next to Summarize / Essay / Report |
| **Data** | `message.content`, `message.sources`, and the preceding `userQuestion` |

| What | Out of scope (later) |
|------|----------------------|
| Export full conversation | Phase 3.5 focuses on one reply; multi-message export can follow |
| Export as Markdown / DOCX | PDF only for 3.5 |
| Backend-generated PDF | Start with client-side; backend PDF can be added later |

---

## 1. Implement PDF Export

### 1.1 Approach: Client-side PDF with `jspdf`

**Choice:** Generate PDF in the browser with **jspdf** to avoid new backend endpoints and to keep export instant.

- **Library:** `jspdf`  
  - `npm install jspdf` (frontend)  
  - No backend changes for PDF generation.

**Alternatives (not for 3.5):**

- **Backend with `pdfkit`** – more control, logos, etc., but new route, auth, and binary handling.
- **`@react-pdf/renderer`** – good for React-based layouts; heavier; consider if we add structured reports later.
- **Browser “Print → Save as PDF”** – no dependency, but not a direct “Export PDF” action.

### 1.2 `jspdf` usage

- `new jspdf.jsPDF()`
- `doc.setFont()`, `doc.setFontSize()`, `doc.text()`
- `doc.text(str, x, y, { maxWidth })` for wrapping (or a small `splitTextToSize` helper).
- `doc.addPage()` when content exceeds one page.
- `doc.save('filename.pdf')` to trigger download.

### 1.3 File/helper

- **`frontend/lib/export-pdf.ts`** (or `utils/export-pdf.ts`)  
  - `exportToPdf(params: { question: string; answer: string; sources: Source[] }): void`  
  - Builds the PDF (see Section 2–3) and calls `doc.save(...)`.

---

## 2. Format Answers for Export

### 2.1 Answer cleanup

1. **Strip `FOLLOW_UP_QUESTIONS`**
   - Same as for Summarize/Essay/Report:  
     `answer.replace(/FOLLOW_UP_QUESTIONS:[\s\S]*$/i, '').trim()`

2. **Simplify inline citations for PDF**
   - Option A (simplest): replace `[Web Source N](URL)` / `[Document N]` with `[Web Source N]` or `[Document N]` and rely on the **Sources** section for URLs.
   - Option B: replace with `Source N (URL)` or `"Title" (URL)`.
   - **Recommendation:** Option A. Keep the body readable; URLs go in the Sources block.

3. **Markdown → plain text**
   - Strip or flatten: `**bold**` → `bold`, `` `code` `` → `code`, `#` headings → plain with newlines.
   - Simple regex pass is enough for 3.5; a small `stripMarkdownForExport(text: string): string` helper in `export-pdf.ts` keeps logic in one place.

### 2.2 PDF structure

Use a clear, consistent layout:

1. **Header (optional)**
   - e.g. `QueryAI – Export` and date: `Exported: YYYY-MM-DD HH:mm`.

2. **Question**
   - Label: `Question:`  
   - Content: `question` (wrapped, multi‑line).

3. **Answer**
   - Label: `Answer:`  
   - Content: cleaned `answer` (wrapped, multi‑page if needed).

4. **Sources**
   - Label: `Sources:`  
   - One line per source (see Section 3).

### 2.3 Pagination and wrapping

- Use `doc.text(..., { maxWidth: pageWidth - margins })` and/or a `splitTextToSize`-style helper.
- If `y` exceeds `pageHeight - footerMargin`, call `doc.addPage()` and reset `y`.
- Margins: e.g. 20px; font size: 10–11pt for body.

---

## 3. Include Sources in Export

### 3.1 Data

- `message.sources` from the assistant message (same as used for Summarize/Essay/Report).
- Typing: existing `Source` from `@/lib/api` (`type`, `title`, `url?`, `documentId?`, `snippet?`, `score?`).

### 3.2 Format in PDF

For each source, one line:

- **Web:** `[N] {title} – {url}`  
  - e.g. `[1] Microsoft Fabric – https://learn.microsoft.com/...`
- **Document:** `[N] {title}` (and `url` if present, e.g. for deep links later)  
  - e.g. `[2] report.pdf`

Order: keep the same as in the app (e.g. documents first, then web, or as stored).

### 3.3 Placement

- **Sources** section at the end of the PDF (after **Answer**).
- If there are no sources: omit the **Sources** section or show `Sources: None.`

---

## 4. Add Export Button to UI

### 4.1 `AIActionButtons`

- Add an **Export PDF** (or **Export**) button next to Summarize, Write Essay, Detailed Report.
- New prop:  
  `onExport: () => void`  
  (No args; the parent has `message` and `userQuestion` in closure.)

### 4.2 `ChatMessage`

- Pass `onExport` into `AIActionButtons`.
- Implement `onExport` as:
  - `content` = `message.content` with `FOLLOW_UP_QUESTIONS` stripped (same as other actions).
  - `sources` = `message.sources ?? []`.
  - `userQuestion` = `userQuestion ?? ''` (already passed from `chat-interface` for assistant messages).
- Call `exportToPdf({ question: userQuestion, answer: content, sources })`.
- On error: `toast.error('Failed to export PDF')`.
- Export is **synchronous** from the user’s perspective (no backend wait); no `isLoading` needed for the Export button itself, but we can disable it while `isActionLoading` if we want parity with other buttons.

### 4.3 `chat-interface`

- No new callbacks for Export: `onExport` is handled entirely inside `ChatMessage` using `message` and `userQuestion`; no new message or `onActionResponse` for export.

### 4.4 Icon and label

- Icon: `FileDown` or `Download` from `lucide-react` (or keep `FileText`-family if we prefer consistency with Summarize/Essay/Report).
- Label: `Export PDF` or `Export`.

---

## 5. File and Code Touchpoints

| File | Role |
|------|------|
| `frontend/lib/export-pdf.ts` (new) | `exportToPdf()`, `stripMarkdownForExport()`, source formatting, jspdf logic. |
| `frontend/components/chat/ai-action-buttons.tsx` | New `onExport` prop and Export button. |
| `frontend/components/chat/chat-message.tsx` | Pass `onExport` to `AIActionButtons`; implement `onExport` using `exportToPdf`. |
| `frontend/package.json` | Add `jspdf`. |

---

## 6. `export-pdf` API (design)

```ts
// frontend/lib/export-pdf.ts
import { Source } from '@/lib/api';
import { jsPDF } from 'jspdf';

export function exportToPdf(params: {
  question: string;
  answer: string;
  sources: Source[];
}): void;

function stripMarkdownForExport(text: string): string;
function formatSourceLine(source: Source, index: number): string;
```

- `exportToPdf`:
  - Strips `FOLLOW_UP_QUESTIONS` from `params.answer` (or expect caller to pass already stripped).
  - Runs `stripMarkdownForExport` on question and answer.
  - Builds PDF with: header (optional) → Question → Answer → Sources.
  - Calls `doc.save(export-filename)`.
- `stripMarkdownForExport`: remove/simplify `**`, `` ` ``, `#`, `[text](url)` → `text`, etc.
- `formatSourceLine`: `[N] title – url` for web; `[N] title` for document (and `url` if present).

**Filename:** e.g. `QueryAI-export-YYYY-MM-DD-HHmm.pdf` or `QueryAI-export-{sanitized-first-words-of-question}.pdf`. Sanitize to avoid invalid characters.

---

## 7. Dependencies

| Package | Where | Purpose |
|---------|--------|---------|
| `jspdf` | frontend | Generate and download PDF. |

```bash
cd frontend && npm install jspdf
```

`jspdf` types are included; no `@types/jspdf` needed in typical setups.

---

## 8. Error Handling

- **`exportToPdf`**
  - If `jspdf` throws (e.g. bad font/data): catch, log, and optionally `toast.error('Failed to export PDF')`.  
- **`ChatMessage` `onExport`**
  - If `userQuestion` is missing: still export with `Question: (no question)` or omit the block; avoid throwing.
  - If `message.sources` is `undefined`: use `[]`.

---

## 9. Testing Checklist

- [ ] Export with: question, long answer, 0 sources → PDF with Question, Answer, no Sources.
- [ ] Export with: question, short answer, several web + document sources → Sources block correct and URLs present for web.
- [ ] Answer contains `FOLLOW_UP_QUESTIONS` block → not present in PDF.
- [ ] Answer contains `**bold**`, `` `code` ``, `[Web Source 1](url)` → rendered in a readable, non‑markdown form in PDF.
- [ ] Very long answer → multiple pages; no cut‑off.
- [ ] Export button: disabled when `isActionLoading` (optional) and when `isStreaming`/`isActionResponse`/`isTopicChangeMessage` (same as other actions).
- [ ] Filename is valid and includes date (or question snippet).

---

## 10. UX Details

- **Placement:** Export next to Summarize, Essay, Report.
- **Accessibility:** `aria-label="Export as PDF"`; same keyboard/click behavior as other buttons.
- **Loading:** Export is client‑only; no spinner required. If we disable during `isActionLoading`, it should match other buttons.

---

## 11. Optional Enhancements (Post–3.5)

- Backend `POST /api/ai/export-pdf` returning PDF binary for branded/advanced layouts.
- Export **entire conversation** as PDF (multi‑message).
- Export as **Markdown** or **DOCX** in addition to PDF.
- “Copy as Markdown” for a single answer (no PDF).

---

## 12. Summary of Tasks

| # | Task | Owner |
|---|------|--------|
| 1 | Add `jspdf` to frontend | Dev |
| 2 | Create `frontend/lib/export-pdf.ts` with `exportToPdf`, `stripMarkdownForExport`, `formatSourceLine` | Dev |
| 3 | Implement PDF layout: header (optional), Question, Answer, Sources; pagination and wrapping | Dev |
| 4 | Add `onExport` and Export PDF button to `AIActionButtons` | Dev |
| 5 | In `ChatMessage`, wire `onExport` to `exportToPdf` with `message.content`, `message.sources`, `userQuestion` | Dev |
| 6 | Manual and (if any) automated tests | Dev / QA |

---

## 13. Update Roadmap

After implementation, in `DEVELOPMENT_ROADMAP.md` under **3.5 Export Functionality**, change:

```markdown
### 3.5 Export Functionality
- [ ] Implement PDF export        → [x]
- [ ] Format answers for export   → [x]
- [ ] Include sources in export   → [x]
- [ ] Add export button to UI    → [x]
```

---

**Document version:** 1.0  
**Last updated:** 2025

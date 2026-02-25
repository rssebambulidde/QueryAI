# Attachment Feature — Development Plan

> Improving the inline document/image attachment experience across anonymous & authenticated routes, in both Express (chat) and Deep Search modes.

---

## Current State

| Aspect | Implementation |
|---|---|
| **Supported files** | PDF, TXT, CSV, DOCX, DOC + images (PNG, JPEG, GIF, WebP) |
| **Size limits** | 10 MB per file (base64 in JSON body), max 5 per message |
| **Transport** | Full base64 payload in every request body |
| **Extraction** | `AttachmentExtractorService`: pdf-parse, mammoth, plain text |
| **Chat mode** | Document text → system prompt (grounded). Images → OpenAI vision. |
| **Deep search mode** | Document text appended to `additionalContext` alongside RAG results. Images → vision. |
| **Persistence** | `savedAttachments` in conversation `metadata` JSONB (text capped at 12K chars/doc) |
| **Anonymous** | Works in both modes, no persistence |
| **Follow-ups** | Loads saved context from conversation metadata on subsequent messages |

---

## P0 — Critical (Implement First)

### 1. Hybrid RAG + Document Grounding in Deep Search

**Problem:** In deep search mode, attached document text is appended to `additionalContext` separate from RAG sources. The model treats web results and document content as disconnected contexts.

**Solution:**
- Chunk the attached document and blend it into the RAG context with higher priority weight
- Update the deep search system prompt to instruct: "Use the attached document as your primary source and the web results as supplementary context"
- When both RAG sources and document attachments exist, structure the prompt with clear hierarchy

**Files:**
- `backend/src/services/ai-answer-pipeline.service.ts` — `prepareRequestContext` research branch (lines 1125-1155)
- `backend/src/services/prompt-builder.service.ts` — `buildSystemPrompt` / `buildMessages`

**Effort:** Medium | **Impact:** High

---

### 2. Token-Aware Smart Truncation

**Problem:** `formatAsContext` truncates at 8K chars per doc and `savedAttachments` caps at 12K chars — this is a naive first-N-characters approach that loses important content at the end of long documents.

**Solution:**
- Use embedding similarity to extract sections most relevant to the user's question
- Fill the token budget with the best chunks rather than the first N characters
- Implement a `smartTruncate(text, question, maxTokens)` utility that:
  1. Splits document into ~500-char paragraphs
  2. Scores each by keyword overlap with the question (lightweight, no API call)
  3. Returns top-scoring paragraphs up to the token budget, in document order

**Files:**
- `backend/src/services/attachment-extractor.service.ts` — new `smartTruncate` method
- `backend/src/services/ai-answer-pipeline.service.ts` — pass question to `formatAsContext`

**Effort:** Medium | **Impact:** High

---

## P1 — High Value (Implement Second)

### 3. Smart Question Suggestions After Attachment

**Problem:** After attaching a document, users face a blank input with no guidance on what to ask.

**Solution:**
- After document text extraction, generate 3-4 contextual question suggestions
- Options: (a) Client-side heuristic from filename/first paragraph, or (b) Lightweight API call
- Show as clickable chips above the input area: "Summarize this document", "What are the key findings?", "List all dates mentioned", etc.
- For known file types, use domain-specific suggestions (e.g., CSV → "What trends do you see in this data?")

**Files:**
- `frontend/components/chat/chat-input.tsx` — suggestion chip UI
- `frontend/components/chat/chat-container.tsx` — state management
- Optionally: `backend/src/services/attachment-extractor.service.ts` — `generateSuggestions` endpoint

**Effort:** Low | **Impact:** High

---

### 4. Extraction Status Indicators

**Problem:** Extraction failures are silently swallowed. Users don't know if their PDF was actually readable.

**Solution:**
- Return extraction status per file in the SSE stream: `{"extractionStatus": [{"file": "report.pdf", "status": "success", "chars": 4500}, ...]}`
- Frontend shows per-file indicators: green check = extracted, yellow warning = truncated, red X = failed
- For failed extractions, show actionable message: "This PDF appears to be scanned. Try uploading a text-based PDF."

**Files:**
- `backend/src/services/attachment-extractor.service.ts` — return status metadata
- `backend/src/services/ai-answer-pipeline.service.ts` — emit extraction status SSE event
- `frontend/components/chat/attachment-preview.tsx` — status badge UI
- `frontend/lib/hooks/useChatSend.ts` — handle new SSE event type

**Effort:** Low | **Impact:** Medium

---

### 5. Streaming Extraction Feedback

**Problem:** Large PDF extraction causes a long unexplained wait before the AI starts responding.

**Solution:**
- Emit an SSE event before extraction begins: `{"extracting": true, "files": ["report.pdf"]}`
- Frontend shows a typing indicator with context: "Extracting text from report.pdf..."
- Emit `{"extracting": false}` when extraction completes and AI generation begins

**Files:**
- `backend/src/services/ai-answer-pipeline.service.ts` — emit events around extraction
- `backend/src/routes/ai.routes.ts` — write SSE events inline
- `frontend/lib/hooks/useChatSend.ts` — handle extraction status in stream consumer
- `frontend/components/chat/chat-message.tsx` — extraction-aware loading state

**Effort:** Low | **Impact:** Medium

---

### 6. Detach Documents Mid-Conversation

**Problem:** Once attached, documents persist for the entire conversation with no way to remove them.

**Solution:**
- Add an "×" button on conversation-level attachment chips (already exists for inline — extend to conversation level)
- When removed, update `conversationAttachments` state and clear `savedAttachments` from conversation metadata via API call
- Subsequent messages no longer include the removed document context

**Files:**
- `frontend/components/chat/chat-container.tsx` — `removeConversationAttachment` handler
- `frontend/components/chat/chat-input.tsx` — show removable conversation attachment chips
- `backend/src/services/conversation.service.ts` — `updateConversation` metadata removal

**Effort:** Low | **Impact:** Medium

---

## P2 — Important (Implement Third)

### 7. Upload-Then-Reference Pattern

**Problem:** Base64 payloads are re-sent on every follow-up message (10MB × N messages = massive bandwidth). This also blocks support for larger files.

**Solution:**
- On first attachment, upload file to Supabase Storage, get back a `fileId`
- Store `fileId` + extracted text in a `chat_attachments` table
- On follow-ups, send only `fileId` references — backend loads extracted text from table
- Enables larger file sizes (50MB+) and faster follow-up requests

**Files:**
- New: `backend/src/services/chat-attachment.service.ts`
- New migration: `037_create_chat_attachments_table.sql`
- `frontend/components/chat/chat-input.tsx` — upload flow
- `frontend/lib/api.ts` — new `attachmentApi.upload()` method
- `backend/src/routes/attachment.routes.ts` — upload endpoint
- `backend/src/services/ai-answer-pipeline.service.ts` — resolve fileId → text

**Effort:** High | **Impact:** High

---

### 8. OCR Fallback for Scanned PDFs

**Problem:** pdf-parse returns empty text for scanned/image-based PDFs — a common user pain point.

**Solution:**
- After pdf-parse extraction, if text length < 50 chars for a multi-page PDF, flag as likely scanned
- Fallback 1: Use `tesseract.js` (server-side, no external API) for OCR
- Fallback 2: Convert PDF pages to images and send through OpenAI vision with "Extract all text from this document page"
- Show user a note: "This PDF was scanned — text was extracted via OCR and may contain errors"

**Files:**
- `backend/src/services/attachment-extractor.service.ts` — OCR fallback logic
- `backend/package.json` — add `tesseract.js` dependency
- `backend/src/services/ai-answer-pipeline.service.ts` — pass OCR quality flag

**Effort:** Medium | **Impact:** Medium

---

### 9. Tiered Attachment Limits

**Problem:** No differentiation between anonymous/free/premium users for attachment capabilities.

**Solution:**

| Tier | Files/msg | Max size | Max chars extracted | Persistence |
|---|---|---|---|---|
| Anonymous | 1 | 5 MB | 4K chars | None |
| Free | 3 | 10 MB | 8K chars | Conversation metadata |
| Premium | 10 | 50 MB | Full document | Storage + table |

- Enforce limits on both frontend (validation) and backend (middleware)
- Show upgrade prompts when limits are hit

**Files:**
- `backend/src/middleware/` — new `attachmentLimits` middleware
- `frontend/components/chat/chat-input.tsx` — dynamic limit enforcement
- `backend/src/services/attachment-extractor.service.ts` — tier-aware truncation

**Effort:** Low | **Impact:** Medium

---

## P3 — Differentiators (Future)

### 10. "Search Within My Document" Mode

**Problem:** Users can't leverage deep search to fact-check or research claims in their documents.

**Solution:**
- New toggle in deep search: "Research my document"
- Extract key claims/entities from the document
- Auto-generate web search queries to verify/expand on those claims
- Present results as: "Your document says X — here's what web sources say about this"

**Files:**
- New: `backend/src/services/document-research.service.ts`
- `frontend/components/chat/chat-input.tsx` — toggle UI
- `backend/src/services/ai-answer-pipeline.service.ts` — new pipeline branch

**Effort:** High | **Impact:** High

---

### 11. Multi-Document Citations

**Problem:** When multiple docs are attached, the AI doesn't clearly cite which document each fact comes from.

**Solution:**
- Add document-level citation markers: `[Doc: report.pdf, p.3]`
- In the prompt, instruct the model to cite document names when referencing content
- Frontend renders citations as clickable badges (similar to web source citations)

**Files:**
- `backend/src/services/prompt-builder.service.ts` — citation instructions in prompt
- `frontend/components/chat/chat-message.tsx` — citation rendering
- `backend/src/services/attachment-extractor.service.ts` — page-level extraction metadata

**Effort:** Medium | **Impact:** Medium

---

### 12. Inline Document Preview

**Problem:** Only a filename chip is shown — users can't confirm the right file was picked.

**Solution:**
- For PDFs: render first-page thumbnail using `pdfjs-dist` (client-side)
- For TXT/CSV: show first 500 chars in a collapsible preview
- For DOCX: show extracted plaintext preview
- For images: already shows thumbnail (existing)

**Files:**
- `frontend/components/chat/attachment-preview.tsx` — preview rendering
- `frontend/package.json` — add `pdfjs-dist` (if not present)

**Effort:** Medium | **Impact:** Medium

---

### 13. Anonymous Session Persistence

**Problem:** Anonymous users lose everything on page refresh — no follow-up conversations possible.

**Solution:**
- Use `sessionStorage` to keep attachment context and conversation history alive during browser session
- On refresh, restore from sessionStorage automatically
- Show note: "Sign up to save your documents across sessions"

**Files:**
- `frontend/lib/hooks/useAnonymousChatSend.ts` — sessionStorage read/write
- `frontend/components/chat/chat-container.tsx` — anonymous state restoration

**Effort:** Low | **Impact:** Medium

---

### 14. Attachment-Aware Conversation Titles

**Problem:** `generateConversationTitle` uses only question text. "What are the key findings?" is meaningless without document context.

**Solution:**
- When attachments are present, include filename(s) in title generation: "Questions about Q4-Report.pdf"
- If the user asks a generic question ("Summarize this"), use the filename as the title base

**Files:**
- `frontend/lib/hooks/useChatSend.ts` — `generateConversationTitle` logic
- Or: backend title generation if it exists

**Effort:** Low | **Impact:** Low

---

### 15. Chat Input Pill Redesign — Tube Shape + Circular Arrow Send Button

**Problem:** The current chat input box has a standard rectangular shape with a conventional send button. It doesn't feel modern or polished, and the send button lacks visual feedback on readiness.

**Solution:**
- Reshape the chat input to a **wide tube/pill** form factor — full-width with large rounded corners (`rounded-full` or `rounded-3xl`), giving it a capsule-like appearance similar to ChatGPT/iMessage
- Replace the current send button with a **circular upward arrow icon** (↑) inside a filled circle, positioned at the right end of the pill
- **Inactive state** (empty input): Circle is muted/transparent (`bg-white/10`, arrow `text-white/30`) — not clickable
- **Active state** (user typing): Circle fills with the brand accent color (`bg-brand-500`), arrow turns white, subtle scale-up transition
- Smooth CSS transition between states (`transition-all duration-200`)
- The pill should have a subtle inner glow or border (`border border-white/20`) and a slight backdrop blur for depth
- Ensure attachment button (paperclip) and mode selector sit cleanly inside the left side of the pill
- Mobile: pill stretches full width with comfortable touch target height (~48-52px)

**Visual reference (ASCII):**
```
┌──────────────────────────────────────────────────────────┐
│ 📎  💬▾  │  Type your message...                    (↑) │
└──────────────────────────────────────────────────────────┘
         pill shape (rounded-3xl)              ↑ active = filled circle
```

**Files:**
- `frontend/components/chat/chat-input.tsx` — outer container shape, send button replacement, conditional styling
- Possibly `frontend/components/ui/` — extract `SendButton` as a reusable component

**Effort:** Low | **Impact:** Medium (visual polish, modern feel)

---

## Implementation Order

```
Phase 1 (P0):  #1 Hybrid RAG + doc grounding  →  #2 Smart truncation
Phase 2 (P1):  #3 Smart suggestions  →  #4 Extraction status  →  #5 Streaming feedback  →  #6 Detach docs  →  #15 Chat input pill redesign
Phase 3 (P2):  #7 Upload-then-reference  →  #8 OCR fallback  →  #9 Tiered limits
Phase 4 (P3):  #10 Search within doc  →  #11 Multi-doc citations  →  #12 Preview  →  #13 Anon persistence  →  #14 Smart titles
```

Each phase should be a feature branch off `development`, tested, and merged before starting the next.

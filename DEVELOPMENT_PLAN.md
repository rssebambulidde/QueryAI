# QueryAI Development Plan — Research Assistant Evolution

**Created:** February 16, 2026
**Status:** Active
**Scope:** Security fixes, code quality, RAG improvements, research-specific features

---

## Current State Assessment

### What's Built (Phases 1-4 Complete)
- Authentication (email/password, JWT, Supabase Auth)
- AI Q&A with streaming (OpenAI GPT-3.5/4, SSE)
- Full RAG pipeline (chunking → embedding → Pinecone → retrieval → generation)
- Hybrid search (semantic + BM25 keyword + Tavily web search)
- Document upload & processing (PDF, DOCX, TXT, MD, images via OCR)
- Adaptive chunking (document-type-aware, sentence/semantic/hybrid)
- Multi-layer caching (embedding, RAG context, LLM response, search)
- Resilience (circuit breakers, retries, graceful degradation)
- Topic-scoped research mode
- Conversation management & collections
- Subscription tiers & PayPal payments
- PDF/JSON/CSV/Markdown export
- Mobile-responsive frontend (Next.js 16, React 19, Tailwind v4)
- 91 backend services, comprehensive test setup

### What Needs Work
- 3 critical security vulnerabilities
- Code maintainability (several 1000+ line files)
- RAG quality (cross-encoder reranking not implemented)
- Research-specific features (annotations, synthesis, citation formats)
- Frontend polish (loading states, accessibility, dark mode)

---

## Sprint Plan

### Sprint 1: Critical Security & Bug Fixes (Week 1)

**Priority:** CRITICAL — Must complete before any feature work
**Estimated effort:** 3-5 days

#### 1.1 Fix SQL Injection in Admin Routes
- **File:** `backend/src/routes/admin.routes.ts`
- **Issue:** Direct string interpolation in `.or()` filter
- **Task:** Replace string interpolation with parameterized Supabase `.ilike()` calls
- **Test:** Verify with malicious input strings (e.g., `%,full_name.eq.admin)--`)

```
BEFORE:  query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
AFTER:   query = query.or(`email.ilike.%${sanitizedSearch}%,full_name.ilike.%${sanitizedSearch}%`)
         (sanitize: escape %, _, and Supabase filter syntax characters)
```

#### 1.2 Remove Hardcoded JWT Secret Default
- **File:** `backend/src/config/env.ts`
- **Issue:** Falls back to `'your-secret-key-change-in-production'` if env var missing
- **Task:** Make `JWT_SECRET` required in production (throw on startup if missing)
- **Test:** Verify app fails to start in production without `JWT_SECRET`

#### 1.3 Add Rate Limiting to Public Endpoints
- **File:** `backend/src/routes/enterprise.routes.ts`
- **Issue:** `/api/enterprise/inquiry` has no rate limiting
- **Task:** Add `rateLimiter` middleware (e.g., 5 requests per IP per hour)
- **Task:** Add email format validation and field length limits
- **Test:** Verify rate limit enforced, invalid emails rejected

#### 1.4 Fix Empty Catch Blocks
- **File:** `backend/src/routes/ai.routes.ts` (line ~293, and others)
- **Issue:** `catch (_) {}` swallows errors silently
- **Task:** Audit all catch blocks across routes; add logging at minimum
- **Test:** Trigger error conditions, verify they appear in logs

#### 1.5 Remove Duplicate Subscription Logging
- **File:** `backend/src/routes/subscription.routes.ts` (lines 480-510)
- **Issue:** `logSubscriptionHistory` called twice with identical data
- **Task:** Remove the duplicate call
- **Test:** Verify single log entry per subscription event

#### 1.6 Fix Webhook Dev Bypass
- **File:** `backend/src/routes/payment.routes.ts` (lines 901-927)
- **Issue:** Dev mode accepts webhooks without signature verification
- **Task:** Use explicit `SKIP_WEBHOOK_VERIFICATION` flag instead of `NODE_ENV`
- **Test:** Verify webhooks rejected without valid signature when flag is off

#### 1.7 Move Hardcoded URLs to Environment Variables
- **Files:** `backend/src/routes/payment.routes.ts`, `backend/src/routes/billing.routes.ts`
- **Issue:** `https://queryai.samabrains.com` and Railway URL hardcoded
- **Task:** Add `FRONTEND_URL` and `BACKEND_URL` to env config
- **Test:** Verify URLs resolve correctly from env vars

**Sprint 1 Definition of Done:**
- [ ] All security fixes deployed
- [ ] No hardcoded secrets or URLs in codebase
- [ ] All public endpoints rate-limited
- [ ] No empty catch blocks in routes
- [ ] All fixes covered by tests

---

### Sprint 2: Code Quality & Performance (Weeks 2-3)

**Priority:** HIGH — Reduces tech debt, prevents future bugs
**Estimated effort:** 8-10 days

#### 2.1 Extract Magic Numbers to Configuration
- **New file:** `backend/src/config/thresholds.config.ts`
- **Task:** Create centralized threshold configuration:

```typescript
export const ThresholdConfig = {
  retrieval: {
    minSimilarityScore: 0.7,
    nearDuplicateThreshold: 0.95,
    similarityDedupeThreshold: 0.85,
    qualityThreshold: 0.5,
    authorityThreshold: 0.5,
    cacheSimThreshold: 0.85,
  },
  chunking: {
    semanticSimilarityBreak: 0.7,
    fullBreakRatio: 0.7,
  },
  compression: {
    maxTokens: 8000,
    compressionThreshold: 10000,
    summarizationThreshold: 12000,
    maxCompressionTimeMs: 2000,
  },
  embedding: {
    batchSize: 100,
    maxBatchSize: 2048,
    queueTimeoutMs: 30000,
    cacheTtlDays: 7,
  },
  cache: {
    ragMixedTtlMin: 30,
    ragWebOnlyTtlMin: 15,
    ragDocOnlyTtlMin: 60,
    searchTtlHours: 24,
    llmResponseTtlMin: 60,
    citationCacheTtlMin: 5,
  },
};
```
- **Task:** Replace all magic numbers across 91 service files with config references
- **Test:** Verify all services still function after refactor

#### 2.2 Standardize Nullish Coalescing
- **Scope:** All service and route files
- **Task:** Replace `||` with `??` for default values where `0`, `""`, or `false` are valid
- **Test:** Spot-check edge cases (e.g., `temperature: 0` should not default)

#### 2.3 Add Missing Database Indexes
- **New migration file:** `backend/src/database/migrations/035_performance_indexes.sql`
- **Indexes to add:**

```sql
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_created ON usage_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_documents_user_status ON documents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id);
```

#### 2.4 Fix N+1 Queries
- **File:** `backend/src/routes/admin.routes.ts`
- **Task:** Replace sequential DB calls with `Promise.all()`:

```typescript
// BEFORE
const profile = await DatabaseService.getUserProfile(userId);
const subscription = await DatabaseService.getUserSubscription(userId);

// AFTER
const [profile, subscription] = await Promise.all([
  DatabaseService.getUserProfile(userId),
  DatabaseService.getUserSubscription(userId),
]);
```

#### 2.5 Add Input Validation for UUID Parameters
- **File:** `backend/src/routes/documents.routes.ts` and all routes with ID params
- **Task:** Create UUID validation middleware or utility
- **Task:** Validate document IDs in batch operations

**Sprint 2 Definition of Done:**
- [ ] Zero magic numbers in service files (all from config)
- [ ] `??` used consistently for defaults
- [ ] Database indexes applied
- [ ] No N+1 query patterns in routes
- [ ] UUID validation on all ID parameters

---

### Sprint 3: Backend Architecture Refactor (Weeks 3-5)

**Priority:** HIGH — Enables faster feature development
**Estimated effort:** 10-12 days

#### 3.1 Split `rag.service.ts` (2,230 lines → 3 files)

**New files:**
- `backend/src/services/retrieval-orchestrator.service.ts`
  - Parallel retrieval (semantic, keyword, web)
  - Hybrid merging
  - Cache check/store logic
- `backend/src/services/context-pipeline.service.ts`
  - Re-ranking
  - Deduplication
  - Diversity filtering (MMR)
  - Context refinement
- `backend/src/services/rag.service.ts` (slimmed down)
  - High-level orchestration only
  - Calls orchestrator → pipeline → formatter
  - `retrieveContext()` becomes a thin coordinator

**Migration approach:**
1. Create new files with extracted methods
2. Update `rag.service.ts` to delegate to new services
3. Update all imports across the codebase
4. Run full test suite after each step

#### 3.2 Split `ai.service.ts` (2,848 lines → 4 files)

**New files:**
- `backend/src/services/prompt-builder.service.ts`
  - System prompt construction
  - Context formatting for prompt
  - Few-shot example injection
  - Topic mode instructions
- `backend/src/services/response-processor.service.ts`
  - Citation extraction
  - Follow-up question generation
  - Answer quality scoring
  - Response formatting
- `backend/src/services/streaming.service.ts`
  - SSE streaming logic
  - Stream chunk processing
  - Abort handling
- `backend/src/services/ai.service.ts` (slimmed down)
  - `answerQuestion()` orchestration
  - Model selection
  - Off-topic detection

#### 3.3 Move Follow-Up Question Logic to Backend
- **Current:** Frontend (`components/chat/chat-message.tsx`, lines ~463-698) parses follow-ups
- **Task:** Backend `response-processor.service.ts` returns structured follow-ups
- **Task:** Frontend only renders what backend returns
- **API change:** Add `followUpQuestions: string[]` to response schema

#### 3.4 Connect Context Visualization Actions
- **File:** `frontend/components/advanced/context-visualization.tsx`
- **Issue:** Edit/remove chunk buttons are not connected to backend
- **Task:** Either wire to backend endpoint or remove dead UI buttons
- **Recommendation:** Remove for now; re-add when chunk editing is a real feature

**Sprint 3 Definition of Done:**
- [ ] `rag.service.ts` < 500 lines
- [ ] `ai.service.ts` < 500 lines
- [ ] Follow-up questions generated on backend
- [ ] No dead UI buttons
- [ ] All existing tests pass after refactor
- [ ] New unit tests for extracted services

---

### Sprint 4: Frontend Architecture Refactor (Weeks 5-6)

**Priority:** MEDIUM-HIGH — Improves developer velocity and UX
**Estimated effort:** 8-10 days

#### 4.1 Split `chat-interface.tsx` (1,380 lines → 5 components)

**New files:**
```
frontend/components/chat/
├── chat-container.tsx        # Layout, scroll management, conversation lifecycle
├── chat-message-list.tsx     # Message rendering, streaming state indicator
├── chat-input-area.tsx       # Input field, send button, advanced settings toggle
├── sources-sidebar.tsx       # Perplexity-style sources panel
├── research-mode-bar.tsx     # Research mode banner, topic selector
└── chat-interface.tsx        # Thin wrapper composing all above
```

**Key considerations:**
- State that spans components stays in Zustand or parent
- Streaming state managed in `chat-container.tsx`, passed down
- Sources sidebar is fully independent (receives sources as props)

#### 4.2 Split `lib/api.ts` (1,626 lines → modular files)

**New structure:**
```
frontend/lib/api/
├── client.ts          # Axios instance, interceptors, token refresh
├── auth.ts            # authApi
├── ai.ts              # aiApi (including streaming)
├── documents.ts       # documentApi
├── conversations.ts   # conversationApi
├── topics.ts          # topicApi
├── collections.ts     # collectionApi
├── analytics.ts       # analyticsApi
├── subscriptions.ts   # subscriptionApi
├── payments.ts        # paymentApi
├── usage.ts           # usageApi, metricsApi, costApi
└── index.ts           # Re-exports all APIs
```

#### 4.3 Add Loading Skeletons
- **Scope:** Conversation list, document list, dashboard initial load
- **Task:** Create `Skeleton` component (or use existing UI primitives)
- **Task:** Replace spinner states with skeleton UI in:
  - `chat-interface.tsx` (conversation loading)
  - `document-manager.tsx` (document list loading)
  - Dashboard page (initial data fetch)

#### 4.4 Improve Document Status Polling
- **File:** `components/documents/document-manager.tsx`
- **Current:** 5-second fixed interval polling for all processing documents
- **Task:** Implement exponential backoff: 2s → 4s → 8s → 16s → 30s max
- **Task:** Stop polling after 10 minutes (show "processing may take longer" message)
- **Future:** Replace with SSE endpoint for real-time document status

#### 4.5 Enhance Error UX
- **Rate limit (429):** Show countdown timer ("Try again in Ns")
- **Subscription limit (403):** Show specific limit hit + upgrade CTA with plan comparison
- **Network errors:** Add retry button alongside error message
- **Streaming failure:** Show partial response with "Response interrupted" indicator

**Sprint 4 Definition of Done:**
- [ ] `chat-interface.tsx` < 200 lines (wrapper only)
- [ ] `api.ts` split into 12 modular files
- [ ] Skeleton loading states on all list views
- [ ] Exponential backoff on document polling
- [ ] Improved error messages with actionable UX

---

### Sprint 5: RAG Quality Improvements (Weeks 7-9)

**Priority:** HIGH — Core product quality for a research assistant
**Estimated effort:** 12-15 days

#### 5.1 Implement Cross-Encoder Reranking
- **File:** `backend/src/services/reranking.service.ts`
- **Current:** TODO placeholder, falls back to score-based
- **Option A — Cohere Rerank API** (recommended, fastest to ship):
  - Add `cohere-ai` SDK dependency
  - Implement `crossEncoderRerank()` using Cohere Rerank v3
  - Latency: ~200-500ms for top-20 results
  - Cost: ~$1 per 1000 searches at 20 docs/search
- **Option B — Self-hosted** (lower cost, more effort):
  - Deploy `bge-reranker-base` as Supabase Edge Function or separate service
  - Latency: ~300-800ms depending on hosting

**Implementation:**
```typescript
// In reranking.service.ts
async crossEncoderRerank(query: string, results: DocumentContext[]): Promise<RerankedResult[]> {
  const cohere = new CohereClient({ token: config.COHERE_API_KEY });
  const reranked = await cohere.rerank({
    model: 'rerank-english-v3.0',
    query,
    documents: results.map(r => r.content),
    topN: results.length,
  });
  // Map scores back to results, sort by relevance_score
}
```

#### 5.2 Implement Parent-Child Chunking
- **Concept:** Store small chunks (200 tokens) for precise retrieval, return the parent chunk (800 tokens) as context
- **Database change:** Add `parent_chunk_id` to `document_chunks` table
- **Chunking change:** Create two-level chunking in `chunking.service.ts`:
  1. First pass: create parent chunks (800 tokens, current behavior)
  2. Second pass: split each parent into child chunks (200 tokens)
  3. Embed only child chunks
  4. On retrieval: match child, return parent
- **Pinecone change:** Store `parent_chunk_id` in metadata
- **Retrieval change:** After Pinecone search, fetch parent chunks from DB

#### 5.3 Add Chunk Metadata Enrichment
- **New service:** `backend/src/services/chunk-enricher.service.ts`
- **During ingestion, extract and store:**
  - Section heading hierarchy (for PDFs/markdown)
  - Key entities (people, organizations, dates) — lightweight regex + pattern matching
  - One-sentence summary (LLM-generated, batch processed)
- **Store in:** `document_chunks.metadata` JSONB field
- **Use in:** Pinecone metadata for better filtering

#### 5.4 Implement HyDE (Hypothetical Document Embeddings)
- **New service:** `backend/src/services/hyde.service.ts`
- **Flow:**
  1. User asks question
  2. LLM generates a hypothetical answer (short, factual)
  3. Embed the hypothetical answer (not the question)
  4. Search Pinecone with this embedding
- **When to use:** Complex/abstract questions where direct query embedding is weak
- **Detection:** Use query complexity scoring (already exists in `context-selector.service.ts`)
- **Config:** Enable/disable per request, default off for simple queries

#### 5.5 Adaptive Similarity Thresholds
- **File:** `backend/src/services/threshold-optimizer.service.ts`
- **Current:** Static `0.7` minimum score
- **Improvement:** Dynamic thresholds based on:
  - Score distribution of results (if top result is 0.95, raise threshold)
  - Query type (factual → higher threshold, exploratory → lower)
  - Number of documents in topic (few docs → lower threshold)
  - Historical user feedback (if available)

**Sprint 5 Definition of Done:**
- [ ] Cross-encoder reranking operational (Cohere or self-hosted)
- [ ] Parent-child chunking implemented and tested
- [ ] Chunk metadata enrichment running on new uploads
- [ ] HyDE available for complex queries
- [ ] Adaptive thresholds replacing static 0.7
- [ ] Retrieval quality benchmarks established (precision@k, recall@k)

---

### Sprint 6: Research Assistant — Core Features (Weeks 9-12)

**Priority:** HIGH — Key differentiator as a research tool
**Estimated effort:** 15-18 days

#### 6.1 Research Notes & Annotations System

**Database schema:**
```sql
-- Research notes (standalone or linked to messages/documents)
CREATE TABLE research_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
    title TEXT,
    content TEXT NOT NULL,
    note_type TEXT DEFAULT 'note', -- note, highlight, annotation, insight
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notes_user_topic ON research_notes(user_id, topic_id);
CREATE INDEX idx_notes_document ON research_notes(document_id);
CREATE INDEX idx_notes_message ON research_notes(message_id);
ALTER TABLE research_notes ENABLE ROW LEVEL SECURITY;
```

**Backend:**
- New route: `backend/src/routes/notes.routes.ts`
  - `POST /api/notes` — Create note
  - `GET /api/notes` — List notes (filter by topic, document, conversation)
  - `PUT /api/notes/:id` — Update note
  - `DELETE /api/notes/:id` — Delete note
  - `GET /api/notes/search` — Full-text search across notes
- New service: `backend/src/services/notes.service.ts`
- Notes are searchable and can be included in RAG context

**Frontend:**
- New component: `components/notes/notes-panel.tsx`
  - Slide-out panel or sidebar tab
  - Create/edit/delete notes
  - Link notes to messages (click "Save as note" on any AI response)
  - Link notes to documents (click "Add note" while viewing document)
  - Tag management
  - Search within notes
- Integration with chat: "Add note" button on each message
- Integration with documents: annotation overlay on document viewer

#### 6.2 Multi-Document Synthesis & Comparison

**Backend:**
- New service: `backend/src/services/synthesis.service.ts`
- **Synthesis modes:**
  1. **Agreement detection:** Compare claims across top-K chunks from different documents
  2. **Contradiction detection:** Flag when documents make conflicting claims
  3. **Timeline synthesis:** Order information chronologically when dates are present
  4. **Coverage analysis:** Which documents cover which sub-topics

**Prompt engineering:**
- Update system prompt to explicitly request structured synthesis:
```
When multiple documents address the same question:
1. Note areas of AGREEMENT: "Sources [1,3,4] agree that..."
2. Note CONTRADICTIONS: "Source [2] claims X, while Source [5] states Y..."
3. Note TEMPORAL CHANGES: "Earlier research (Source [1], 2019) found X, but more recent work (Source [3], 2023) shows Y..."
4. Assess CONFIDENCE: Rate how well-supported each claim is by the available sources.
```

**Frontend:**
- New component: `components/chat/synthesis-view.tsx`
  - Toggle between "Combined Answer" and "Source Comparison" views
  - Source comparison shows each document's position side-by-side
  - Color coding: green (agreement), red (contradiction), yellow (partial)
- Integration: Button on AI responses "Compare Sources"

#### 6.3 Structured Conflict Detection & Resolution UI

**Backend enhancement:**
- Upgrade `conflict-resolution.service.ts` from guidelines-only to active detection
- New method: `detectConflicts(chunks: DocumentContext[]): ConflictReport`
  - Compare overlapping claims using embedding similarity + LLM classification
  - Return structured conflict data

**Frontend:**
- New component: `components/chat/conflict-indicator.tsx`
  - Inline indicators when AI response mentions conflicting sources
  - Click to expand: shows each source's claim side-by-side
  - User can mark which source they trust more (feeds into source confidence)

#### 6.4 Source Confidence Scoring

**Database change:**
```sql
ALTER TABLE documents ADD COLUMN source_type TEXT DEFAULT 'unknown';
  -- academic_paper, book, blog, documentation, news, government, web
ALTER TABLE documents ADD COLUMN confidence_score FLOAT DEFAULT 0.5;
  -- User-adjustable, 0.0 to 1.0
ALTER TABLE documents ADD COLUMN publication_date DATE;
```

**Backend:**
- Auto-detect source type during ingestion (from file metadata, content patterns)
- User can override source type and confidence
- Retrieval weights adjusted by confidence score

**Frontend:**
- Source type badges in document manager
- Confidence slider per document
- Confidence indicators in citation display

#### 6.5 User Feedback Loop (Thumbs Up/Down)

**Database schema:**
```sql
CREATE TABLE response_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    rating TEXT NOT NULL, -- thumbs_up, thumbs_down
    feedback_text TEXT,
    retrieved_chunk_ids TEXT[], -- Which chunks were used
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Backend:**
- New route: `POST /api/feedback` — Save feedback
- Track which chunks led to good/bad answers
- Use feedback data to:
  - Adjust similarity thresholds per topic
  - Identify low-quality documents
  - Improve re-ranking weights over time

**Frontend:**
- Thumbs up/down buttons on each AI response
- Optional text feedback on thumbs down
- "Was this helpful?" prompt after follow-up questions

**Sprint 6 Definition of Done:**
- [ ] Notes system operational (CRUD + search + linking)
- [ ] Synthesis view showing agreement/contradiction across sources
- [ ] Conflict detection active with UI indicators
- [ ] Source confidence scoring integrated into retrieval
- [ ] Feedback loop collecting data on response quality
- [ ] Research-specific follow-up patterns (counterarguments, temporal analysis)

---

### Sprint 7: Research Assistant — Export & Citation (Weeks 12-14)

**Priority:** MEDIUM-HIGH — Critical for academic/research use
**Estimated effort:** 8-10 days

#### 7.1 Academic Citation Formatting

**New service:** `backend/src/services/citation-formatter.service.ts`

**Supported formats:**
- APA 7th Edition
- MLA 9th Edition
- Chicago (Notes-Bibliography)
- Harvard
- BibTeX
- IEEE

**Implementation:**
```typescript
interface CitationData {
  title: string;
  authors?: string[];
  publicationDate?: string;
  url?: string;
  sourceType: 'web' | 'document' | 'academic' | 'book';
  publisher?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  accessDate: string;
}

class CitationFormatterService {
  formatAPA(data: CitationData): string;
  formatMLA(data: CitationData): string;
  formatChicago(data: CitationData): string;
  formatBibTeX(data: CitationData): string;
  formatAll(data: CitationData): Record<string, string>;
}
```

**Frontend:**
- Citation format selector in source panel
- "Copy Citation" button with format dropdown (APA, MLA, Chicago, BibTeX)
- Batch export: "Export All Citations" as BibTeX file

#### 7.2 Research Report Generation

**Backend enhancement:**
- New endpoint: `POST /api/ai/generate-report`
- Takes a topic or conversation and generates a structured research report:
  - Executive summary
  - Key findings (with citations)
  - Source analysis (agreement, contradiction, gaps)
  - Methodology (which documents, search queries)
  - References (in selected citation format)

**Frontend:**
- "Generate Report" button on topic dashboard or conversation
- Report preview with editing capability
- Export as PDF (using existing `jspdf`) or DOCX (add `docx` library)
- Citation format selection for the report

#### 7.3 Annotated Bibliography Generation

**Backend:**
- New endpoint: `POST /api/ai/annotated-bibliography`
- For each document in a topic:
  - Generate 2-3 sentence summary
  - Note key contributions to the research question
  - Rate relevance to topic
- Output as structured list with citations

**Frontend:**
- "Annotated Bibliography" option in topic actions
- Preview and edit before export
- Export in multiple formats

#### 7.4 Enhanced PDF Export

**Upgrade existing `lib/export-pdf.ts`:**
- Add citation format selection (APA, MLA, etc.)
- Add table of contents for long exports
- Add page numbers and headers
- Include source confidence indicators
- Support exporting entire research sessions (multi-conversation)

**Sprint 7 Definition of Done:**
- [ ] Citation formatting working for APA, MLA, Chicago, BibTeX
- [ ] One-click "Copy Citation" with format selection
- [ ] Research report generation from topic/conversation
- [ ] Annotated bibliography generation
- [ ] Enhanced PDF export with academic formatting

---

### Sprint 8: Topic Knowledge Dashboard (Weeks 14-16)

**Priority:** MEDIUM — Differentiated feature for power users
**Estimated effort:** 10-12 days

#### 8.1 Topic Overview Dashboard

**New page:** `frontend/app/dashboard/topics/[id]/page.tsx`

**Components:**
- **Topic header:** Name, description, document count, conversation count
- **Key themes:** Auto-extracted themes across all documents in topic
  - Backend: LLM summarizes themes from chunk embeddings (cluster → label)
- **Document contribution map:** Which documents cover which themes
  - Visual: Matrix/heatmap showing document × theme relevance
- **Coverage gaps:** Sub-topics with few/no documents
  - "You might want to research more about X"
- **Timeline:** If documents have dates, show research timeline
- **Activity feed:** Recent conversations, uploads, notes

#### 8.2 Theme Extraction Service

**New service:** `backend/src/services/theme-extraction.service.ts`

**Process:**
1. Cluster document chunk embeddings using k-means (lightweight, in-memory)
2. For each cluster, use LLM to generate a theme label
3. Store themes in new `topic_themes` table
4. Re-extract when new documents are added
5. Cache results (regenerate weekly or on-demand)

**Database:**
```sql
CREATE TABLE topic_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    description TEXT,
    document_ids UUID[],
    chunk_count INTEGER,
    confidence FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 8.3 Research Progress Tracking

**Frontend component:** `components/topics/research-progress.tsx`

**Features:**
- Number of documents uploaded vs. themes covered
- Questions asked and answered
- Notes created
- Sources verified
- Suggested next steps ("Consider uploading more sources about X")

**Sprint 8 Definition of Done:**
- [ ] Topic dashboard page with overview stats
- [ ] Theme extraction running on topics with 3+ documents
- [ ] Document-theme coverage heatmap
- [ ] Coverage gap detection
- [ ] Research progress indicators

---

### Sprint 9: Frontend Polish (Weeks 16-18)

**Priority:** MEDIUM — User experience refinement
**Estimated effort:** 8-10 days

#### 9.1 Dark Mode
- Add `dark:` variant classes throughout Tailwind components
- Theme toggle in settings/header
- Persist preference in localStorage
- System preference detection (`prefers-color-scheme`)
- Ensure all custom components respect dark mode (charts, code blocks, PDF viewer)

#### 9.2 Accessibility Improvements
- Add `aria-live="polite"` region for streaming response completion
- Add `aria-busy` on message container during streaming
- Add missing `aria-label` on all icon-only buttons (audit all components)
- Add keyboard shortcuts: `Ctrl+K` for search, `Ctrl+N` for new conversation
- Screen reader testing with NVDA/VoiceOver

#### 9.3 Performance Optimizations
- Add `@tanstack/react-virtual` for conversation list and document list virtualization
- Lazy load heavy components (context visualization, charts, code highlighter)
- Image optimization for document thumbnails
- Bundle analysis and code splitting review

#### 9.4 Connection Status & Offline Handling
- Connection status indicator in header
- Queue failed messages for retry when connection restored
- Optimistic UI: show sent message immediately, mark as "sending"
- Graceful handling of mid-stream disconnects

**Sprint 9 Definition of Done:**
- [ ] Dark mode fully functional across all pages
- [ ] WCAG AA accessibility compliance on core flows
- [ ] List virtualization on conversations and documents
- [ ] Connection status indicator with offline resilience
- [ ] Lighthouse performance score > 90

---

### Sprint 10: Observability & Reliability (Weeks 18-19)

**Priority:** MEDIUM — Production stability
**Estimated effort:** 5-7 days

#### 10.1 End-to-End RAG Trace IDs
- Generate a unique `traceId` per query
- Pass through: retrieval → reranking → context building → LLM → response
- Log `traceId` at each stage with latency
- Store in `retrieval_metrics` table
- Frontend: show trace ID in debug/advanced mode

#### 10.2 RAG Quality Dashboard
- New admin page: RAG quality metrics
- Charts: retrieval precision over time, average response quality
- Breakdown: by topic, by document type, by query complexity
- Use existing `retrieval_metrics`, `quality_metrics`, `latency_metrics` tables

#### 10.3 Automated Quality Alerts
- Alert when average retrieval score drops below threshold
- Alert when cache hit rate drops significantly
- Alert when error rate exceeds threshold
- Email/webhook notification (extend existing `alert.service.ts`)

#### 10.4 A/B Testing Activation
- Wire existing `ab-testing.service.ts` to actual metrics collection
- Define experiments: e.g., "cross-encoder vs. score-based reranking"
- Track metrics per variant
- Admin dashboard to view experiment results

**Sprint 10 Definition of Done:**
- [ ] Trace IDs flowing through entire RAG pipeline
- [ ] Admin quality dashboard with charts
- [ ] Automated alerts for quality degradation
- [ ] At least one A/B test running

---

## Timeline Summary

| Sprint | Focus | Duration | Weeks |
|--------|-------|----------|-------|
| 1 | Critical Security & Bug Fixes | 1 week | 1 |
| 2 | Code Quality & Performance | 2 weeks | 2-3 |
| 3 | Backend Architecture Refactor | 2 weeks | 3-5 |
| 4 | Frontend Architecture Refactor | 2 weeks | 5-6 |
| 5 | RAG Quality Improvements | 3 weeks | 7-9 |
| 6 | Research Core Features | 3 weeks | 9-12 |
| 7 | Export & Citation | 2 weeks | 12-14 |
| 8 | Topic Knowledge Dashboard | 2 weeks | 14-16 |
| 9 | Frontend Polish | 2 weeks | 16-18 |
| 10 | Observability & Reliability | 1 week | 18-19 |
| **Total** | | **~19 weeks** | |

---

## Dependencies & Prerequisites

| Sprint | Depends On | External Requirements |
|--------|------------|-----------------------|
| 1 | None | — |
| 2 | Sprint 1 | — |
| 3 | Sprint 2 | — |
| 4 | Sprint 3 (backend API stable) | — |
| 5 | Sprint 3 | Cohere API key (if using Cohere Rerank) |
| 6 | Sprint 5 (improved retrieval) | New database migration |
| 7 | Sprint 6 (notes, synthesis) | `docx` npm package |
| 8 | Sprint 6 (notes, feedback) | — |
| 9 | Sprint 4 (split components) | `@tanstack/react-virtual` package |
| 10 | Sprint 5 (trace IDs in RAG) | — |

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cross-encoder adds latency | Slower responses | Use async reranking; only for complex queries; set 500ms timeout |
| Parent-child chunking doubles storage | Higher Pinecone costs | Only for documents > 5 pages; monitor index size |
| Theme extraction LLM costs | Higher API costs | Cache aggressively; run only when documents change |
| Large refactors break features | Regression bugs | Incremental refactoring; run tests at each step |
| Dark mode CSS conflicts | Visual bugs | Systematic component-by-component approach; visual regression tests |

---

## Success Metrics

| Metric | Current | Sprint 5 Target | Sprint 10 Target |
|--------|---------|-----------------|------------------|
| Retrieval precision@5 | Unknown | > 0.7 | > 0.85 |
| Average response time | Unknown | < 5s | < 4s |
| User feedback (thumbs up %) | N/A | Baseline | > 80% |
| Citation accuracy | Unknown | > 90% | > 95% |
| Frontend Lighthouse score | Unknown | > 80 | > 90 |
| Test coverage | Unknown | > 60% | > 75% |
| 0 critical security issues | 3 | 0 | 0 |

---

**Document Version:** 1.0
**Last Updated:** February 16, 2026
**Next Review:** End of Sprint 2

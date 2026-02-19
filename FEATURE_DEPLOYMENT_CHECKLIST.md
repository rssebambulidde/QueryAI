# QueryAI — Feature Deployment Checklist

> Use this document to verify every UI element and feature after deploying the major update.
> Mark each item ✅ (visible/working) or ❌ (missing/broken) as you test.

---

## Prerequisites — Database Migrations

These SQL migrations **must be run** in Supabase SQL Editor (in order) before any features will work:

| # | Migration File | What It Creates |
|---|----------------|-----------------|
| 036 | `036_save_message_pair_rpc.sql` | `private.save_message_pair` RPC |
| 037 | `037_get_conversations_with_metadata.sql` | `private.get_conversations_with_metadata` RPC |
| 038 | `038_answer_evaluations.sql` | `answer_evaluations` table + `private.get_evaluation_aggregates` RPC |
| 039 | `039_message_versioning.sql` | `messages.version` + `parent_message_id` columns + version RPCs |
| 040 | `040_citation_clicks.sql` | `citation_clicks` table + 4 RPCs |
| 041 | `041_cited_sources.sql` | `cited_sources` + `cited_source_conversations` tables + 4 RPCs |
| 042 | `042_message_feedback.sql` | `message_feedback` table + 4 RPCs |
| 043 | `043_topic_hierarchy.sql` | `topics.parent_topic_id` + `topic_path` + recursive RPCs |

⚠️ **If migrations 038–043 are not run, the corresponding features will error silently or return empty data.**

---

## 1. Research Workspace Page (`/workspace`)

| # | What to Look For | Where | Status |
|---|-----------------|-------|--------|
| 1.1 | **"Research Workspace"** page loads at `/workspace` URL | Browser URL bar | ☐ |
| 1.2 | **Header bar** — back arrow (← to `/dashboard`), "Research Workspace" title with grid icon, topic/document count badges | Top of page | ☐ |
| 1.3 | **Refresh button** (top-right of header) | Header right side | ☐ |
| 1.4 | **Interactive graph canvas** — zoomable, pannable area with a light grid background | Main content area | ☐ |
| 1.5 | **Topic nodes** — coloured rounded cards (blue, green, orange, purple, etc.) with BookOpen icon, topic name, document count, conversation count | Left side of graph | ☐ |
| 1.6 | **Document nodes** — smaller white cards with file-type badge (PDF red, DOCX blue, TXT grey, MD purple), filename, file size | Right side of graph | ☐ |
| 1.7 | **Edges (lines)** connecting topic nodes to their document nodes | Between topic and document nodes | ☐ |
| 1.8 | **Zoom controls** (+ / − / fit view) in a floating panel | Bottom-left of canvas | ☐ |
| 1.9 | **Minimap** — small overview rectangle | Bottom-right of canvas | ☐ |
| 1.10 | **"Research Map" side panel** — collapsible panel on the right showing "Most cited sources per topic" | Right edge of page | ☐ |
| 1.11 | **Toggle button** — when Research Map panel is collapsed, a floating button labeled "Research Map" with star icon appears | Top-right of canvas | ☐ |
| 1.12 | **Clicking a topic node** navigates to `/dashboard?topicId=<id>` | Click interaction | ☐ |
| 1.13 | **Clicking a document node** navigates to document settings | Click interaction | ☐ |
| 1.14 | **Empty state** — when no topics/documents: BookOpen icon, "No research data yet" message | Centre of canvas | ☐ |
| 1.15 | **Loading spinner** while data loads | Centre of page | ☐ |

---

## 2. "My Sources" Panel (Sidebar)

| # | What to Look For | Where | Status |
|---|-----------------|-------|--------|
| 2.1 | **"My Sources" section header** (uppercase, small text) with search icon button | Left sidebar, below conversations | ☐ |
| 2.2 | **Search toggle** — clicking the search icon shows an input field with placeholder "Search sources..." | Below section header | ☐ |
| 2.3 | **Source list items** — each with: type icon (Globe for web / FileText for document), source title, domain name, conversation count (message icon + number), citation count ("N× cited") | Below header in sidebar | ☐ |
| 2.4 | **ChevronRight arrow** on each source item (visible on hover) | Right edge of each source item | ☐ |
| 2.5 | **Per-topic highlight card** — orange-bordered card titled "Top in: [topic name]" with TrendingUp icon, showing top 5 sources when a topic is selected | Below search, above full list | ☐ |
| 2.6 | **Empty state** — "No cited sources yet. Start asking questions to build your source library." | When no sources exist | ☐ |
| 2.7 | **Loading skeleton** — 5 pulsing grey bars during load | While loading | ☐ |

---

## 3. Source Explorer Modal

| # | What to Look For | Where | Status |
|---|-----------------|-------|--------|
| 3.1 | **Modal opens** when clicking any source in "My Sources" panel | Overlay on page | ☐ |
| 3.2 | **Modal header** — source type icon, source title, domain, citation count, conversation count, X close button | Top of modal | ☐ |
| 3.3 | **Source URL row** — clickable link with ExternalLink icon (opens in new tab) | Below header, grey background | ☐ |
| 3.4 | **"Cited in conversations" list** — each item has MessageSquare icon, conversation title, snippet (2-line clamp), topic badge, date with clock icon, ArrowRight on hover | Scrollable main body | ☐ |
| 3.5 | **Clicking a conversation** navigates to that conversation in the chat | Click interaction | ☐ |
| 3.6 | **Empty state** — MessageSquare icon, "No conversations found" | When no conversations | ☐ |
| 3.7 | **Close button** at bottom footer | Bottom-right of modal | ☐ |
| 3.8 | **Mobile-responsive** — full-screen on mobile, max-width card on desktop | Responsive | ☐ |

---

## 4. Message Feedback (Thumbs Up/Down)

| # | What to Look For | Where | Status |
|---|-----------------|-------|--------|
| 4.1 | **ThumbsUp icon button** on assistant messages | Action bar below each AI response | ☐ |
| 4.2 | **ThumbsDown icon button** on assistant messages | Action bar below each AI response | ☐ |
| 4.3 | **Active state colour** — ThumbsUp turns green when clicked, ThumbsDown turns red | After clicking | ☐ |
| 4.4 | **Comment input** appears after clicking a thumbs rating | Below the thumbs buttons | ☐ |
| 4.5 | **Flag citation button** (Flag icon) on assistant messages | Action bar | ☐ |
| 4.6 | **Toggling** — clicking the same thumb again removes the feedback | Click interaction | ☐ |

> **Requires:** Migration 042 (`message_feedback` table)

---

## 5. Answer Regeneration & Version History

| # | What to Look For | Where | Status |
|---|-----------------|-------|--------|
| 5.1 | **Regenerate button** (RefreshCw / ↻ icon) on assistant messages | Action bar below each AI response | ☐ |
| 5.2 | **Dropdown on regenerate** — option to pick different model/parameters | Click regenerate dropdown | ☐ |
| 5.3 | **Version badge** (e.g. "v2", "v3") on messages that have been regenerated | Top-right or near the message | ☐ |
| 5.4 | **Version history dropdown** (History icon) — lists all versions with dates | Action bar, clicking History icon | ☐ |
| 5.5 | **Selecting an older version** replaces the displayed message content | Click interaction | ☐ |
| 5.6 | **"Compare Versions" modal** opens (full-screen overlay) | From version history UI | ☐ |
| 5.7 | Modal has **side-by-side diff panes** (left = old, right = new) | Compare modal body | ☐ |
| 5.8 | **Diff highlighting** — red strikethrough for removed, green for added, plain for same | Diff panes | ☐ |
| 5.9 | **Stats badges** at top — "N removed" (red), "N added" (green), "N% similar" (grey) | Compare modal header | ☐ |
| 5.10 | **Version selectors** with dropdown + chevron left/right to navigate versions | Compare modal, between header and diff | ☐ |
| 5.11 | **Model + date** shown for each version pane | Below version label | ☐ |
| 5.12 | **Close button** (X) on the compare modal | Top-right of modal | ☐ |

> **Requires:** Migration 039 (`messages.version` + `parent_message_id`)

---

## 6. Conversation Export

| # | What to Look For | Where | Status |
|---|-----------------|-------|--------|
| 6.1 | **Export button/option** in conversation settings or actions menu | Conversation header/settings area | ☐ |
| 6.2 | **Export dialog** opens with format selector | Overlay/dialog | ☐ |
| 6.3 | **Format options:** PDF, Markdown, DOCX | Radio buttons or dropdown in dialog | ☐ |
| 6.4 | **"Include Sources" toggle** (default: on) | Dialog body | ☐ |
| 6.5 | **"Include Bibliography" toggle** (default: on) | Dialog body | ☐ |
| 6.6 | **Export button** triggers download | Dialog footer | ☐ |
| 6.7 | **Downloaded file** — correct format (`.pdf`, `.md`, `.docx`) with conversation content, inline footnote citations, and a bibliography section | Filesystem | ☐ |

---

## 7. Topic Tree (Hierarchy / Nesting)

| # | What to Look For | Where | Status |
|---|-----------------|-------|--------|
| 7.1 | **Topic tree** in sidebar replaces flat topic list | Sidebar topic filters section | ☐ |
| 7.2 | **Expand/collapse chevrons** (▶ / ▼) on topics with children | Left of each parent topic | ☐ |
| 7.3 | **FolderOpen icon** on parent topics, **FileText icon** on leaf topics | Left of topic name | ☐ |
| 7.4 | **Indentation** — child topics indented 16px per level | Visual hierarchy | ☐ |
| 7.5 | **"Add sub-topic" button** (Plus icon) appears on hover over any topic | Right edge of topic row | ☐ |
| 7.6 | **Selected topic** highlighted in orange background | Active topic | ☐ |
| 7.7 | **"New topic" button** at top of tree (if enabled) | Top of topic tree | ☐ |
| 7.8 | **Auto-expand** — ancestors of selected topic are pre-expanded | On load | ☐ |
| 7.9 | **Small trees (≤20 topics)** — all parent nodes auto-expanded | On load | ☐ |

> **Requires:** Migration 043 (`topics.parent_topic_id` + `topic_path`)

---

## 8. Chat Error Boundary

| # | What to Look For | Where | Status |
|---|-----------------|-------|--------|
| 8.1 | **Per-message fallback** — amber box with ⚠ "Something went wrong rendering this message." | Replaces a broken AI message | ☐ |
| 8.2 | **"View raw text" toggle** (Eye icon → shows raw markdown) | Inside fallback box | ☐ |
| 8.3 | **"Try again" button** (RotateCcw icon) re-renders the message | Inside fallback box | ☐ |
| 8.4 | **Chat-level fallback** — "Something went wrong rendering the chat" (centered, larger) | Replaces entire chat area on crash | ☐ |
| 8.5 | **Dev mode only** — error message text shown at bottom | Below "Try again" (dev only) | ☐ |

> **Note:** You'll only see this if a rendering error occurs. It's a safety net.

---

## 9. Document Upload Progress (Enhanced)

| # | What to Look For | Where | Status |
|---|-----------------|-------|--------|
| 9.1 | **Stage-specific label** during processing — e.g. "Extracting text…", "Splitting into chunks…", "Creating embeddings…", "Indexing in vector store…" | Upload progress card | ☐ |
| 9.2 | **Progress percentage** (0–100%) | Upload progress card | ☐ |
| 9.3 | **Smooth transitions** between stages (queued → downloading → extracting → chunking → embedding → indexing → completed) | During document upload processing | ☐ |
| 9.4 | **Failure state** — shows "Failed at: [stage]" with error message | If processing fails | ☐ |

---

## 10. Improved Inline Citations

| # | What to Look For | Where | Status |
|---|-----------------|-------|--------|
| 10.1 | **Citation badges** — `[Web Source 1]` maps to the 1st web source (not 1st overall), `[Document 1]` maps to 1st document source | Inline in AI responses | ☐ |
| 10.2 | **No duplicate citations** — trailing "Sources: [Web Source 1], [Web Source 2]" summary line is stripped | End of AI responses | ☐ |
| 10.3 | **Citation click fires analytics tracking** | Clicking any citation badge | ☐ |
| 10.4 | **Tooltip/popover** on citation hover shows source details | Hover interaction | ☐ |

---

## 11. Backend-Only Features (No Direct UI — Verify via Logs/Admin)

| # | Feature | How to Verify | Status |
|---|---------|---------------|--------|
| 11.1 | **LLM-as-judge evaluation** — 5% of queries get quality scores | Check `answer_evaluations` table in Supabase | ☐ |
| 11.2 | **Negative feedback → auto-evaluation** — 100% of thumbs-down | Submit thumbs-down, check `answer_evaluations` | ☐ |
| 11.3 | **Multi-hop query decomposition** — complex questions split into 2-3 sub-queries | Ask a comparative question, check backend logs for "Query decomposed" | ☐ |
| 11.4 | **Structured JSON output** — AI returns `{answer, followUpQuestions, citedSources}` | Check backend logs or response structure | ☐ |
| 11.5 | **Incremental JSON stream parser** — answer text streams in real-time from JSON | Observe smooth token-by-token streaming in chat | ☐ |
| 11.6 | **Domain boost scores** — frequently-clicked source domains get higher RAG weight | Check `citation_clicks` + Redis `citation:domain_boosts` | ☐ |
| 11.7 | **Atomic message saving** — user+assistant messages saved in single transaction | Check `messages` table (pairs have same created_at) | ☐ |
| 11.8 | **Optimised conversation listing** — single RPC returns conversations with metadata | Check sidebar load performance | ☐ |

---

## Quick Navigation Map

```
┌─────────────────────────────────────────────────────────────────┐
│ /workspace                                                       │
│ ┌──────────────────────┐  ┌──────────────────────────────────┐  │
│ │   Graph Canvas       │  │  Research Map Panel (collapsible) │  │
│ │  • Topic nodes (L)   │  │  • Most cited per topic          │  │
│ │  • Document nodes (R)│  │  • Star icon per citation        │  │
│ │  • Edges             │  └──────────────────────────────────┘  │
│ │  • Zoom/Minimap      │                                         │
│ └──────────────────────┘                                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ /dashboard                                                       │
│ ┌─────────────┐  ┌───────────────────────────────────────────┐  │
│ │  SIDEBAR     │  │  CHAT AREA                                │  │
│ │             │  │                                           │  │
│ │ Topic Tree  │  │  [User message]                           │  │
│ │  ▶ Parent   │  │                                           │  │
│ │    ▶ Child  │  │  [AI response]                            │  │
│ │  ▶ Topic 2  │  │   ├ Inline citations [1] [2]             │  │
│ │             │  │   ├ Follow-up questions                   │  │
│ │─────────────│  │   └ Action bar:                           │  │
│ │ My Sources  │  │      👍 👎 🔄Regen 📋Copy 🏷Flag         │  │
│ │  🌐 Reuters │  │      📊v2 ⏱History                       │  │
│ │  📄 Policy  │  │                                           │  │
│ │  🌐 BBC     │  │  ┌─ Export Dialog ─────────────────────┐  │  │
│ │             │  │  │ Format: ○PDF ○Markdown ○DOCX        │  │  │
│ │             │  │  │ ☑ Include Sources                    │  │  │
│ │             │  │  │ ☑ Include Bibliography               │  │  │
│ │             │  │  │              [Export] [Cancel]        │  │  │
│ │             │  │  └─────────────────────────────────────┘  │  │
│ └─────────────┘  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Source Explorer Modal (overlay)                                   │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ 🌐 Reuters Article                          [X]           │   │
│ │ reuters.com · 12× cited · 5 conversations                │   │
│ │ ─────────────────────────────────────────────────────     │   │
│ │ 🔗 https://reuters.com/article/...                       │   │
│ │ ─────────────────────────────────────────────────────     │   │
│ │ CITED IN CONVERSATIONS                                    │   │
│ │ 💬 "Impact of AI on healthcare"                          │   │
│ │    "Reuters reports that..."  · Research · Jan 15         │   │
│ │ 💬 "Machine learning trends"                             │   │
│ │    "According to the study..."  · ML · Feb 3             │   │
│ │ ─────────────────────────────────────────────────────     │   │
│ │                                          [Close]          │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Compare Versions Modal (overlay)                                 │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ Compare Versions   [3 removed] [5 added] [82% similar] [X]│   │
│ │ LEFT: ◀ [v1 — Jan 15] ▶    RIGHT: ◀ [v3 — Feb 2] ▶     │   │
│ │ ┌──────────────────────┬──────────────────────────┐       │   │
│ │ │ v1 · gpt-4o-mini     │ v3 · gpt-4o-mini         │       │   │
│ │ │ Jan 15, 2026         │ Feb 2, 2026               │       │   │
│ │ │ ─────────────────── │ ─────────────────────     │       │   │
│ │ │ The study found that │ The study found that      │       │   │
│ │ │ ~~old conclusion~~   │ ++new improved answer++   │       │   │
│ │ │ ...                  │ ...                        │       │   │
│ │ └──────────────────────┴──────────────────────────┘       │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Testing Order (Recommended)

1. **Run all 8 migrations** (036–043) in Supabase SQL Editor
2. Verify `/dashboard` loads — sidebar shows **Topic Tree** (§7) and **My Sources** (§2)
3. Ask a question — verify **inline citations** (§10), **streaming** works, **follow-up questions** appear
4. On the AI response, verify **action bar** — thumbs 👍👎 (§4), regenerate 🔄 (§5), export (§6)
5. Click a citation — verify **click tracking** fires (§10.3)
6. Navigate to `/workspace` — verify **Research Graph** (§1)
7. Upload a document — verify **processing progress stages** (§9)
8. Trigger a rendering error (dev tools) — verify **error boundary** (§8)

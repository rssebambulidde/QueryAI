# User Documentation Guide – Plan

## Goal

Create in-app user documentation for **end users only**, covering features and components that are **not** superadmin-accessible. The guide will be placed inside the app so users can refer to it while using QueryAI.

## Scope: In scope (user-facing only)

| Area | Features / components |
|------|------------------------|
| **Dashboard** | Chat tab, Collections tab, sidebar (conversations, new chat, topics) |
| **Chat & research** | Ask questions, streaming answers, citations, source panel, follow-up questions, research mode / topic focus, RAG source selector (Web / Docs) |
| **Conversations** | List, search, create, rename, delete, pin, export |
| **Documents** | Upload, list, view, delete, clear processing, edit metadata, tag with topics |
| **Topics** | Create, edit, delete topics; assign to conversations; filter by topic |
| **Settings** | Profile, Search preferences, Citation preferences, Advanced RAG, Subscription, Documents, Topics; Team collaboration (Enterprise only) |
| **Account** | Account dropdown (profile, settings, subscription, sign out), Private mode toggle |
| **Collections** | View and manage collections (if applicable) |

## Out of scope (not documented in user guide)

- Super Admin settings and pages
- Analytics, AB Testing, Validation, Health dashboards
- Admin user management
- Any `requiresSuperAdmin` or admin-only routes

## Document structure (sections)

1. **Getting started** – Log in, dashboard overview, first question
2. **Chat & research** – Asking questions, Web vs Docs sources, citations, follow-ups, research mode / topics
3. **Conversations** – New chat, sidebar list, search, rename, pin, delete, export
4. **Documents** – Upload, processing, view, metadata, delete, clear processing, topics
5. **Topics** – What topics are, creating/editing, assigning to conversations
6. **Settings** – Profile, Search, Citations, Advanced RAG, Subscription, Documents, Topics; Team (Enterprise)
7. **Account & privacy** – Account menu, private mode, sign out

## Placement in the app

- **Route:** `/dashboard/help` (under dashboard; uses dashboard layout and sidebar)
- **Entry points:**
  - Account dropdown: add **User guide** (or **Help**) link
  - Optional: footer of sidebar or a persistent “Help” link in the main nav

## Technical notes

- Single scrollable page with clear headings and optional anchor links for deep-linking
- Reuse existing styling (e.g. prose, max-width) for consistency with policy pages
- No superadmin-only content; keep language end-user focused

## Success criteria

- Users can open the guide from the app (account menu or similar)
- Every user-visible feature listed above has a short, clear explanation
- Superadmin-only features are not mentioned in the user guide

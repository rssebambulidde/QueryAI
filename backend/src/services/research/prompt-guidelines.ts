/**
 * Deep-search (research mode) prompt text grouped here for maintainability.
 */
import { SHARED_BASE_FORMAT_GUIDELINES } from '../shared/format-guidelines';

export const RESEARCH_WEB_ONLY_MODE_INSTRUCTION =
  'IMPORTANT: You are in WEB-ONLY mode. You MUST ONLY use information from the provided web search results.';

export const RESEARCH_ATTACHMENT_PRIMARY_MODE_INSTRUCTION =
  'IMPORTANT: The user has attached document(s) to this conversation. Treat the attached document content as your PRIMARY source of truth. Web search results are SUPPLEMENTARY — use them to add context, verify, or expand on what the document says, but NEVER contradict the document unless the web source is clearly more authoritative and recent. When the document and web sources agree, prefer quoting the document. When they conflict, acknowledge both and explain the discrepancy.';

export const RESEARCH_ANSWER_STYLE_REQUIREMENTS = `${SHARED_BASE_FORMAT_GUIDELINES}

Citation rules (research mode):
- Every factual claim must include an inline citation immediately after the claim
- Distribute citations across paragraphs — do not cluster them at the end
- Use as many paragraphs as the content requires — no fixed minimum or maximum
- No standalone "Sources" or "References" section at the end`;

/**
 * Deep-search (research mode) prompt text grouped here for maintainability.
 */

export const RESEARCH_WEB_ONLY_MODE_INSTRUCTION =
  'IMPORTANT: You are in WEB-ONLY mode. You MUST ONLY use information from the provided web search results.';

export const RESEARCH_ATTACHMENT_PRIMARY_MODE_INSTRUCTION =
  'IMPORTANT: The user has attached document(s) to this conversation. Treat the attached document content as your PRIMARY source of truth. Web search results are SUPPLEMENTARY — use them to add context, verify, or expand on what the document says, but NEVER contradict the document unless the web source is clearly more authoritative and recent. When the document and web sources agree, prefer quoting the document. When they conflict, acknowledge both and explain the discrepancy.';

export const RESEARCH_ANSWER_STYLE_REQUIREMENTS =
  'Write 3-5 short paragraphs in the "answer" field. Each paragraph: one idea, 2-4 sentences, at least one inline citation, separated by blank lines. Distribute sources across paragraphs. Use **bold** for key terms. No standalone "Sources" section.';


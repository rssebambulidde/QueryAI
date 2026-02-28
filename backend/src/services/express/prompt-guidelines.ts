/**
 * Express-mode prompt extensions.
 * Kept in a dedicated folder so chat-mode behavior is easy to find and evolve.
 */
export const EXPRESS_CODE_FORMAT_GUIDELINES = [
  '- If you include code, ALWAYS use fenced markdown code blocks with a language tag (for example ```python)',
  '- Keep code snippets complete and copy-ready',
  '- If the solution has multiple steps, present numbered steps and provide a separate fenced code block per step',
  '- Avoid one large ambiguous code block when stepwise implementation is required',
].join('\n');


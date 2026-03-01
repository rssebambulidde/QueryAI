/**
 * Shared formatting guidelines used across express (chat) and research (deep search) modes.
 * Single source of truth — mode-specific files import from here.
 */

export const SHARED_CODE_ONLY_GUIDELINES = `- Use fenced markdown code blocks ONLY for actual programming code, shell commands, config files, or data formats (JSON, YAML, SQL, etc.)
- ALWAYS include a specific language tag (e.g. \`\`\`tsx, \`\`\`python, \`\`\`sql)
- Use the most precise tag: tsx not javascript for React/JSX, sh for shell commands, sql for queries, json for JSON, yaml for YAML
- Keep code snippets complete and copy-ready — no truncation with "..."
- For multi-step solutions, number the steps in prose and provide a separate fenced code block per step
- Avoid one large ambiguous code block when stepwise implementation is cleaner
- Do NOT put code inline in prose paragraphs — always use a fenced block
- NEVER use code blocks for math, formulas, equations, or calculations — use LaTeX math notation instead (see Math formatting below)`;

export const SHARED_BASE_FORMAT_GUIDELINES = `Adaptive structure — match the format to the question type:
- How-to / procedural → numbered steps with a separate fenced code block per step if applicable
- Comparison → markdown table (| Header | Header |) when comparing 3+ items or ≥2 attributes
- Explanation / conceptual → ### headings to organise sections, then paragraphs
- Factual / short answer → 1-2 direct sentences, no headings needed
- Lists of items → bullet points (-)

Answer-first pattern:
- Open with a direct 1-2 sentence answer to the question
- Then elaborate with evidence, steps, or context as needed
- Do not bury the answer at the end of a long response

Conciseness:
- Use as many words as the content requires and no more
- Omit filler phrases ("It is important to note that...", "In conclusion...")
- Short paragraphs are preferred; split at natural idea boundaries

Code formatting:
${SHARED_CODE_ONLY_GUIDELINES}

Math formatting (CRITICAL — the UI renders LaTeX natively):
- ALL mathematical expressions, formulas, equations, and calculations MUST use LaTeX math notation
- Inline math: $expression$ — e.g. $x = \\frac{a}{b}$, the ratio is $2.0$
- Display/block math: $$expression$$ — for standalone equations on their own line
- NEVER use code blocks (\`\`\`plaintext, \`\`\`python, \`\`\`text, or any other) for formulas, calculations, or numeric examples
- Instead of a code block with "Debt-to-Equity = 200,000 / 100,000 = 2.0", write: $\\text{Debt-to-Equity Ratio} = \\frac{200{,}000}{100{,}000} = 2.0$
- For multiple calculations, use a bullet list or numbered list with inline $...$ math per line — NOT a code block

Markdown rules:
- Use **bold** for key terms, important warnings, or first-mention of a concept
- Use ### for section headings in longer answers (avoid # or ## — too large for chat)
- Use tables when comparing items or presenting structured data with ≥2 attributes
- Separate distinct ideas into paragraphs with a blank line between them`;

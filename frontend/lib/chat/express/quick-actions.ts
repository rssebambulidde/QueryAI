export type QuickAction = { label: string; prompt: string };

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'your', 'you',
  'are', 'was', 'were', 'have', 'has', 'had', 'about', 'what', 'when', 'where',
  'how', 'why', 'can', 'could', 'should', 'would', 'will', 'use', 'using',
  'please', 'need', 'help', 'show', 'give', 'make', 'build', 'create', 'write',
  'code', 'snippet', 'explain', 'response', 'answer', 'more', 'like', 'than',
]);

function normalize(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFocus(userQuestion: string, assistantAnswer: string): string {
  const source = normalize(userQuestion || assistantAnswer).toLowerCase();
  const words = source
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  if (words.length === 0) return 'this';
  return words.slice(0, 3).join(' ');
}

export function buildQuickAssistActions(
  userQuestion: string,
  assistantAnswer: string
): QuickAction[] {
  const actions: QuickAction[] = [];
  const seenPrompts = new Set<string>();
  const question = normalize(userQuestion);
  const answer = normalize(assistantAnswer);
  const focus = extractFocus(question, answer);
  const hasCode = /```|(^|\s)(const|let|var|function|class|import|export|def|return)\b/i.test(assistantAnswer);
  const isTroubleshooting = /\b(error|bug|fix|issue|fails?|not working|wrong)\b/i.test(`${question} ${answer}`);
  const asksComparison = /\b(compare|difference|vs|versus)\b/i.test(question);

  const add = (label: string, prompt: string) => {
    const key = prompt.trim().toLowerCase();
    if (!key || seenPrompts.has(key)) return;
    seenPrompts.add(key);
    actions.push({ label, prompt });
  };

  add('Explain simpler', `Can you explain ${focus} in simpler terms?`);

  if (hasCode) {
    add('Fix issues', 'Can you review the code, fix likely bugs, and explain each fix briefly?');
    add('Step-by-step code', 'Can you rewrite this as numbered steps with a separate code block for each step?');
    add('Add tests', 'Can you add minimal test cases for this code and expected outputs?');
  } else {
    add('Show example', `Can you give a practical example for ${focus}?`);
    if (asksComparison) {
      add('Make a table', `Can you summarize ${focus} in a comparison table?`);
    } else {
      add('Action plan', `Can you give a short step-by-step plan to apply this to ${focus}?`);
    }
    add('Write code', `If relevant, can you show a clean code snippet for ${focus}?`);
  }

  if (isTroubleshooting) {
    add('Debug checklist', 'Can you give me a quick checklist to diagnose and verify the fix?');
  }

  add('Next steps', `What should I do next for ${focus}?`);

  while (actions.length < 4) {
    add('Follow-up', 'Can you take this one level deeper with a concise follow-up?');
  }

  return actions.slice(0, 4);
}


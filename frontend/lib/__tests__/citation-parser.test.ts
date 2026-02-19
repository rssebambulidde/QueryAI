/**
 * Pure-logic test for parseCitations().
 *
 * Run:  npx tsx frontend/lib/__tests__/citation-parser.test.ts
 *
 * Verifies:
 *  1. Type-specific indexing (Web Source N → Nth web source, not Nth overall)
 *  2. Each citation renders exactly once (no duplicates from Sources: line)
 *  3. Trailing "Sources:" summary line is stripped
 */

// Inline the CitationMatch type to avoid path alias issues in standalone run
interface CitationMatch {
  type: 'web' | 'document';
  number: number;
  index: number;
  sourceIndex: number;
  fullMatch: string;
}

interface Source {
  type: 'web' | 'document';
  title: string;
  url?: string;
  documentId?: string;
  snippet?: string;
  score?: number;
}

// ── Inline the parseCitations function for standalone testing ─────────
function parseCitations(content: string, sources: Source[]): {
  processedContent: string;
  citations: CitationMatch[];
} {
  const citations: CitationMatch[] = [];
  if (!sources || sources.length === 0) {
    return { processedContent: content, citations };
  }

  const cleaned = content.replace(
    /\n+Sources:\s*(?:\[(?:Web Source|Document)\s+\d+\](?:\([^)]+\))?[\s,]*)+\s*$/gi,
    ''
  );

  const webSources = sources.filter(s => s.type === 'web');
  const docSources = sources.filter(s => s.type === 'document');
  const citationPattern = /\[(Web Source|Document)\s+(\d+)\](?:\(([^)]+)\))?/gi;

  const matches: Array<{ match: RegExpExecArray; index: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = citationPattern.exec(cleaned)) !== null) {
    matches.push({ match, index: match.index });
  }
  matches.sort((a, b) => b.index - a.index);

  let processedContent = cleaned;
  matches.forEach(({ match: m, index }) => {
    const fullMatch = m[0];
    const type: 'web' | 'document' = m[1].toLowerCase().includes('web') ? 'web' : 'document';
    const number = parseInt(m[2], 10);
    const typeFiltered = type === 'web' ? webSources : docSources;
    const typeIndex = number - 1;

    if (typeIndex >= 0 && typeIndex < typeFiltered.length) {
      const source = typeFiltered[typeIndex];
      const globalIndex = sources.indexOf(source);
      const citation: CitationMatch = { type, number, index, sourceIndex: globalIndex, fullMatch };
      const placeholder = `__CITATION_${citations.length}__`;
      citations.push(citation);
      processedContent =
        processedContent.substring(0, index) + placeholder + processedContent.substring(index + fullMatch.length);
    }
  });

  citations.sort((a, b) => a.index - b.index);
  return { processedContent, citations };
}

// ── Test helpers ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

// ── Test data ────────────────────────────────────────────────────────

const sources: Source[] = [
  { type: 'document', title: 'Internal Policy', documentId: 'doc-1' },
  { type: 'web', title: 'Reuters Article', url: 'https://reuters.com/a' },
  { type: 'web', title: 'BBC News', url: 'https://bbc.com/b' },
  { type: 'document', title: 'Handbook', documentId: 'doc-2' },
];

// ── Test 1: Type-specific indexing ───────────────────────────────────

console.log('\nTest 1: Type-specific indexing');
{
  const content = 'Claim A [Web Source 1]. Claim B [Web Source 2]. Claim C [Document 1].';
  const { citations } = parseCitations(content, sources);

  assert(citations.length === 3, `Found 3 citations (got ${citations.length})`);

  // [Web Source 1] → 1st web source → sources[1] (Reuters)
  assert(citations[0].sourceIndex === 1, `Web Source 1 → sources[1] Reuters (got ${citations[0].sourceIndex})`);
  // [Web Source 2] → 2nd web source → sources[2] (BBC)
  assert(citations[1].sourceIndex === 2, `Web Source 2 → sources[2] BBC (got ${citations[1].sourceIndex})`);
  // [Document 1] → 1st document → sources[0] (Internal Policy)
  assert(citations[2].sourceIndex === 0, `Document 1 → sources[0] Internal Policy (got ${citations[2].sourceIndex})`);
}

// ── Test 2: Each citation renders exactly once (Sources: line stripped) ──

console.log('\nTest 2: Each citation exactly once with Sources: line');
{
  const content =
    'Claim A [Web Source 1]. Claim B [Web Source 2].\n\nSources: [Web Source 1](https://reuters.com/a), [Web Source 2](https://bbc.com/b)';
  const { processedContent, citations } = parseCitations(content, sources);

  // Only the 2 inline citations, NOT the ones in the stripped Sources: line
  assert(citations.length === 2, `Exactly 2 citations (got ${citations.length})`);

  // The "Sources: ..." line should be removed
  assert(!processedContent.includes('Sources:'), 'Sources: line was stripped');
  assert(processedContent.includes('__CITATION_'), 'Inline citations have placeholders');
}

// ── Test 3: Sources: line at end is stripped ─────────────────────────

console.log('\nTest 3: Trailing Sources: line stripped');
{
  const content = 'Some text [Document 1].\n\nSources: [Document 1]';
  const { processedContent, citations } = parseCitations(content, sources);

  assert(citations.length === 1, `Exactly 1 citation (got ${citations.length})`);
  assert(!processedContent.includes('Sources:'), 'Trailing Sources: line removed');
}

// ── Test 4: No sources → passthrough ────────────────────────────────

console.log('\nTest 4: No sources passthrough');
{
  const content = 'Hello [Web Source 1]';
  const { processedContent, citations } = parseCitations(content, []);

  assert(citations.length === 0, 'No citations when no sources');
  assert(processedContent === content, 'Content unchanged');
}

// ── Test 5: Out-of-range citation left as-is ────────────────────────

console.log('\nTest 5: Out-of-range citation left as-is');
{
  const content = 'Only two web sources: [Web Source 1] [Web Source 3]';
  const { processedContent, citations } = parseCitations(content, sources);

  assert(citations.length === 1, `1 valid citation (got ${citations.length})`);
  assert(processedContent.includes('[Web Source 3]'), 'Out-of-range ref left as text');
}

// ── Summary ──────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

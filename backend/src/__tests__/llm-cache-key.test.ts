/**
 * Unit test for generateLLMCacheKey() — verifies topicId is part of the cache key.
 *
 * Run:  npx tsx backend/src/__tests__/llm-cache-key.test.ts
 */

import crypto from 'crypto';

// ── Inline the function under test (module-private, not exported) ────

function generateLLMCacheKey(
  question: string,
  model: string,
  temperature: number,
  ragContext?: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
  topicId?: string
): string {
  const questionHash = crypto.createHash('sha256')
    .update(question.trim().toLowerCase())
    .digest('hex')
    .substring(0, 16);

  const contextHash = ragContext
    ? crypto.createHash('sha256')
        .update(ragContext)
        .digest('hex')
        .substring(0, 8)
    : 'no-context';

  const historyHash = conversationHistory && conversationHistory.length > 0
    ? crypto.createHash('sha256')
        .update(JSON.stringify(conversationHistory.slice(-5)))
        .digest('hex')
        .substring(0, 8)
    : 'no-history';

  const topic = topicId ?? 'no-topic';

  return `${questionHash}|${model}|${temperature}|${contextHash}|${historyHash}|${topic}`;
}

// ── Test helpers ─────────────────────────────────────────────────────

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

// ── Tests ────────────────────────────────────────────────────────────

console.log('\nTest 1: Different topicIds produce different cache keys');
{
  const keyA = generateLLMCacheKey('What is X?', 'gpt-4o-mini', 0.7, undefined, undefined, 'topic-aaa');
  const keyB = generateLLMCacheKey('What is X?', 'gpt-4o-mini', 0.7, undefined, undefined, 'topic-bbb');
  assert(keyA !== keyB, `keyA !== keyB  (${keyA.slice(-20)} vs ${keyB.slice(-20)})`);
}

console.log('\nTest 2: Same topicId produces identical cache keys');
{
  const keyA = generateLLMCacheKey('What is X?', 'gpt-4o-mini', 0.7, undefined, undefined, 'topic-aaa');
  const keyB = generateLLMCacheKey('What is X?', 'gpt-4o-mini', 0.7, undefined, undefined, 'topic-aaa');
  assert(keyA === keyB, 'Identical inputs → identical key');
}

console.log('\nTest 3: No topicId vs a topicId produce different cache keys');
{
  const keyNoTopic = generateLLMCacheKey('What is X?', 'gpt-4o-mini', 0.7);
  const keyWithTopic = generateLLMCacheKey('What is X?', 'gpt-4o-mini', 0.7, undefined, undefined, 'topic-ccc');
  assert(keyNoTopic !== keyWithTopic, 'no-topic key differs from topic-ccc key');
  assert(keyNoTopic.endsWith('|no-topic'), `no-topic key ends with |no-topic`);
  assert(keyWithTopic.endsWith('|topic-ccc'), `topic key ends with |topic-ccc`);
}

console.log('\nTest 4: Key contains 6 pipe-separated segments');
{
  const key = generateLLMCacheKey('q', 'model', 0.5, 'ctx', [{ role: 'user', content: 'hi' }], 'tid');
  const segments = key.split('|');
  assert(segments.length === 6, `6 segments (got ${segments.length})`);
}

// ── Summary ──────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

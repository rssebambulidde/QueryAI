/**
 * Email service tests: templates, formatting, queue, preferences.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  substituteVariables,
  extractVariables,
  renderTemplate,
  htmlToPlainText,
  getTemplate,
  listTemplateIds,
} from '../services/email-templates.service';
import type { TemplateId } from '../services/email-templates.service';
import { enqueueEmail, processEmailQueue, getEmailLogs } from '../services/email-queue.service';

const emptyResult = { data: [], error: null };
const selectChain: Record<string, any> = {
  eq: () => selectChain,
  order: () => selectChain,
  limit: () => selectChain,
};
selectChain.then = (r: (v: typeof emptyResult) => void) => {
  r(emptyResult);
  return selectChain;
};
selectChain.catch = () => selectChain;
jest.mock('../config/database', () => ({
  supabaseAdmin: {
    from: () => ({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'log-123' }, error: null }),
        }),
      }),
      select: () => selectChain,
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

jest.mock('../config/env', () => ({
  default: {
    BREVO_API_KEY: null,
    BREVO_SENDER_EMAIL: 'noreply@test.com',
    BREVO_SENDER_NAME: 'QueryAI',
  },
}));

describe('Email template system', () => {
  describe('substituteVariables', () => {
    it('replaces {{var}} placeholders', () => {
      expect(substituteVariables('Hello {{name}}', { name: 'Alice' })).toBe('Hello Alice');
      expect(substituteVariables('{{a}} {{b}}', { a: '1', b: '2' })).toBe('1 2');
    });

    it('handles missing vars as empty string', () => {
      expect(substituteVariables('Hello {{name}}', {})).toBe('Hello ');
      expect(substituteVariables('{{x}}', { y: 'z' })).toBe('');
    });

    it('handles numbers', () => {
      expect(substituteVariables('{{n}}', { n: 42 })).toBe('42');
    });
  });

  describe('extractVariables', () => {
    it('extracts {{var}} names', () => {
      expect(extractVariables('{{a}} and {{b}}')).toEqual(expect.arrayContaining(['a', 'b']));
      expect(extractVariables('{{x}}')).toEqual(['x']);
    });

    it('returns unique names', () => {
      const v = extractVariables('{{a}} {{a}}');
      expect(v.filter((x) => x === 'a')).toHaveLength(1);
    });

    it('returns empty for no placeholders', () => {
      expect(extractVariables('no vars')).toEqual([]);
    });
  });

  describe('htmlToPlainText', () => {
    it('strips HTML tags', () => {
      expect(htmlToPlainText('<p>Hi</p>')).toMatch(/Hi/);
      expect(htmlToPlainText('<a href="#">Link</a>')).toMatch(/Link/);
    });

    it('collapses whitespace', () => {
      expect(htmlToPlainText('a  b')).toMatch(/\sa\sb\s/);
    });
  });

  describe('renderTemplate', () => {
    it('renders payment_success with vars', () => {
      const out = renderTemplate('payment_success', {
        userName: 'Test',
        amount: 10,
        currency: 'USD',
        tier: 'starter',
      });
      expect(out.subject).toContain('Payment Successful');
      expect(out.html).toContain('Test');
      expect(out.html).toContain('10');
      expect(out.html).toContain('USD');
      expect(out.text.length).toBeGreaterThan(0);
    });

    it('includes {{year}} in output', () => {
      const out = renderTemplate('payment_success', {
        userName: 'A',
        amount: 1,
        currency: 'USD',
        tier: 'free',
      });
      expect(out.html).toMatch(/\d{4}/);
    });

    it('throws for unknown template', () => {
      expect(() => renderTemplate('unknown' as TemplateId, {})).toThrow(/Unknown template/);
    });
  });

  describe('getTemplate / listTemplateIds', () => {
    it('returns template metadata', () => {
      const t = getTemplate('payment_success');
      expect(t.id).toBe('payment_success');
      expect(t.subject).toBeDefined();
      expect(Array.isArray(t.variables)).toBe(true);
    });

    it('lists all template ids', () => {
      const ids = listTemplateIds();
      expect(ids).toContain('payment_success');
      expect(ids).toContain('welcome');
      expect(ids.length).toBeGreaterThan(5);
    });
  });
});

describe('Email queue', () => {
  it('enqueueEmail returns id on success', async () => {
    const id = await enqueueEmail({
      to: 'u@ex.com',
      toName: 'User',
      subject: 'Test',
      html: '<p>Hi</p>',
    });
    expect(id).toBe('log-123');
  });

  it('processEmailQueue returns counts', async () => {
    const r = await processEmailQueue(50);
    expect(r).toEqual({ processed: 0, sent: 0, failed: 0 });
  });

  it('getEmailLogs returns array', async () => {
    const logs = await getEmailLogs({ limit: 10 });
    expect(Array.isArray(logs)).toBe(true);
  });
});

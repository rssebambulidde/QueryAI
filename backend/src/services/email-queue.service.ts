/**
 * Email Queue Service
 * Queue emails for retry on failure, store logs, track delivery status.
 */

import axios, { AxiosInstance } from 'axios';
import logger from '../config/logger';
import config from '../config/env';
import type { TemplateId } from './email-templates.service';

export type EmailLogStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface EnqueueEmailParams {
  to: string;
  toName: string;
  subject: string;
  html: string;
  text?: string;
  userId?: string;
  templateId?: TemplateId | string;
  metadata?: Record<string, unknown>;
}

const BREVO_URL = 'https://api.brevo.com/v3';

function getBrevoClient(): AxiosInstance | null {
  if (!config.BREVO_API_KEY) return null;
  return axios.create({
    baseURL: BREVO_URL,
    headers: {
      'api-key': config.BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
  });
}

async function sendViaBrevo(to: string, toName: string, subject: string, html: string, text?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const client = getBrevoClient();
  if (!client) {
    logger.info('Email queue: Brevo not configured, skipping send');
    return { success: true };
  }
  try {
    const res = await client.post('/smtp/email', {
      sender: { email: config.BREVO_SENDER_EMAIL, name: config.BREVO_SENDER_NAME },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent: html,
      textContent: text || html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
    });
    return { success: true, messageId: res.data?.messageId };
  } catch (e: any) {
    const err = e.response?.data || e.message;
    return { success: false, error: typeof err === 'string' ? err : JSON.stringify(err) };
  }
}

/**
 * Enqueue an email. Inserts into email_logs with status 'pending'.
 */
export async function enqueueEmail(params: EnqueueEmailParams): Promise<string | null> {
  const { supabaseAdmin } = await import('../config/database');
  const { data, error } = await supabaseAdmin
    .from('email_logs')
    .insert({
      user_id: params.userId || null,
      to_email: params.to,
      to_name: params.toName,
      subject: params.subject,
      html_content: params.html,
      text_content: params.text || null,
      template_id: params.templateId || null,
      status: 'pending',
      retry_count: 0,
      max_retries: 3,
      metadata: params.metadata || null,
    })
    .select('id')
    .single();
  if (error) {
    logger.error('Email queue: enqueue failed', { error, to: params.to, subject: params.subject });
    return null;
  }
  return data?.id ?? null;
}

/**
 * Process pending emails: send via Brevo, update status, retry on failure.
 */
export async function processEmailQueue(limit = 50): Promise<{ processed: number; sent: number; failed: number }> {
  const { supabaseAdmin } = await import('../config/database');
  const { data: rows, error } = await supabaseAdmin
    .from('email_logs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error || !rows?.length) {
    if (error) logger.error('Email queue: fetch pending failed', { error });
    return { processed: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    const maxRetries = (row.max_retries ?? 3) as number;
    const retryCount = (row.retry_count ?? 0) as number;
    if (retryCount >= maxRetries) {
      await supabaseAdmin
        .from('email_logs')
        .update({ status: 'failed', last_error: 'Max retries exceeded', updated_at: new Date().toISOString() })
        .eq('id', row.id);
      failed++;
      continue;
    }

    const result = await sendViaBrevo(
      row.to_email,
      row.to_name || row.to_email,
      row.subject,
      row.html_content || '',
      row.text_content || undefined
    );

    if (result.success) {
      await supabaseAdmin
        .from('email_logs')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          brevo_message_id: result.messageId || null,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      sent++;
      logger.info('Email queue: sent', { id: row.id, to: row.to_email, subject: row.subject });
    } else {
      const nextRetry = retryCount + 1;
      const isFinal = nextRetry >= maxRetries;
      await supabaseAdmin
        .from('email_logs')
        .update({
          status: isFinal ? 'failed' : 'pending',
          retry_count: nextRetry,
          last_error: result.error || 'Unknown error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      if (isFinal) failed++;
      logger.warn('Email queue: send failed', { id: row.id, to: row.to_email, retry: nextRetry, error: result.error });
    }
  }

  return { processed: rows.length, sent, failed };
}

/**
 * Fetch email logs for a user (or all recent).
 */
export async function getEmailLogs(options: { userId?: string; limit?: number; status?: EmailLogStatus } = {}): Promise<any[]> {
  const { supabaseAdmin } = await import('../config/database');
  let q = supabaseAdmin.from('email_logs').select('*').order('created_at', { ascending: false }).limit(options.limit ?? 100);
  if (options.userId) q = q.eq('user_id', options.userId);
  if (options.status) q = q.eq('status', options.status);
  const { data, error } = await q;
  if (error) {
    logger.error('Email queue: getEmailLogs failed', { error });
    return [];
  }
  return data ?? [];
}

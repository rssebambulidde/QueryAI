/**
 * Email Template System
 * Reusable templates with variable substitution, HTML and plain text support.
 */

export type TemplateId =
  | 'payment_success'
  | 'payment_failure'
  | 'payment_cancellation'
  | 'payment_reminder'
  | 'payment_retry'
  | 'payment_method_updated'
  | 'invoice'
  | 'refund_confirmation'
  | 'renewal_confirmation'
  | 'failed_renewal'
  | 'upgrade_confirmation'
  | 'downgrade_confirmation'
  | 'expiration_warning'
  | 'welcome'
  | 'reactivation_confirmation'
  | 'cancellation'
  | 'grace_period_warning';

export interface EmailTemplate {
  id: TemplateId;
  subject: string;
  html: string;
  text?: string;
  variables: string[];
}

const BASE_STYLES = `
  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { padding: 20px; text-align: center; color: #fff; }
  .content { padding: 20px; background-color: #f9f9f9; }
  .button { display: inline-block; padding: 12px 24px; background-color: #ff6b35; color: white !important; text-decoration: none; border-radius: 4px; margin-top: 20px; }
  .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
`;

/**
 * Replace {{variable}} placeholders in a string.
 */
export function substituteVariables(template: string, vars: Record<string, string | number | undefined>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v !== undefined && v !== null ? String(v) : '';
  });
}

/**
 * Extract variable names from template ({{name}}).
 */
export function extractVariables(template: string): string[] {
  const re = /\{\{(\w+)\}\}/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) found.add(m[1]);
  return Array.from(found);
}

/**
 * Build full HTML email from layout + body.
 */
function layout(headerColor: string, title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${BASE_STYLES}</style></head>
<body>
<div class="container">
  <div class="header" style="background-color:${headerColor};">
    <h1>${title}</h1>
  </div>
  <div class="content">${body}</div>
  <div class="footer">
    <p>This is an automated message from QueryAI. Please do not reply to this email.</p>
    <p>&copy; {{year}} QueryAI. All rights reserved.</p>
  </div>
</div>
</body>
</html>`;
}

/**
 * Plain text fallback: strip tags, collapse whitespace.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Template definitions. Use {{var}} for substitution.
 * variables array lists required/expected keys (extracted from subject/html when possible).
 */
const TEMPLATES: Record<TemplateId, Omit<EmailTemplate, 'id'>> = {
  payment_success: {
    subject: 'Payment Successful - QueryAI Subscription',
    html: layout(
      '#28a745',
      'Payment Successful!',
      `<p>Hello {{userName}},</p>
<p>Thank you for your payment of <strong>{{amount}} {{currency}}</strong> for your <strong>{{tier}}</strong> subscription.</p>
<p>Your subscription is now active.</p>
<p>Best regards,<br>The QueryAI Team</p>`
    ),
    variables: ['userName', 'amount', 'currency', 'tier', 'year'],
  },
  payment_failure: {
    subject: 'Payment Failed - QueryAI Subscription',
    html: layout(
      '#dc3545',
      'Payment Failed',
      `<p>Hello {{userName}},</p>
<p>We were unable to process your payment of <strong>{{amount}} {{currency}}</strong> for your <strong>{{tier}}</strong> subscription.</p>
<p>{{retryMessage}}</p>
<p>Please update your payment method:</p>
<a href="{{subscriptionUrl}}" class="button">Update Payment Method</a>
<p>Best regards,<br>The QueryAI Team</p>`
    ),
    variables: ['userName', 'amount', 'currency', 'tier', 'retryMessage', 'subscriptionUrl', 'year'],
  },
  payment_cancellation: {
    subject: 'Payment Cancelled - QueryAI',
    html: layout(
      '#6c757d',
      'Payment Cancelled',
      `<p>Hello {{userName}},</p>
<p>Your payment of <strong>{{amount}} {{currency}}</strong> for <strong>{{tier}}</strong> has been cancelled.</p>
<p>No charges were made. <a href="{{subscriptionUrl}}" class="button">Try Again</a></p>
<p>Best regards,<br>The QueryAI Team</p>`
    ),
    variables: ['userName', 'amount', 'currency', 'tier', 'subscriptionUrl', 'year'],
  },
  payment_reminder: {
    subject: 'Your QueryAI Subscription Renews in {{days}} Day(s)',
    html: layout(
      '#ff6b35',
      'Payment Reminder',
      `<p>Hello {{userName}},</p>
<p>Your <strong>{{tier}}</strong> subscription will renew automatically on <strong>{{renewalDate}}</strong>.</p>
{{#if amount}}<p><strong>Amount:</strong> {{amount}} {{currency}}</p>{{/if}}
<p><strong>Payment Method:</strong> {{paymentMethod}}</p>
<p>Please ensure your payment method is up to date to avoid any interruption.</p>
<a href="{{subscriptionUrl}}" class="button">Update Payment Method</a>
<p>Best regards,<br>The QueryAI Team</p>`
    ),
    variables: ['userName', 'tier', 'renewalDate', 'amount', 'currency', 'paymentMethod', 'days', 'subscriptionUrl', 'year'],
  },
  payment_retry: {
    subject: 'We Retried Your Payment - QueryAI',
    html: layout(
      '#ffc107',
      'Payment Retry Notice',
      `<p>Hello {{userName}},</p>
<p>We retried charging for your <strong>{{tier}}</strong> subscription ({{amount}} {{currency}}) but it was unsuccessful.</p>
<p>Retry attempt <strong>#{{retryCount}}</strong> of 3. {{remainingMessage}}</p>
<a href="{{subscriptionUrl}}" class="button">Update Payment Method</a>
<p>Best regards,<br>The QueryAI Team</p>`
    ),
    variables: ['userName', 'tier', 'amount', 'currency', 'retryCount', 'remainingMessage', 'subscriptionUrl', 'year'],
  },
  payment_method_updated: {
    subject: 'Payment Method Updated - QueryAI',
    html: layout(
      '#28a745',
      'Payment Method Updated',
      `<p>Hello {{userName}},</p>
<p>Your payment method has been updated. New card ending in <strong>****{{lastFour}}</strong>.</p>
<p>Best regards,<br>The QueryAI Team</p>`
    ),
    variables: ['userName', 'lastFour', 'year'],
  },
  invoice: {
    subject: 'Your Invoice - QueryAI {{tier}} Subscription',
    html: layout(
      '#ff6b35',
      'Your Invoice',
      `<p>Hello {{userName}},</p>
<p>Please find your invoice attached.</p>
<p><strong>{{tier}}</strong> – <strong>{{amount}}</strong> | Invoice #{{invoiceId}}</p>
<p>Best regards,<br>The QueryAI Team</p>`
    ),
    variables: ['userName', 'tier', 'amount', 'invoiceId', 'year'],
  },
  refund_confirmation: {
    subject: 'Refund Processed - QueryAI',
    html: layout(
      '#28a745',
      'Refund Confirmation',
      `<p>Hello {{userName}},</p>
<p>Your refund of <strong>{{amount}}</strong> has been processed.</p>
<p>{{estimatedTime}}</p>
<p>Best regards,<br>The QueryAI Team</p>`
    ),
    variables: ['userName', 'amount', 'estimatedTime', 'year'],
  },
  renewal_confirmation: {
    subject: 'Subscription Renewed - QueryAI',
    html: layout(
      '#28a745',
      'Subscription Renewed',
      `<p>Hello {{userName}},</p>
<p>Your <strong>{{tier}}</strong> subscription has been renewed.</p>
<p><strong>Amount charged:</strong> {{amount}}</p>
<p><strong>New period:</strong> {{periodStart}} – {{periodEnd}}</p>
<p>Best regards,<br>The QueryAI Team</p>`
    ),
    variables: ['userName', 'tier', 'amount', 'periodStart', 'periodEnd', 'year'],
  },
  failed_renewal: {
    subject: 'Payment Failed - Action Required',
    html: layout(
      '#dc3545',
      'Payment Failed - Action Required',
      `<p>Hello {{userName}},</p>
<p>We were unable to process your subscription renewal payment.</p>
{{#if failureReason}}<p><strong>Reason:</strong> {{failureReason}}</p>{{/if}}
{{#if amount}}<p><strong>Amount:</strong> {{amount}} {{currency}}</p>{{/if}}
<p>Your subscription is now in a grace period. You have <strong>{{daysRemaining}}</strong> day(s) to update your payment method.</p>
<a href="{{subscriptionUrl}}" class="button">Update Payment Method</a>
<p>Best regards,<br>The QueryAI Team</p>`
    ),
    variables: ['userName', 'tier', 'failureReason', 'amount', 'currency', 'daysRemaining', 'subscriptionUrl', 'year'],
  },
  upgrade_confirmation: {
    subject: 'Subscription Upgraded to {{newTier}}',
    html: layout(
      '#ff6b35',
      'Subscription Upgraded to {{newTier}}',
      `<p>Hello {{userName}},</p>
<p>Your subscription has been upgraded to <strong>{{newTier}}</strong>!</p>
<p><strong>New Features:</strong></p>
<ul>{{features}}</ul>
{{#if amount}}<p><strong>Amount Charged:</strong> {{amount}} {{currency}}</p>{{/if}}
<p><strong>New Period:</strong> {{startDate}} to {{endDate}}</p>
<a href="{{subscriptionUrl}}" class="button">View Subscription Dashboard</a>
<p>Best regards,<br>The QueryAI Team</p>`
    ),
    variables: ['userName', 'newTier', 'features', 'amount', 'currency', 'startDate', 'endDate', 'subscriptionUrl', 'year'],
  },
  downgrade_confirmation: {
    subject: 'Subscription Downgrade Confirmed - QueryAI',
    html: layout(
      '#6c757d',
      'Downgrade Confirmed',
      `<p>Hello {{userName}},</p>
<p>Your subscription will change from <strong>{{fromTier}}</strong> to <strong>{{toTier}}</strong>.</p>
<p><strong>When:</strong> {{effectiveWhen}}</p>
{{#if lostFeatures}}<p><strong>Features you'll lose:</strong></p><ul>{{lostFeatures}}</ul>{{/if}}
<p>Best regards,<br>The QueryAI Team</p>`
    ),
    variables: ['userName', 'fromTier', 'toTier', 'effectiveWhen', 'lostFeatures', 'year'],
  },
  expiration_warning: {
    subject: 'Your QueryAI Subscription Expires in {{days}} Day(s)',
    html: layout(
      '#ffc107',
      'Subscription Expiring Soon',
      `<p>Hello {{userName}},</p>
<p>Your <strong>{{tier}}</strong> subscription expires on <strong>{{expirationDate}}</strong>.</p>
<a href="{{subscriptionUrl}}" class="button">Renew Subscription</a>
<p>Best regards,<br>The QueryAI Team</p>`
    ),
    variables: ['userName', 'tier', 'expirationDate', 'days', 'subscriptionUrl', 'year'],
  },
  welcome: {
    subject: 'Welcome to QueryAI {{tier}} - Get Started',
    html: layout(
      '#ff6b35',
      `Welcome to QueryAI {{tier}}`,
      `<p>Hello {{userName}},</p>
<p>Thanks for subscribing to <strong>{{tier}}</strong>. {{description}}</p>
<p><strong>Key features:</strong></p>
<ul>{{features}}</ul>
<p><strong>Getting started:</strong> Visit your dashboard to start.</p>
<a href="{{dashboardUrl}}" class="button">Go to Dashboard</a>
<p>Best regards,<br>The QueryAI Team</p>`
    ),
    variables: ['userName', 'tier', 'description', 'features', 'dashboardUrl', 'year'],
  },
  reactivation_confirmation: {
    subject: 'Subscription Reactivated - QueryAI',
    html: layout(
      '#28a745',
      'Subscription Reactivated',
      `<p>Hello {{userName}},</p>
<p>Your <strong>{{tier}}</strong> subscription is active again.</p>
<p><strong>Current period ends:</strong> {{periodEnd}}</p>
<p>Best regards,<br>The QueryAI Team</p>`
    ),
    variables: ['userName', 'tier', 'periodEnd', 'year'],
  },
  cancellation: {
    subject: 'Subscription Cancelled - QueryAI',
    html: layout(
      '#6c757d',
      'Subscription Cancelled',
      `<p>Hello {{userName}},</p>
<p>Your <strong>{{tier}}</strong> subscription has been cancelled.</p>
<p>{{message}}</p>
<p>Best regards,<br>The QueryAI Team</p>`
    ),
    variables: ['userName', 'tier', 'message', 'year'],
  },
  grace_period_warning: {
    subject: 'Action Required: Update Payment Method - {{days}} Day(s) Remaining',
    html: layout(
      '#ffc107',
      'Action Required: Update Payment Method',
      `<p>Hello {{userName}},</p>
<p>Your <strong>{{tier}}</strong> subscription is in a grace period. <strong>{{days}}</strong> day(s) remaining.</p>
<a href="{{subscriptionUrl}}" class="button">Update Payment Method</a>
<p>Best regards,<br>The QueryAI Team</p>`
    ),
    variables: ['userName', 'tier', 'days', 'subscriptionUrl', 'year'],
  },
};

// Normalize: add variables to each template (extract from subject+html, ensure 'year' included)
const TEMPLATE_MAP: Record<TemplateId, EmailTemplate> = {} as Record<TemplateId, EmailTemplate>;
for (const [id, t] of Object.entries(TEMPLATES) as [TemplateId, (typeof TEMPLATES)[TemplateId]][]) {
  const combined = `${t.subject} ${t.html}`;
  const vars = extractVariables(combined);
  if (!vars.includes('year')) vars.push('year');
  TEMPLATE_MAP[id] = { ...t, id: id as TemplateId, variables: [...new Set(vars)] };
}

/**
 * Simple {{#if var}}...{{/if}} handling: replace block with content or ''.
 */
function processConditionals(html: string, vars: Record<string, string | number | undefined>): string {
  return html.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, block) => {
    const v = vars[key];
    return v !== undefined && v !== null && String(v).length > 0 ? block : '';
  });
}

/**
 * Render a template with given variables.
 * Ensures {{year}} is set; runs conditionals then variable substitution.
 */
export function renderTemplate(
  templateId: TemplateId,
  vars: Record<string, string | number | undefined>
): { subject: string; html: string; text: string } {
  const t = TEMPLATE_MAP[templateId];
  if (!t) throw new Error(`Unknown template: ${templateId}`);
  const all = { ...vars, year: vars.year ?? CURRENT_YEAR };
  const sub = (s: string) => substituteVariables(processConditionals(s, all), all);
  const subject = sub(t.subject);
  const html = sub(t.html);
  const text = t.text ? sub(t.text) : htmlToPlainText(html);
  return { subject, html, text };
}

/**
 * Get template metadata (no rendering).
 */
export function getTemplate(id: TemplateId): EmailTemplate {
  const t = TEMPLATE_MAP[id];
  if (!t) throw new Error(`Unknown template: ${id}`);
  return t;
}

/**
 * List all template IDs.
 */
export function listTemplateIds(): TemplateId[] {
  return Object.keys(TEMPLATE_MAP) as TemplateId[];
}

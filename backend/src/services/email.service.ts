import axios, { AxiosInstance } from 'axios';
import logger from '../config/logger';
import { Database } from '../types/database';
import config from '../config/env';

/** Attachment for Brevo transactional emails */
export interface EmailAttachment {
  content: string; // base64-encoded
  name: string;
  type?: string; // MIME type, e.g. 'application/pdf'
}

/**
 * Email Service
 * Handles sending email notifications for payment and subscription events
 * Uses Brevo (formerly Sendinblue) API for transactional emails
 */
export class EmailService {
  private static brevoClient: AxiosInstance | null = null;

  /**
   * Get frontend dashboard base URL for links in emails.
   * Uses FRONTEND_URL, then CORS_ORIGIN, then env-based fallbacks.
   */
  private static getDashboardUrl(): string {
    const u = config.FRONTEND_URL || config.CORS_ORIGIN || '';
    if (u && !u.includes('localhost') && !u.includes('127.0.0.1')) {
      return u.replace(/\/$/, '');
    }
    const isProduction =
      config.NODE_ENV === 'production' ||
      process.env.RAILWAY_ENVIRONMENT === 'production' ||
      !!process.env.RAILWAY_PUBLIC_DOMAIN;
    return isProduction
      ? (config.FRONTEND_FALLBACK_URL || 'http://localhost:3000')
      : 'http://localhost:3000';
  }

  /**
   * URL for subscription / update payment method (dashboard tab)
   */
  private static getSubscriptionUrl(): string {
    return `${this.getDashboardUrl()}/dashboard?tab=subscription`;
  }

  /**
   * Get or create Brevo API client
   */
  private static getBrevoClient(): AxiosInstance | null {
    if (!config.BREVO_API_KEY) {
      logger.warn('BREVO_API_KEY not configured, emails will be logged only');
      return null;
    }

    if (!this.brevoClient) {
      this.brevoClient = axios.create({
        baseURL: 'https://api.brevo.com/v3',
        headers: {
          'api-key': config.BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
      });
    }

    return this.brevoClient;
  }

  /**
   * Send email via Brevo API
   */
  private static async sendEmail(
    to: string,
    toName: string,
    subject: string,
    htmlContent: string,
    textContent?: string,
    attachments?: EmailAttachment[]
  ): Promise<boolean> {
    try {
      const client = this.getBrevoClient();
      if (!client) {
        // In sandbox/dev, log email details instead of sending
        logger.info('Email would be sent (Brevo not configured)', {
          to,
          toName,
          subject,
          hasAttachments: attachments && attachments.length > 0,
          attachmentCount: attachments?.length || 0,
          htmlContent: htmlContent.substring(0, 200) + '...',
        });
        // In development/sandbox, still return true to not block payment flow
        // Emails will be sent when BREVO_API_KEY is configured in production
        return true;
      }

      const payload: Record<string, unknown> = {
        sender: {
          email: config.BREVO_SENDER_EMAIL,
          name: config.BREVO_SENDER_NAME,
        },
        to: [{ email: to, name: toName }],
        subject,
        htmlContent,
        textContent: textContent || this.htmlToText(htmlContent),
      };
      if (attachments && attachments.length > 0) {
        payload.attachment = attachments.map((a) => ({
          content: a.content,
          name: a.name,
          type: a.type || 'application/octet-stream',
        }));
      }

      const response = await client.post('/smtp/email', payload);

      logger.info('Email sent successfully via Brevo', {
        to,
        subject,
        messageId: response.data?.messageId,
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to send email via Brevo:', {
        error: error.response?.data || error.message,
        to,
        subject,
      });
      return false;
    }
  }

  /**
   * Convert HTML to plain text (simple implementation)
   */
  private static htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }
  /**
   * Send payment success email
   */
  static async sendPaymentSuccessEmail(
    userEmail: string,
    userName: string,
    payment: Database.Payment
  ): Promise<boolean> {
    try {
      const subject = 'Payment Successful - QueryAI Subscription';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ff6b35; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Payment Successful!</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>Thank you for your payment of <strong>${payment.amount} ${payment.currency}</strong> for your <strong>${payment.tier}</strong> subscription.</p>
              <p>Your subscription is now active and you have full access to all ${payment.tier} features.</p>
              <p>If you have any questions, please don't hesitate to contact our support team.</p>
              <p>Best regards,<br>The QueryAI Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message from QueryAI. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} QueryAI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await this.sendEmail(userEmail, userName, subject, htmlContent);
    } catch (error) {
      logger.error('Failed to send payment success email:', error);
      return false;
    }
  }

  /**
   * Send payment failure email
   */
  static async sendPaymentFailureEmail(
    userEmail: string,
    userName: string,
    payment: Database.Payment,
    retryCount: number
  ): Promise<boolean> {
    try {
      const remainingRetries = Math.max(0, 3 - retryCount);
      const subject = 'Payment Failed - QueryAI Subscription';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .button { display: inline-block; padding: 12px 24px; background-color: #ff6b35; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Payment Failed</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>We were unable to process your payment of <strong>${payment.amount} ${payment.currency}</strong> for your <strong>${payment.tier}</strong> subscription.</p>
              ${remainingRetries > 0 ? `<p>We will automatically retry <strong>${remainingRetries}</strong> more time${remainingRetries > 1 ? 's' : ''}.</p>` : '<p>All retry attempts have been exhausted.</p>'}
              <p>Please update your payment method to ensure uninterrupted service:</p>
              <a href="${this.getSubscriptionUrl()}" class="button">Update Payment Method</a>
              <p>If you continue to experience issues, please contact our support team.</p>
              <p>Best regards,<br>The QueryAI Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message from QueryAI. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} QueryAI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await this.sendEmail(userEmail, userName, subject, htmlContent);
    } catch (error) {
      logger.error('Failed to send payment failure email:', error);
      return false;
    }
  }

  /**
   * Send subscription renewal reminder (e.g. 7 days before renewal).
   * 1.5.6 template: amount, payment method, link to update.
   */
  static async sendRenewalReminderEmail(
    userEmail: string,
    userName: string,
    subscription: Database.Subscription,
    daysUntilRenewal: number,
    options?: { amount?: number; currency?: string; paymentMethod?: string }
  ): Promise<boolean> {
    try {
      const renewalDate = subscription.current_period_end
        ? new Date(subscription.current_period_end).toLocaleDateString()
        : 'soon';
      const amountStr =
        options?.amount != null && options?.currency
          ? `${options.currency === 'USD' ? `$${options.amount.toFixed(2)}` : `${Number(options.amount).toLocaleString()} ${options.currency}`}`
          : null;
      const paymentMethod = options?.paymentMethod?.trim() || '—';
      const subject = `Your QueryAI Subscription Renews in ${daysUntilRenewal} Day${daysUntilRenewal > 1 ? 's' : ''}`;
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ff6b35; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .button { display: inline-block; padding: 12px 24px; background-color: #ff6b35; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Payment Reminder</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>Your <strong>${subscription.tier}</strong> subscription will renew automatically on <strong>${renewalDate}</strong>.</p>
              ${amountStr ? `<p><strong>Amount:</strong> ${amountStr}</p>` : ''}
              <p><strong>Payment Method:</strong> ${paymentMethod}</p>
              <p>Please ensure your payment method is up to date to avoid any interruption.</p>
              <a href="${this.getSubscriptionUrl()}" class="button">Update Payment Method</a>
              <p>Best regards,<br>The QueryAI Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message from QueryAI. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} QueryAI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await this.sendEmail(userEmail, userName, subject, htmlContent);
    } catch (error) {
      logger.error('Failed to send renewal reminder email:', error);
      return false;
    }
  }

  /**
   * Send payment cancellation email (when payment is cancelled on PayPal)
   */
  static async sendPaymentCancellationEmail(
    userEmail: string,
    userName: string,
    payment: Database.Payment
  ): Promise<boolean> {
    try {
      const subject = 'Payment Cancelled - QueryAI';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #6c757d; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .button { display: inline-block; padding: 12px 24px; background-color: #ff6b35; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Payment Cancelled</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>Your payment of <strong>${payment.amount} ${payment.currency}</strong> for <strong>${payment.tier}</strong> subscription has been cancelled.</p>
              <p>No charges were made to your account. Your subscription remains unchanged.</p>
              <p>If you'd like to try again, you can upgrade your subscription anytime:</p>
              <a href="${this.getSubscriptionUrl()}" class="button">Try Again</a>
              <p>If you have any questions, please contact our support team.</p>
              <p>Best regards,<br>The QueryAI Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message from QueryAI. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} QueryAI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await this.sendEmail(userEmail, userName, subject, htmlContent);
    } catch (error) {
      logger.error('Failed to send payment cancellation email:', error);
      return false;
    }
  }

  /**
   * Send payment retry notification (when automatic retry occurs).
   * Notifies user of retry attempt, shows retry count, link to update payment method.
   */
  static async sendPaymentRetryNotificationEmail(
    userEmail: string,
    userName: string,
    payment: Database.Payment,
    retryCount: number
  ): Promise<boolean> {
    try {
      const remainingRetries = Math.max(0, 3 - retryCount);
      const subject = 'We Retried Your Payment - QueryAI';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ffc107; color: #333; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .button { display: inline-block; padding: 12px 24px; background-color: #ff6b35; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Payment Retry Notice</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>We automatically retried charging your payment method for your <strong>${payment.tier}</strong> subscription (${payment.amount} ${payment.currency}), but the charge was unsuccessful.</p>
              <p>This was retry attempt <strong>#${retryCount}</strong> of 3. ${remainingRetries > 0 ? `We will retry up to <strong>${remainingRetries}</strong> more time${remainingRetries > 1 ? 's' : ''}.` : 'All automatic retries have been used.'}</p>
              <p>To avoid service interruption, please update your payment method:</p>
              <a href="${this.getSubscriptionUrl()}" class="button">Update Payment Method</a>
              <p>If you have any questions, please contact our support team.</p>
              <p>Best regards,<br>The QueryAI Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message from QueryAI. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} QueryAI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await this.sendEmail(userEmail, userName, subject, htmlContent);
    } catch (error) {
      logger.error('Failed to send payment retry notification email:', error);
      return false;
    }
  }

  /**
   * Send payment method updated confirmation.
   * Call when user updates their payment method (e.g. from dashboard / subscription settings).
   * Example: after successful payment-method update API handler.
   */
  static async sendPaymentMethodUpdatedEmail(
    userEmail: string,
    userName: string,
    lastFourDigits: string
  ): Promise<boolean> {
    try {
      const subject = 'Payment Method Updated - QueryAI';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Payment Method Updated</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>Your payment method has been successfully updated.</p>
              <p>Your new card ending in <strong>****${lastFourDigits}</strong> will be used for future subscription payments.</p>
              <p>If you did not make this change, please contact our support team immediately.</p>
              <p>Best regards,<br>The QueryAI Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message from QueryAI. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} QueryAI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await this.sendEmail(userEmail, userName, subject, htmlContent);
    } catch (error) {
      logger.error('Failed to send payment method updated email:', error);
      return false;
    }
  }

  /**
   * Send invoice email with PDF attachment after successful payment.
   */
  static async sendInvoiceEmail(
    userEmail: string,
    userName: string,
    payment: Database.Payment
  ): Promise<boolean> {
    try {
      const { InvoiceService } = await import('./invoice.service');
      const pdfBuffer = await InvoiceService.generateInvoice(payment);
      const base64 = pdfBuffer.toString('base64');
      const filename = `QueryAI-Invoice-${payment.id.slice(0, 8)}.pdf`;

      const subject = `Your Invoice - QueryAI ${payment.tier} Subscription`;
      const amountStr =
        payment.currency === 'USD'
          ? `$${payment.amount.toFixed(2)}`
          : `${Number(payment.amount).toLocaleString()} ${payment.currency}`;
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ff6b35; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Your Invoice</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>Thank you for your payment. Please find your invoice attached.</p>
              <p><strong>${payment.tier}</strong> subscription – <strong>${amountStr}</strong></p>
              <p>Invoice #: ${payment.id.slice(0, 8).toUpperCase()}</p>
              <p>If you have any questions, please contact our support team.</p>
              <p>Best regards,<br>The QueryAI Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message from QueryAI. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} QueryAI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const attachments: EmailAttachment[] = [
        { content: base64, name: filename, type: 'application/pdf' },
      ];
      return await this.sendEmail(userEmail, userName, subject, htmlContent, undefined, attachments);
    } catch (error) {
      logger.error('Failed to send invoice email:', error);
      return false;
    }
  }

  /**
   * Send refund confirmation email.
   */
  static async sendRefundConfirmationEmail(
    userEmail: string,
    userName: string,
    refundAmount: number,
    currency: string,
    options?: { estimatedDays?: number }
  ): Promise<boolean> {
    try {
      const amountStr =
        currency === 'USD' ? `$${refundAmount.toFixed(2)}` : `${Number(refundAmount).toLocaleString()} ${currency}`;
      const estTime =
        options?.estimatedDays != null
          ? `Refunds typically appear within ${options.estimatedDays}–${options.estimatedDays + 2} business days, depending on your bank.`
          : 'Refunds typically appear within 5–10 business days, depending on your bank.';
      const subject = 'Refund Processed - QueryAI';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Refund Confirmation</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>Your refund of <strong>${amountStr}</strong> has been processed successfully.</p>
              <p>${estTime}</p>
              <p>If you have any questions, please contact our support team.</p>
              <p>Best regards,<br>The QueryAI Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message from QueryAI. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} QueryAI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await this.sendEmail(userEmail, userName, subject, htmlContent);
    } catch (error) {
      logger.error('Failed to send refund confirmation email:', error);
      return false;
    }
  }

  /**
   * Send overage warning when usage is approaching or at limit (e.g. 80%+ or 100%).
   */
  static async sendOverageWarningEmail(
    userEmail: string,
    userName: string,
    opts: {
      metricType: 'queries' | 'documentUploads' | 'topics' | 'tavilySearches';
      used: number;
      limit: number;
      percentage: number;
      periodEnd?: string;
    }
  ): Promise<boolean> {
    try {
      const metricLabel =
        opts.metricType === 'queries'
          ? 'queries'
          : opts.metricType === 'documentUploads'
            ? 'document uploads'
            : opts.metricType === 'tavilySearches'
              ? 'Tavily searches'
              : 'topics';
      const subject = `Usage alert: ${metricLabel} at ${opts.percentage}% - QueryAI`;
      const atOrOver = opts.percentage >= 100 ? 'You have reached' : 'You are approaching';
      const periodNote = opts.periodEnd
        ? ` Your billing period ends ${opts.periodEnd}.`
        : '';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Usage Alert</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>${atOrOver} your <strong>${metricLabel}</strong> limit: <strong>${opts.used} / ${opts.limit}</strong> (${opts.percentage}%).${periodNote}</p>
              <p>${opts.percentage >= 100 ? 'Additional usage may incur overage charges. ' : ''}Consider upgrading your plan or reducing usage to avoid extra fees.</p>
              <p><a href="${this.getSubscriptionUrl()}">View usage &amp; subscription</a></p>
              <p>Best regards,<br>The QueryAI Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message from QueryAI. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} QueryAI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;
      return await this.sendEmail(userEmail, userName, subject, htmlContent);
    } catch (error) {
      logger.error('Failed to send overage warning email:', error);
      return false;
    }
  }

  /**
   * Notify user about overage charges (e.g. after overage billing or when overage is applied to invoice).
   */
  static async sendOverageChargeNotificationEmail(
    userEmail: string,
    userName: string,
    opts: {
      periodStart: string;
      periodEnd: string;
      amount: number;
      currency: string;
      breakdown?: Array<{ metric: string; units: number; amount: number }>;
    }
  ): Promise<boolean> {
    try {
      const amountStr =
        opts.currency === 'USD'
          ? `$${opts.amount.toFixed(2)}`
          : `${Number(opts.amount).toLocaleString('en-US')} ${opts.currency}`;
      const subject = `Overage charges for ${opts.periodEnd.slice(0, 7)} - QueryAI`;
      const breakdownHtml =
        opts.breakdown && opts.breakdown.length > 0
          ? `
            <ul>
              ${opts.breakdown.map((b) => `<li>${b.metric}: ${b.units} units – ${opts.currency === 'USD' ? `$${b.amount.toFixed(2)}` : `${Number(b.amount).toLocaleString()} ${opts.currency}`}</li>`).join('')}
            </ul>
          `
          : '';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #6366f1; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Overage Charges</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>You have been charged <strong>${amountStr}</strong> for usage over your plan limits during ${opts.periodStart.slice(0, 10)} – ${opts.periodEnd.slice(0, 10)}.</p>
              ${breakdownHtml ? `<p>Breakdown:</p>${breakdownHtml}` : ''}
              <p><a href="${this.getSubscriptionUrl()}">View usage &amp; billing</a></p>
              <p>Best regards,<br>The QueryAI Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message from QueryAI. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} QueryAI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;
      return await this.sendEmail(userEmail, userName, subject, htmlContent);
    } catch (error) {
      logger.error('Failed to send overage charge notification email:', error);
      return false;
    }
  }

  /**
   * Send subscription cancelled email
   */
  static async sendCancellationEmail(
    userEmail: string,
    userName: string,
    subscription: Database.Subscription,
    immediate: boolean
  ): Promise<boolean> {
    try {
      const periodEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end).toLocaleDateString()
        : 'now';
      const subject = 'Subscription Cancelled - QueryAI';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #6c757d; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Subscription Cancelled</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>Your <strong>${subscription.tier}</strong> subscription has been cancelled.</p>
              ${immediate
                ? '<p>Access has been removed immediately. You can reactivate your subscription at any time.</p>'
                : `<p>Your access will continue until <strong>${periodEnd}</strong>. After that date, you will be moved to the free tier.</p>`}
              <p>We're sorry to see you go! If you change your mind, you can reactivate your subscription anytime.</p>
              <p>Best regards,<br>The QueryAI Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message from QueryAI. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} QueryAI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await this.sendEmail(userEmail, userName, subject, htmlContent);
    } catch (error) {
      logger.error('Failed to send cancellation email:', error);
      return false;
    }
  }

  /**
   * Tier feature bullets for upgrade/downgrade emails.
   */
  private static getTierFeatureBullets(tier: string): string[] {
    const map: Record<string, string[]> = {
      free: ['300 queries/month', '10 Tavily searches/month', 'Basic AI responses'],
      pro: ['Unlimited queries', 'Unlimited documents & topics', '200 Tavily searches/month', 'Research mode'],
      enterprise: ['Unlimited everything', 'Team collaboration', 'Custom limits', 'Dedicated support'],
    };
    return map[tier] || [];
  }

  /**
   * Subscription renewal confirmation (after successful renewal).
   * New period dates, amount charged.
   */
  static async sendRenewalConfirmationEmail(
    userEmail: string,
    userName: string,
    subscription: Database.Subscription,
    periodStart: Date,
    periodEnd: Date,
    amount: number,
    currency: string
  ): Promise<boolean> {
    try {
      const amountStr = currency === 'USD' ? `$${amount.toFixed(2)}` : `${Number(amount).toLocaleString()} ${currency}`;
      const subject = 'Subscription Renewed - QueryAI';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8">
        <style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#28a745;color:#fff;padding:20px;text-align:center}.content{padding:20px;background:#f9f9f9}.footer{text-align:center;padding:20px;color:#666;font-size:12px}</style>
        </head>
        <body>
        <div class="container">
          <div class="header"><h1>Subscription Renewed</h1></div>
          <div class="content">
            <p>Hello ${userName},</p>
            <p>Your <strong>${subscription.tier}</strong> subscription has been renewed successfully.</p>
            <p><strong>Amount charged:</strong> ${amountStr}</p>
            <p><strong>New period:</strong> ${periodStart.toLocaleDateString()} – ${periodEnd.toLocaleDateString()}</p>
            <p>Thank you for continuing with QueryAI.</p>
            <p>Best regards,<br>The QueryAI Team</p>
          </div>
          <div class="footer"><p>This is an automated message from QueryAI. Please do not reply.</p><p>&copy; ${new Date().getFullYear()} QueryAI.</p></div>
        </div>
        </body>
        </html>`;
      return await this.sendEmail(userEmail, userName, subject, htmlContent);
    } catch (error) {
      logger.error('Failed to send renewal confirmation email:', error);
      return false;
    }
  }

  /**
   * Failed renewal notification (when auto-renewal payment fails).
   * 1.5.6 template: failure reason, amount, days remaining, update payment link.
   */
  static async sendFailedRenewalNotificationEmail(
    userEmail: string,
    userName: string,
    subscription: Database.Subscription,
    options?: { failureReason?: string; amount?: number; currency?: string; daysRemaining?: number }
  ): Promise<boolean> {
    try {
      const daysRemaining = options?.daysRemaining ?? 7;
      const amountStr =
        options?.amount != null && options?.currency
          ? `${options.currency === 'USD' ? `$${options.amount.toFixed(2)}` : `${Number(options.amount).toLocaleString()} ${options.currency}`}`
          : null;
      const subject = 'Payment Failed - Action Required';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8">
        <style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#dc3545;color:#fff;padding:20px;text-align:center}.content{padding:20px;background:#f9f9f9}.button{display:inline-block;padding:12px 24px;background:#ff6b35;color:#fff;text-decoration:none;border-radius:4px;margin-top:20px}.footer{text-align:center;padding:20px;color:#666;font-size:12px}</style>
        </head>
        <body>
        <div class="container">
          <div class="header"><h1>Payment Failed - Action Required</h1></div>
          <div class="content">
            <p>Hello ${userName},</p>
            <p>We were unable to process your subscription renewal payment.</p>
            ${options?.failureReason ? `<p><strong>Reason:</strong> ${options.failureReason}</p>` : ''}
            ${amountStr ? `<p><strong>Amount:</strong> ${amountStr}</p>` : ''}
            <p>Your subscription is now in a grace period. You have <strong>${daysRemaining}</strong> day${daysRemaining !== 1 ? 's' : ''} to update your payment method.</p>
            <a href="${this.getSubscriptionUrl()}" class="button">Update Payment Method</a>
            <p>Best regards,<br>The QueryAI Team</p>
          </div>
          <div class="footer"><p>This is an automated message from QueryAI. Please do not reply.</p><p>&copy; ${new Date().getFullYear()} QueryAI.</p></div>
        </div>
        </body>
        </html>`;
      return await this.sendEmail(userEmail, userName, subject, htmlContent);
    } catch (error) {
      logger.error('Failed to send failed renewal notification email:', error);
      return false;
    }
  }

  /**
   * Subscription upgrade confirmation.
   * 1.5.6 template: new tier, new features, amount charged, new period, View Subscription Dashboard.
   */
  static async sendUpgradeConfirmationEmail(
    userEmail: string,
    userName: string,
    newTier: string,
    periodStart: Date,
    periodEnd: Date,
    options?: { proratedAmount?: number; currency?: string }
  ): Promise<boolean> {
    try {
      const features = this.getTierFeatureBullets(newTier);
      const bullets = features.map((f) => `<li>${f}</li>`).join('');
      const amountStr =
        options?.proratedAmount != null && options?.currency
          ? `${options.currency === 'USD' ? `$${options.proratedAmount.toFixed(2)}` : `${Number(options.proratedAmount).toLocaleString()} ${options.currency}`}`
          : null;
      const subject = `Subscription Upgraded to ${newTier}`;
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8">
        <style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#ff6b35;color:#fff;padding:20px;text-align:center}.content{padding:20px;background:#f9f9f9}.button{display:inline-block;padding:12px 24px;background:#ff6b35;color:white;text-decoration:none;border-radius:4px;margin-top:20px}.footer{text-align:center;padding:20px;color:#666;font-size:12px}</style>
        </head>
        <body>
        <div class="container">
          <div class="header"><h1>Subscription Upgraded to ${newTier}</h1></div>
          <div class="content">
            <p>Hello ${userName},</p>
            <p>Your subscription has been upgraded to <strong>${newTier}</strong>!</p>
            <p><strong>New Features:</strong></p>
            <ul>${bullets}</ul>
            ${amountStr ? `<p><strong>Amount Charged:</strong> ${amountStr}</p>` : ''}
            <p><strong>New Period:</strong> ${periodStart.toLocaleDateString()} to ${periodEnd.toLocaleDateString()}</p>
            <a href="${this.getSubscriptionUrl()}" class="button">View Subscription Dashboard</a>
            <p>Best regards,<br>The QueryAI Team</p>
          </div>
          <div class="footer"><p>This is an automated message from QueryAI. Please do not reply.</p><p>&copy; ${new Date().getFullYear()} QueryAI.</p></div>
        </div>
        </body>
        </html>`;
      return await this.sendEmail(userEmail, userName, subject, htmlContent);
    } catch (error) {
      logger.error('Failed to send upgrade confirmation email:', error);
      return false;
    }
  }

  /**
   * Subscription downgrade confirmation.
   * When downgrade takes effect, features that will be lost.
   */
  static async sendDowngradeConfirmationEmail(
    userEmail: string,
    userName: string,
    fromTier: string,
    toTier: string,
    effectiveDate: string,
    immediate: boolean
  ): Promise<boolean> {
    try {
      const fromFeatures = this.getTierFeatureBullets(fromTier);
      const toFeatures = this.getTierFeatureBullets(toTier);
      const toSet = new Set(toFeatures);
      const lost = fromFeatures.filter((f) => !toSet.has(f));
      const lostHtml = lost.length ? `<p><strong>Features you'll lose:</strong></p><ul>${lost.map((f) => `<li>${f}</li>`).join('')}</ul>` : '';
      const subject = 'Subscription Downgrade Confirmed - QueryAI';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8">
        <style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#6c757d;color:#fff;padding:20px;text-align:center}.content{padding:20px;background:#f9f9f9}.footer{text-align:center;padding:20px;color:#666;font-size:12px}</style>
        </head>
        <body>
        <div class="container">
          <div class="header"><h1>Downgrade Confirmed</h1></div>
          <div class="content">
            <p>Hello ${userName},</p>
            <p>Your subscription will change from <strong>${fromTier}</strong> to <strong>${toTier}</strong>.</p>
            <p><strong>When:</strong> ${immediate ? 'Immediately' : `At the end of your current period (${effectiveDate})`}.</p>
            ${lostHtml}
            <p>You can upgrade again anytime from your subscription settings.</p>
            <p>Best regards,<br>The QueryAI Team</p>
          </div>
          <div class="footer"><p>This is an automated message from QueryAI. Please do not reply.</p><p>&copy; ${new Date().getFullYear()} QueryAI.</p></div>
        </div>
        </body>
        </html>`;
      return await this.sendEmail(userEmail, userName, subject, htmlContent);
    } catch (error) {
      logger.error('Failed to send downgrade confirmation email:', error);
      return false;
    }
  }

  /**
   * Subscription expiration warning (e.g. 3 days before period end for cancel_at_period_end).
   */
  static async sendExpirationWarningEmail(
    userEmail: string,
    userName: string,
    subscription: Database.Subscription,
    daysUntilExpiration: number
  ): Promise<boolean> {
    try {
      const expDate = subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'soon';
      const subject = `Your QueryAI Subscription Expires in ${daysUntilExpiration} Day${daysUntilExpiration > 1 ? 's' : ''}`;
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8">
        <style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#ffc107;color:#333;padding:20px;text-align:center}.content{padding:20px;background:#f9f9f9}.button{display:inline-block;padding:12px 24px;background:#ff6b35;color:#fff;text-decoration:none;border-radius:4px;margin-top:20px}.footer{text-align:center;padding:20px;color:#666;font-size:12px}</style>
        </head>
        <body>
        <div class="container">
          <div class="header"><h1>Subscription Expiring Soon</h1></div>
          <div class="content">
            <p>Hello ${userName},</p>
            <p>Your <strong>${subscription.tier}</strong> subscription will expire on <strong>${expDate}</strong>.</p>
            <p>Renew now to keep your access:</p>
            <a href="${this.getSubscriptionUrl()}" class="button">Renew Subscription</a>
            <p>Best regards,<br>The QueryAI Team</p>
          </div>
          <div class="footer"><p>This is an automated message from QueryAI. Please do not reply.</p><p>&copy; ${new Date().getFullYear()} QueryAI.</p></div>
        </div>
        </body>
        </html>`;
      return await this.sendEmail(userEmail, userName, subject, htmlContent);
    } catch (error) {
      logger.error('Failed to send expiration warning email:', error);
      return false;
    }
  }

  /**
   * Welcome email for new paid subscriptions.
   */
  static async sendWelcomeEmail(
    userEmail: string,
    userName: string,
    tier: string
  ): Promise<boolean> {
    try {
      const { getTierDescription } = await import('../constants/pricing');
      const desc = getTierDescription(tier as 'free' | 'pro');
      const bullets = this.getTierFeatureBullets(tier).map((f) => `<li>${f}</li>`).join('');
      const subject = `Welcome to QueryAI ${tier} - Get Started`;
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8">
        <style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#ff6b35;color:#fff;padding:20px;text-align:center}.content{padding:20px;background:#f9f9f9}.button{display:inline-block;padding:12px 24px;background:#ff6b35;color:#fff;text-decoration:none;border-radius:4px;margin-top:20px}.footer{text-align:center;padding:20px;color:#666;font-size:12px}</style>
        </head>
        <body>
        <div class="container">
          <div class="header"><h1>Welcome to QueryAI ${tier}</h1></div>
          <div class="content">
            <p>Hello ${userName},</p>
            <p>Thanks for subscribing to <strong>${tier}</strong>. ${desc}</p>
            <p><strong>Key features:</strong></p>
            <ul>${bullets}</ul>
            <p><strong>Getting started:</strong> Head to your dashboard to start asking questions, upload documents, and explore topics.</p>
            <a href="${this.getDashboardUrl()}/dashboard" class="button">Go to Dashboard</a>
            <p>Best regards,<br>The QueryAI Team</p>
          </div>
          <div class="footer"><p>This is an automated message from QueryAI. Please do not reply.</p><p>&copy; ${new Date().getFullYear()} QueryAI.</p></div>
        </div>
        </body>
        </html>`;
      return await this.sendEmail(userEmail, userName, subject, htmlContent);
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
      return false;
    }
  }

  /**
   * Subscription reactivation confirmation.
   */
  static async sendReactivationConfirmationEmail(
    userEmail: string,
    userName: string,
    subscription: Database.Subscription
  ): Promise<boolean> {
    try {
      const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : '—';
      const subject = 'Subscription Reactivated - QueryAI';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8">
        <style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#28a745;color:#fff;padding:20px;text-align:center}.content{padding:20px;background:#f9f9f9}.footer{text-align:center;padding:20px;color:#666;font-size:12px}</style>
        </head>
        <body>
        <div class="container">
          <div class="header"><h1>Subscription Reactivated</h1></div>
          <div class="content">
            <p>Hello ${userName},</p>
            <p>Your <strong>${subscription.tier}</strong> subscription is active again.</p>
            <p><strong>Current period ends:</strong> ${periodEnd}</p>
            <p>Best regards,<br>The QueryAI Team</p>
          </div>
          <div class="footer"><p>This is an automated message from QueryAI. Please do not reply.</p><p>&copy; ${new Date().getFullYear()} QueryAI.</p></div>
        </div>
        </body>
        </html>`;
      return await this.sendEmail(userEmail, userName, subject, htmlContent);
    } catch (error) {
      logger.error('Failed to send reactivation confirmation email:', error);
      return false;
    }
  }

  /**
   * Send grace period warning email
   */
  static async sendGracePeriodWarningEmail(
    userEmail: string,
    userName: string,
    subscription: Database.Subscription,
    daysRemaining: number
  ): Promise<boolean> {
    try {
      const subject = `Action Required: Update Payment Method - ${daysRemaining} Day${daysRemaining > 1 ? 's' : ''} Remaining`;
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ffc107; color: #333; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .button { display: inline-block; padding: 12px 24px; background-color: #ff6b35; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Action Required: Update Payment Method</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>Your payment failed and your <strong>${subscription.tier}</strong> subscription is currently in a grace period.</p>
              <p>You have <strong>${daysRemaining} day${daysRemaining > 1 ? 's' : ''}</strong> remaining to update your payment method before your subscription is downgraded to the free tier.</p>
              <p>Please update your payment method now to avoid any interruption in service:</p>
              <a href="${this.getSubscriptionUrl()}" class="button">Update Payment Method</a>
              <p>If you have any questions or need assistance, please contact our support team.</p>
              <p>Best regards,<br>The QueryAI Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message from QueryAI. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} QueryAI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await this.sendEmail(userEmail, userName, subject, htmlContent);
    } catch (error) {
      logger.error('Failed to send grace period warning email:', error);
      return false;
    }
  }

  /**
   * Send Pesapal → PayPal migration announcement.
   * See PAYPAL_ONLY_MIGRATION_PLAN.md and send-migration-emails.ts.
   */
  static async sendMigrationAnnouncementEmail(
    userEmail: string,
    userName: string,
    opts: { hasActiveSubscription: boolean; renewalDate?: string }
  ): Promise<boolean> {
    try {
      const subject = 'Important: Payment System Update - Action Required';
      const subscriptionUrl = this.getSubscriptionUrl();
      const year = new Date().getFullYear();

      const activeBlock = opts.hasActiveSubscription && opts.renewalDate
        ? `
          <p>Your current subscription will continue until <strong>${opts.renewalDate}</strong>.</p>
          <p>Please update your payment method to PayPal before then to avoid any interruption:</p>
          <a href="${subscriptionUrl}" class="button">Update Payment Method</a>
        `
        : opts.hasActiveSubscription
          ? `
          <p>Please update your payment method to PayPal to keep your subscription active:</p>
          <a href="${subscriptionUrl}" class="button">Update Payment Method</a>
        `
          : `
          <p>No action needed right now. When you're ready to subscribe, you'll use PayPal.</p>
          <a href="${subscriptionUrl}" class="button">View Subscription</a>
        `;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #003087; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .button { display: inline-block; padding: 12px 24px; background-color: #ffc439; color: #000; text-decoration: none; border-radius: 4px; margin-top: 12px; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            ul { margin: 12px 0; padding-left: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Payment System Update</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>We're upgrading our payment system to give you better service and more payment options.</p>
              <h3>What's changing</h3>
              <ul>
                <li>We're moving from Pesapal to <strong>PayPal</strong></li>
                <li>PayPal supports direct PayPal payments <strong>and</strong> Visa cards</li>
                <li>Better global coverage and security</li>
              </ul>
              <h3>What you need to do</h3>
              ${activeBlock}
              <h3>Benefits</h3>
              <ul>
                <li>Support for Visa cards</li>
                <li>More secure payments</li>
                <li>Better global coverage</li>
                <li>Faster payment processing</li>
              </ul>
              <p>Questions? Contact us at <a href="mailto:support@queryai.com">support@queryai.com</a>.</p>
              <p>Best regards,<br>The QueryAI Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message from QueryAI.</p>
              <p>&copy; ${year} QueryAI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await this.sendEmail(userEmail, userName, subject, htmlContent);
    } catch (error) {
      logger.error('Failed to send migration announcement email:', error);
      return false;
    }
  }
}

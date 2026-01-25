import axios, { AxiosInstance } from 'axios';
import logger from '../config/logger';
import { Database } from '../types/database';
import config from '../config/env';

/**
 * Email Service
 * Handles sending email notifications for payment and subscription events
 * Uses Brevo (formerly Sendinblue) API for transactional emails
 */
export class EmailService {
  private static brevoClient: AxiosInstance | null = null;

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
    textContent?: string
  ): Promise<boolean> {
    try {
      const client = this.getBrevoClient();
      if (!client) {
        // Log email content when Brevo is not configured
        logger.info('Email would be sent (Brevo not configured)', {
          to,
          toName,
          subject,
          htmlContent: htmlContent.substring(0, 100) + '...',
        });
        return true; // Return true to not block operations
      }

      const response = await client.post('/smtp/email', {
        sender: {
          email: config.BREVO_SENDER_EMAIL,
          name: config.BREVO_SENDER_NAME,
        },
        to: [
          {
            email: to,
            name: toName,
          },
        ],
        subject,
        htmlContent,
        textContent: textContent || this.htmlToText(htmlContent),
      });

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
              <a href="${config.API_BASE_URL}/dashboard?tab=subscription" class="button">Update Payment Method</a>
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
   * Send subscription renewal reminder
   */
  static async sendRenewalReminderEmail(
    userEmail: string,
    userName: string,
    subscription: Database.Subscription,
    daysUntilRenewal: number
  ): Promise<boolean> {
    try {
      const renewalDate = subscription.current_period_end
        ? new Date(subscription.current_period_end).toLocaleDateString()
        : 'soon';
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
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Subscription Renewal Reminder</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>Your <strong>${subscription.tier}</strong> subscription will renew automatically on <strong>${renewalDate}</strong>.</p>
              <p>Please ensure your payment method is up to date to avoid any interruption in service.</p>
              <p>If you have any questions or need to update your payment information, please visit your subscription settings.</p>
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
              <a href="${config.API_BASE_URL}/dashboard?tab=subscription" class="button">Update Payment Method</a>
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
}

import PDFDocument from 'pdfkit';
import { Database } from '../types/database';
import { DatabaseService } from './database.service';
import { BillingService } from './billing.service';
import logger from '../config/logger';

function formatAmount(amount: number, currency: string): string {
  return currency === 'USD'
    ? `$${amount.toFixed(2)}`
    : `${Number(amount).toLocaleString('en-US')} ${currency}`;
}

/**
 * Invoice Service
 * Generates PDF invoices for payments. Includes overage line items when present.
 */
export class InvoiceService {
  /**
   * Generate invoice PDF for a payment. Adds overage line items when payment has linked overage records.
   */
  static async generateInvoice(payment: Database.Payment): Promise<Buffer> {
    try {
      const userProfile = await DatabaseService.getUserProfile(payment.user_id);
      if (!userProfile) {
        throw new Error('User profile not found');
      }

      const lineItems = await BillingService.getInvoiceLineItems(payment);
      const currency = payment.currency;

      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));

      doc.fontSize(24).text('INVOICE', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Invoice #: ${payment.id.substring(0, 8).toUpperCase()}`, { align: 'right' });
      doc.text(`Date: ${new Date(payment.created_at).toLocaleDateString()}`, { align: 'right' });
      doc.moveDown();

      doc.fontSize(14).text('QueryAI', 50, 100);
      doc.fontSize(10);
      doc.text('Subscription Service Provider');
      doc.text('Email: support@queryai.com');
      doc.moveDown();

      doc.fontSize(14).text('Bill To:', 50, 180);
      doc.fontSize(10);
      doc.text(userProfile.full_name || userProfile.email);
      doc.text(userProfile.email);
      doc.moveDown();

      doc.fontSize(14).text('Payment Details', 50, 250);
      doc.fontSize(10);
      doc.text(`Subscription Tier: ${payment.tier.toUpperCase()}`);
      doc.text(`Status: ${payment.status.toUpperCase()}`);
      doc.text(`Payment Method: ${payment.payment_method || 'PayPal'}`);
      if (payment.completed_at) {
        doc.text(`Paid On: ${new Date(payment.completed_at).toLocaleDateString()}`);
      }
      doc.moveDown();

      let tableY = 350;
      doc.fontSize(12).text('Line items', 50, tableY);
      tableY += 20;
      doc.fontSize(10);

      if (lineItems.base) {
        doc.text(lineItems.base.description, 50, tableY);
        doc.text(formatAmount(lineItems.base.amount, currency), 450, tableY, { width: 100, align: 'right' });
        tableY += 18;
      }
      if (lineItems.overage) {
        for (const line of lineItems.overage.lines) {
          doc.text(line.description, 50, tableY);
          doc.text(
            `${line.quantity} × ${formatAmount(line.unitPrice, currency)} = ${formatAmount(line.amount, currency)}`,
            450,
            tableY,
            { width: 100, align: 'right' }
          );
          tableY += 18;
        }
      }
      tableY += 8;

      const lineY = tableY;
      doc.moveTo(50, lineY).lineTo(550, lineY).stroke();
      doc.moveDown();
      doc.fontSize(14).text(`Total: ${formatAmount(lineItems.total, currency)}`, { align: 'right' });

      doc.fontSize(8)
        .text('Thank you for your subscription!', 50, 750, { align: 'center' })
        .text('For support, contact: support@queryai.com', 50, 765, { align: 'center' });

      doc.end();

      return new Promise<Buffer>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('PDF generation timeout')), 10000);
        doc.on('end', () => {
          clearTimeout(timeout);
          resolve(Buffer.concat(buffers));
        });
        doc.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    } catch (error) {
      logger.error('Failed to generate invoice:', error);
      throw error;
    }
  }
}

import PDFDocument from 'pdfkit';
import { Database } from '../types/database';
import { DatabaseService } from './database.service';
import logger from '../config/logger';

/**
 * Invoice Service
 * Generates PDF invoices for payments
 */
export class InvoiceService {
  /**
   * Generate invoice PDF for a payment
   */
  static async generateInvoice(payment: Database.Payment): Promise<Buffer> {
    try {
      // Get user profile for invoice details
      const userProfile = await DatabaseService.getUserProfile(payment.user_id);
      if (!userProfile) {
        throw new Error('User profile not found');
      }

      // Create PDF document
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => buffers.push(chunk));

      // Header
      doc.fontSize(24).text('INVOICE', { align: 'center' });
      doc.moveDown();

      // Invoice details
      doc.fontSize(12);
      doc.text(`Invoice #: ${payment.id.substring(0, 8).toUpperCase()}`, { align: 'right' });
      doc.text(`Date: ${new Date(payment.created_at).toLocaleDateString()}`, { align: 'right' });
      doc.moveDown();

      // Company info (QueryAI)
      doc.fontSize(14).text('QueryAI', 50, 100);
      doc.fontSize(10);
      doc.text('Subscription Service Provider');
      doc.text('Email: support@queryai.com');
      doc.moveDown();

      // Bill to
      doc.fontSize(14).text('Bill To:', 50, 180);
      doc.fontSize(10);
      doc.text(userProfile.full_name || userProfile.email);
      doc.text(userProfile.email);
      doc.moveDown();

      // Payment details
      doc.fontSize(14).text('Payment Details', 50, 250);
      doc.fontSize(10);
      doc.text(`Subscription Tier: ${payment.tier.toUpperCase()}`);
      doc.text(`Amount: ${payment.currency} ${payment.amount.toLocaleString()}`);
      doc.text(`Status: ${payment.status.toUpperCase()}`);
      doc.text(`Payment Method: ${payment.payment_method || 'Pesapal'}`);
      if (payment.completed_at) {
        doc.text(`Paid On: ${new Date(payment.completed_at).toLocaleDateString()}`);
      }
      doc.moveDown();

      // Description
      doc.fontSize(12).text('Description:', 50, 350);
      doc.fontSize(10);
      doc.text(payment.payment_description || `QueryAI ${payment.tier} subscription`, {
        width: 500,
      });
      doc.moveDown(2);

      // Total
      const lineY = doc.y;
      doc.moveTo(50, lineY).lineTo(550, lineY).stroke();
      doc.moveDown();
      doc.fontSize(14).text(`Total: ${payment.currency} ${payment.amount.toLocaleString()}`, {
        align: 'right',
      });

      // Footer
      doc.fontSize(8)
        .text('Thank you for your subscription!', 50, 750, { align: 'center' })
        .text('For support, contact: support@queryai.com', 50, 765, { align: 'center' });

      // Finalize PDF
      doc.end();

      // Wait for PDF to be generated
      return new Promise<Buffer>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('PDF generation timeout'));
        }, 10000);

        doc.on('end', () => {
          clearTimeout(timeout);
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
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

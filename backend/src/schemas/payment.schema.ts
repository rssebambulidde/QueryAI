/**
 * Zod schemas for payment request validation.
 */

import { z } from 'zod';

/**
 * POST /api/payment/initiate — validates tier, billing details, and payer info.
 */
export const PaymentInitiateSchema = z.object({
  tier: z.enum(['pro', 'enterprise'], {
    message: 'Tier must be "pro" or "enterprise"',
  }),
  firstName: z
    .string({ message: 'First name is required' })
    .min(1, 'First name is required')
    .max(100, 'First name must not exceed 100 characters'),
  lastName: z
    .string({ message: 'Last name is required' })
    .min(1, 'Last name is required')
    .max(100, 'Last name must not exceed 100 characters'),
  email: z
    .string({ message: 'Email is required' })
    .email('Invalid email address'),
  recurring: z.boolean().optional().default(false),
  billing_period: z
    .enum(['monthly', 'annual'])
    .optional()
    .default('monthly'),
  return_url: z.string().url().optional(),
  prefer_card: z.boolean().optional().default(false),
  promo_code: z
    .string()
    .min(1)
    .max(50)
    .optional(),
});

export type PaymentInitiateInput = z.infer<typeof PaymentInitiateSchema>;

/**
 * POST /api/payment/refund — validates refund request body.
 */
export const PaymentRefundSchema = z.object({
  paymentId: z
    .string({ message: 'Payment ID is required' })
    .uuid('Invalid payment ID format'),
  amount: z.number().positive('Refund amount must be positive').optional(),
  reason: z.string().max(500, 'Reason must not exceed 500 characters').optional(),
});

export type PaymentRefundInput = z.infer<typeof PaymentRefundSchema>;

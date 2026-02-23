/**
 * Zod schemas for payment request validation.
 */

import { z } from 'zod';

/**
 * POST /api/payment/initiate — validates tier, billing details, and payer info.
 */
export const PaymentInitiateSchema = z.object({
  tier: z.enum(['pro', 'enterprise'], {
    required_error: 'Tier is required',
    invalid_type_error: 'Tier must be "pro" or "enterprise"',
  }),
  firstName: z
    .string({ required_error: 'First name is required' })
    .min(1, 'First name is required')
    .max(100, 'First name must not exceed 100 characters'),
  lastName: z
    .string({ required_error: 'Last name is required' })
    .min(1, 'Last name is required')
    .max(100, 'Last name must not exceed 100 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email address'),
  recurring: z.boolean().optional().default(false),
  billing_period: z
    .enum(['monthly', 'annual'])
    .optional()
    .default('monthly'),
  return_url: z.string().url().optional(),
  prefer_card: z.boolean().optional().default(false),
});

export type PaymentInitiateInput = z.infer<typeof PaymentInitiateSchema>;

/**
 * POST /api/payment/refund — validates refund request body.
 */
export const PaymentRefundSchema = z.object({
  paymentId: z
    .string({ required_error: 'Payment ID is required' })
    .uuid('Invalid payment ID format'),
  amount: z.number().positive('Refund amount must be positive').optional(),
  reason: z.string().max(500, 'Reason must not exceed 500 characters').optional(),
});

export type PaymentRefundInput = z.infer<typeof PaymentRefundSchema>;

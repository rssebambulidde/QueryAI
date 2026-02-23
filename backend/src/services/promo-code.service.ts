/**
 * Promo Code Service
 *
 * CRUD + validation + redemption of promo codes / coupons.
 * All DB access through supabaseAdmin (service-role).
 */

import { z } from 'zod';
import { supabaseAdmin } from '../config/database';
import logger from '../config/logger';
import { ValidationError, NotFoundError, ConflictError } from '../types/error';
import { Database } from '../types/database';

// ── Zod schemas ──────────────────────────────────────────────────────────────

export const CreatePromoCodeSchema = z.object({
  code: z.string().min(2).max(50).transform((v) => v.trim().toUpperCase()),
  description: z.string().max(500).optional(),
  discount_percent: z.number().min(0.01).max(100),
  applicable_tiers: z
    .array(z.enum(['pro', 'enterprise']))
    .min(1)
    .default(['pro', 'enterprise']),
  applicable_periods: z
    .array(z.enum(['monthly', 'annual']))
    .min(1)
    .default(['monthly', 'annual']),
  valid_from: z.string().datetime().optional(),
  valid_until: z.string().datetime().nullable().optional(),
  max_uses: z.number().int().min(1).nullable().optional(),
  max_uses_per_user: z.number().int().min(1).default(1),
  is_active: z.boolean().default(true),
});

export const UpdatePromoCodeSchema = z.object({
  description: z.string().max(500).optional(),
  discount_percent: z.number().min(0.01).max(100).optional(),
  applicable_tiers: z.array(z.enum(['pro', 'enterprise'])).min(1).optional(),
  applicable_periods: z.array(z.enum(['monthly', 'annual'])).min(1).optional(),
  valid_from: z.string().datetime().optional(),
  valid_until: z.string().datetime().nullable().optional(),
  max_uses: z.number().int().min(1).nullable().optional(),
  max_uses_per_user: z.number().int().min(1).optional(),
  is_active: z.boolean().optional(),
});

export type CreatePromoCodeInput = z.infer<typeof CreatePromoCodeSchema>;
export type UpdatePromoCodeInput = z.infer<typeof UpdatePromoCodeSchema>;

// ── Types ────────────────────────────────────────────────────────────────────

export interface PromoValidationResult {
  valid: true;
  promo: Database.PromoCode;
  discountPercent: number;
  discountedAmount: number;
  originalAmount: number;
}

export interface PromoValidationError {
  valid: false;
  reason: string;
}

export type PromoValidation = PromoValidationResult | PromoValidationError;

// ── Service ──────────────────────────────────────────────────────────────────

export class PromoCodeService {
  // ── Validate a code for a specific purchase context ──────────────────────

  /**
   * Validate a promo code for the given user, tier, billing period, and
   * original amount. Returns either a success object (with discounted
   * amount) or a failure with a human-readable reason.
   */
  static async validate(
    code: string,
    userId: string,
    tier: string,
    billingPeriod: string,
    originalAmount: number,
  ): Promise<PromoValidation> {
    const normalised = code.trim().toUpperCase();

    // Look up code (case-insensitive via UPPER index)
    const { data: promo, error } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .eq('code', normalised)
      .single();

    if (error || !promo) {
      return { valid: false, reason: 'Promo code not found.' };
    }

    // Active?
    if (!promo.is_active) {
      return { valid: false, reason: 'This promo code is no longer active.' };
    }

    // Date window
    const now = new Date();
    if (promo.valid_from && new Date(promo.valid_from) > now) {
      return { valid: false, reason: 'This promo code is not yet valid.' };
    }
    if (promo.valid_until && new Date(promo.valid_until) < now) {
      return { valid: false, reason: 'This promo code has expired.' };
    }

    // Global usage cap
    if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
      return { valid: false, reason: 'This promo code has reached its usage limit.' };
    }

    // Per-user usage cap
    const { count: userUses } = await supabaseAdmin
      .from('promo_code_usages')
      .select('*', { count: 'exact', head: true })
      .eq('promo_code_id', promo.id)
      .eq('user_id', userId);

    if (
      promo.max_uses_per_user !== null &&
      (userUses ?? 0) >= promo.max_uses_per_user
    ) {
      return { valid: false, reason: 'You have already used this promo code.' };
    }

    // Applicable tier
    if (!promo.applicable_tiers.includes(tier)) {
      return {
        valid: false,
        reason: `This promo code is not valid for the ${tier} tier.`,
      };
    }

    // Applicable billing period
    if (!promo.applicable_periods.includes(billingPeriod)) {
      return {
        valid: false,
        reason: `This promo code is not valid for ${billingPeriod} billing.`,
      };
    }

    const discountPercent = Number(promo.discount_percent);
    const discountedAmount = Math.round(originalAmount * (1 - discountPercent / 100) * 100) / 100;

    return {
      valid: true,
      promo: promo as Database.PromoCode,
      discountPercent,
      discountedAmount,
      originalAmount,
    };
  }

  // ── Record usage (called after successful payment) ───────────────────────

  /**
   * Record that a promo code was redeemed, and increment current_uses.
   * Should be called after payment completes (not at initiation).
   */
  static async recordUsage(
    promoCodeId: string,
    userId: string,
    paymentId: string | null,
    discountAmount: number,
  ): Promise<void> {
    try {
      // Insert usage record
      const { error: usageError } = await supabaseAdmin
        .from('promo_code_usages')
        .insert({
          promo_code_id: promoCodeId,
          user_id: userId,
          payment_id: paymentId,
          discount_amount: discountAmount,
        });

      if (usageError) {
        logger.error('PromoCodeService.recordUsage insert failed', {
          error: usageError.message,
          promoCodeId,
          userId,
        });
        return;
      }

      // Increment current_uses counter via manual read-then-update
      const { data: code } = await supabaseAdmin
        .from('promo_codes')
        .select('current_uses')
        .eq('id', promoCodeId)
        .single();
      const { error: updateError } = await supabaseAdmin
        .from('promo_codes')
        .update({ current_uses: (code?.current_uses ?? 0) + 1 })
        .eq('id', promoCodeId);

      if (updateError) {
        logger.error('PromoCodeService.recordUsage increment failed', {
          error: updateError.message,
          promoCodeId,
        });
      }

      logger.info('Promo code usage recorded', { promoCodeId, userId, discountAmount });
    } catch (err) {
      logger.error('PromoCodeService.recordUsage unexpected error', {
        error: (err as Error).message,
        promoCodeId,
        userId,
      });
    }
  }

  // ── Admin CRUD ───────────────────────────────────────────────────────────

  /**
   * List all promo codes (paginated, newest first).
   */
  static async list(
    filters: { is_active?: boolean; page?: number; limit?: number } = {},
  ): Promise<{ promoCodes: Database.PromoCode[]; total: number }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('promo_codes')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      logger.error('PromoCodeService.list failed', { error: error.message });
      throw new Error('Failed to retrieve promo codes');
    }

    return {
      promoCodes: (data ?? []) as Database.PromoCode[],
      total: count ?? 0,
    };
  }

  /**
   * Get a single promo code by ID.
   */
  static async getById(id: string): Promise<Database.PromoCode> {
    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundError('Promo code not found');
    }

    return data as Database.PromoCode;
  }

  /**
   * Create a new promo code.
   */
  static async create(
    input: unknown,
    createdBy: string,
  ): Promise<Database.PromoCode> {
    const parsed = CreatePromoCodeSchema.parse(input);

    // Check uniqueness
    const { data: existing } = await supabaseAdmin
      .from('promo_codes')
      .select('id')
      .eq('code', parsed.code)
      .maybeSingle();

    if (existing) {
      throw new ConflictError(`Promo code "${parsed.code}" already exists.`);
    }

    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .insert({
        ...parsed,
        valid_from: parsed.valid_from ?? new Date().toISOString(),
        created_by: createdBy,
      })
      .select('*')
      .single();

    if (error) {
      logger.error('PromoCodeService.create insert failed', { error: error.message });
      throw new Error('Failed to create promo code');
    }

    logger.info('Promo code created', { code: parsed.code, createdBy });
    return data as Database.PromoCode;
  }

  /**
   * Update an existing promo code.
   */
  static async update(
    id: string,
    input: unknown,
  ): Promise<Database.PromoCode> {
    const parsed = UpdatePromoCodeSchema.parse(input);

    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .update(parsed)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      logger.error('PromoCodeService.update failed', { error: error.message, id });
      throw new NotFoundError('Promo code not found or update failed');
    }

    logger.info('Promo code updated', { id });
    return data as Database.PromoCode;
  }

  /**
   * Deactivate a promo code (soft delete).
   */
  static async deactivate(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('promo_codes')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      logger.error('PromoCodeService.deactivate failed', { error: error.message, id });
      throw new NotFoundError('Promo code not found');
    }

    logger.info('Promo code deactivated', { id });
  }
}

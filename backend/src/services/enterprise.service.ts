import { supabaseAdmin } from '../config/database';
import { DatabaseService } from './database.service';
import { TIER_LIMITS } from './subscription.service';
import type { Database } from '../types/database';
import type { TierLimits } from './subscription.service';
import logger from '../config/logger';

const ENTERPRISE_TIER = 'enterprise' as const;

/**
 * Enterprise Service
 * Team collaboration and enterprise features. Enterprise tier has teamCollaboration and higher limits.
 */
export class EnterpriseService {
  static getEnterpriseLimits(): TierLimits {
    return TIER_LIMITS[ENTERPRISE_TIER];
  }

  static hasTeamCollaboration(tier: string): boolean {
    const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS];
    return !!limits?.features?.teamCollaboration;
  }

  static async ensureUserHasEnterpriseAccess(userId: string): Promise<boolean> {
    const sub = await DatabaseService.getUserSubscription(userId);
    return sub?.tier === ENTERPRISE_TIER;
  }

  /**
   * Create a team. Owner must have enterprise tier.
   */
  static async createTeam(
    ownerId: string,
    name: string,
    slug: string
  ): Promise<Database.Team | null> {
    const hasAccess = await this.ensureUserHasEnterpriseAccess(ownerId);
    if (!hasAccess) {
      logger.warn('EnterpriseService.createTeam: user lacks enterprise access', { ownerId });
      return null;
    }
    const slugNorm = slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!slugNorm) return null;

    const { data, error } = await supabaseAdmin
      .from('teams')
      .insert({
        name: name.trim(),
        slug: slugNorm,
        owner_id: ownerId,
      })
      .select()
      .single();

    if (error) {
      logger.error('EnterpriseService.createTeam', { error, ownerId });
      return null;
    }

    await supabaseAdmin.from('team_members').insert({
      team_id: data.id,
      user_id: ownerId,
      role: 'owner',
    });

    return data as Database.Team;
  }

  static async getTeam(teamId: string): Promise<Database.Team | null> {
    const { data, error } = await supabaseAdmin
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();
    if (error) return null;
    return data as Database.Team;
  }

  static async getTeamBySlug(slug: string): Promise<Database.Team | null> {
    const { data, error } = await supabaseAdmin
      .from('teams')
      .select('*')
      .eq('slug', slug.trim().toLowerCase())
      .single();
    if (error) return null;
    return data as Database.Team;
  }

  static async listTeamsForUser(userId: string): Promise<Database.Team[]> {
    const { data: memberRows } = await supabaseAdmin
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId);
    const ids = (memberRows ?? []).map((r) => r.team_id);
    if (ids.length === 0) return [];

    const { data, error } = await supabaseAdmin
      .from('teams')
      .select('*')
      .in('id', ids);
    if (error) return [];
    return (data ?? []) as Database.Team[];
  }

  static async listMembers(teamId: string): Promise<Database.TeamMember[]> {
    const { data, error } = await supabaseAdmin
      .from('team_members')
      .select('*')
      .eq('team_id', teamId);
    if (error) return [];
    return (data ?? []) as Database.TeamMember[];
  }

  static async addMember(
    teamId: string,
    userId: string,
    role: 'admin' | 'member'
  ): Promise<boolean> {
    const { error } = await supabaseAdmin.from('team_members').insert({
      team_id: teamId,
      user_id: userId,
      role,
    });
    if (error) {
      logger.error('EnterpriseService.addMember', { error, teamId, userId });
      return false;
    }
    return true;
  }

  static async removeMember(teamId: string, userId: string): Promise<boolean> {
    const members = await this.listMembers(teamId);
    const owner = members.find((m) => m.role === 'owner');
    if (owner?.user_id === userId) {
      logger.warn('EnterpriseService.removeMember: cannot remove owner', { teamId });
      return false;
    }
    const { error } = await supabaseAdmin
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId);
    if (error) return false;
    return true;
  }

  static async updateTeam(
    teamId: string,
    updates: { name?: string; slug?: string }
  ): Promise<Database.Team | null> {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.name != null) payload.name = updates.name.trim();
    if (updates.slug != null) {
      payload.slug = updates.slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }
    const { data, error } = await supabaseAdmin
      .from('teams')
      .update(payload)
      .eq('id', teamId)
      .select()
      .single();
    if (error) return null;
    return data as Database.Team;
  }

  /**
   * Invite by email. Creates team_invites row with token. Caller should send email with link containing token.
   */
  static async inviteByEmail(
    teamId: string,
    email: string,
    role: 'admin' | 'member',
    inviterId: string
  ): Promise<{ token: string } | null> {
    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error } = await supabaseAdmin.from('team_invites').insert({
      team_id: teamId,
      email: email.trim().toLowerCase(),
      role,
      token,
      expires_at: expiresAt.toISOString(),
      inviter_id: inviterId,
    });
    if (error) {
      logger.error('EnterpriseService.inviteByEmail', { error, teamId });
      return null;
    }
    return { token };
  }

  static async getInviteByToken(token: string): Promise<Database.TeamInvite | null> {
    const { data, error } = await supabaseAdmin
      .from('team_invites')
      .select('*')
      .eq('token', token)
      .single();
    if (error) return null;
    const inv = data as Database.TeamInvite;
    if (new Date(inv.expires_at) < new Date()) return null;
    return inv;
  }

  /**
   * Accept invite: add user as member, delete invite.
   */
  static async acceptInvite(token: string, userId: string): Promise<Database.Team | null> {
    const inv = await this.getInviteByToken(token);
    if (!inv) return null;
    const ok = await this.addMember(inv.team_id, userId, inv.role);
    if (!ok) return null;
    await supabaseAdmin.from('team_invites').delete().eq('id', inv.id);
    return this.getTeam(inv.team_id);
  }

  /**
   * Store enterprise inquiry (contact-sales form). No auth required; backend uses service role to insert.
   */
  static async submitEnterpriseInquiry(params: {
    name: string;
    email: string;
    company?: string;
    message?: string;
  }): Promise<Database.EnterpriseInquiry | null> {
    const { data, error } = await supabaseAdmin.from('enterprise_inquiries').insert({
      name: params.name.trim(),
      email: params.email.trim().toLowerCase(),
      company: params.company?.trim() || null,
      message: params.message?.trim() || null,
    }).select().single();

    if (error) {
      logger.error('EnterpriseService.submitEnterpriseInquiry', { error });
      return null;
    }
    return data as Database.EnterpriseInquiry;
  }
}

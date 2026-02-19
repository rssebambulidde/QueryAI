/**
 * Database type definitions matching Supabase schema
 */

export namespace Database {
  export interface UserProfile {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
    role?: 'user' | 'admin' | 'super_admin';
    created_at: string;
    updated_at: string;
  }

  export interface Topic {
    id: string;
    user_id: string;
    name: string;
    description?: string;
    scope_config?: Record<string, any>;
    parent_topic_id?: string | null;
    topic_path?: string;
    created_at: string;
    updated_at: string;
  }

  export interface Conversation {
    id: string;
    user_id: string;
    topic_id?: string;
    title?: string;
    metadata?: Record<string, any>; // Stores filter settings and other conversation-specific data
    created_at: string;
    updated_at: string;
  }

  export interface Message {
    id: string;
    conversation_id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: Record<string, any>[];
    metadata?: Record<string, any>;
    version: number;
    parent_message_id?: string | null;
    created_at: string;
  }

  /** Payment provider: PayPal only. */
  export type PaymentProvider = 'paypal';

  /** Billing period: monthly or annual. */
  export type BillingPeriod = 'monthly' | 'annual';

  export type SubscriptionTier = 'free' | 'starter' | 'premium' | 'pro' | 'enterprise';

  export interface Subscription {
    id: string;
    user_id: string;
    tier: SubscriptionTier;
    status: 'active' | 'cancelled' | 'expired';
    current_period_start?: string;
    current_period_end?: string;
    cancel_at_period_end: boolean;
    pending_tier?: SubscriptionTier;
    trial_end?: string;
    grace_period_end?: string;
    auto_renew: boolean;
    tavily_searches_used?: number;
    tavily_searches_limit?: number;
    paypal_subscription_id?: string;
    /** Billing interval; default 'monthly'. */
    billing_period?: BillingPeriod;
    /** Discount percentage when billing_period is annual (0–100). */
    annual_discount?: number;
    created_at: string;
    updated_at: string;
  }

  export interface UsageLog {
    id: string;
    user_id: string;
    type: 'query' | 'api_call' | 'document_upload';
    metadata?: Record<string, any>;
    created_at: string;
  }

  export interface Document {
    id: string;
    user_id: string;
    topic_id?: string;
    filename: string;
    file_path: string;
    file_type: 'pdf' | 'docx' | 'txt' | 'md';
    file_size: number;
    status: 'stored' | 'processing' | 'extracted' | 'failed' | 'embedding' | 'embedded' | 'embedding_failed' | 'processed';
    extracted_text?: string;
    text_length?: number;
    extraction_error?: string;
    embedding_error?: string;
    metadata?: Record<string, any>;
    created_at: string;
    updated_at: string;
  }

  export interface DocumentChunk {
    id: string;
    document_id: string;
    chunk_index: number;
    content: string;
    start_char?: number;
    end_char?: number;
    token_count?: number;
    embedding_id?: string;
    created_at: string;
  }

  export interface Collection {
    id: string;
    user_id: string;
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    created_at: string;
    updated_at: string;
  }

  export interface CollectionConversation {
    id: string;
    collection_id: string;
    conversation_id: string;
    added_at: string;
  }

  export interface Payment {
    id: string;
    user_id: string;
    subscription_id?: string;
    payment_provider: PaymentProvider;
    paypal_payment_id?: string;
    paypal_order_id?: string;
    paypal_subscription_id?: string;
    tier: SubscriptionTier;
    amount: number;
    currency: string;
    status: 'pending' | 'completed' | 'failed' | 'cancelled';
    payment_method?: string;
    payment_description?: string;
    callback_data?: Record<string, any>;
    webhook_data?: Record<string, any>;
    refund_amount?: number;
    refund_reason?: string;
    refunded_at?: string;
    retry_count?: number;
    last_retry_at?: string;
    recurring_payment_id?: string;
    created_at: string;
    updated_at: string;
    completed_at?: string;
  }

  export interface SubscriptionHistory {
    id: string;
    subscription_id: string;
    user_id: string;
    change_type: 'tier_change' | 'status_change' | 'period_change' | 'cancellation' | 'reactivation' | 'renewal';
    old_value?: Record<string, any>;
    new_value?: Record<string, any>;
    reason?: string;
    created_at: string;
  }

  export interface Refund {
    id: string;
    payment_id: string;
    user_id: string;
    amount: number;
    currency: string;
    reason?: string;
    paypal_refund_id?: string;
    status: 'pending' | 'completed' | 'failed';
    refund_data?: Record<string, any>;
    created_at: string;
    updated_at: string;
    completed_at?: string;
  }

  export interface EmailPreferences {
    user_id: string;
    opt_out_non_critical: boolean;
    opt_out_reminders: boolean;
    opt_out_marketing: boolean;
    created_at: string;
    updated_at: string;
  }

  export interface EmailLog {
    id: string;
    user_id: string | null;
    to_email: string;
    to_name: string | null;
    subject: string;
    html_content: string | null;
    text_content: string | null;
    template_id: string | null;
    status: 'pending' | 'sent' | 'failed' | 'skipped';
    retry_count: number;
    max_retries: number;
    last_error: string | null;
    brevo_message_id: string | null;
    metadata: Record<string, any> | null;
    created_at: string;
    updated_at: string;
    sent_at: string | null;
  }

  /** Overage tracking: usage beyond tier limits, per user/period/metric. */
  export type OverageMetricType = 'queries' | 'document_upload' | 'tavily_searches';

  export interface OverageRecord {
    id: string;
    user_id: string;
    subscription_id?: string;
    period_start: string;
    period_end: string;
    metric_type: OverageMetricType;
    limit_value: number;
    usage_value: number;
    overage_units: number;
    tier: 'free' | 'starter' | 'premium' | 'pro' | 'enterprise';
    currency: string;
    unit_price: number;
    amount_charged: number;
    payment_id?: string;
    created_at: string;
    updated_at: string;
  }

  export interface Team {
    id: string;
    name: string;
    slug: string;
    owner_id: string;
    subscription_id?: string;
    created_at: string;
    updated_at: string;
  }

  export type TeamMemberRole = 'owner' | 'admin' | 'member';

  export interface TeamMember {
    id: string;
    team_id: string;
    user_id: string;
    role: TeamMemberRole;
    created_at: string;
    updated_at: string;
  }

  export interface TeamInvite {
    id: string;
    team_id: string;
    email: string;
    role: 'admin' | 'member';
    token: string;
    expires_at: string;
    inviter_id?: string;
    created_at: string;
  }

  export interface EnterpriseInquiry {
    id: string;
    name: string;
    email: string;
    company?: string;
    message?: string;
    created_at: string;
  }
}

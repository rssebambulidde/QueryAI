/**
 * Database type definitions matching Supabase schema
 */

export namespace Database {
  export interface UserProfile {
    id: string;
    email: string;
    full_name?: string;
    created_at: string;
    updated_at: string;
  }

  export interface Topic {
    id: string;
    user_id: string;
    name: string;
    description?: string;
    scope_config?: Record<string, any>;
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
    created_at: string;
  }

  export interface Subscription {
    id: string;
    user_id: string;
    tier: 'free' | 'premium' | 'pro';
    status: 'active' | 'cancelled' | 'expired';
    current_period_start?: string;
    current_period_end?: string;
    cancel_at_period_end: boolean;
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

  export interface ApiKey {
    id: string;
    user_id: string;
    topic_id?: string;
    key_hash: string;
    key_prefix: string;
    name: string;
    description?: string;
    rate_limit_per_hour: number;
    rate_limit_per_day: number;
    is_active: boolean;
    last_used_at?: string;
    expires_at?: string;
    created_at: string;
    updated_at: string;
  }

  export interface EmbeddingConfig {
    id: string;
    user_id: string;
    topic_id: string;
    name: string;
    embed_code?: string;
    customization?: Record<string, any>;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }

  export interface ApiKeyUsage {
    id: string;
    api_key_id: string;
    endpoint: string;
    method: string;
    status_code?: number;
    response_time_ms?: number;
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
    pesapal_order_tracking_id?: string;
    pesapal_merchant_reference?: string;
    tier: 'free' | 'premium' | 'pro';
    amount: number;
    currency: string;
    status: 'pending' | 'completed' | 'failed' | 'cancelled';
    payment_method?: string;
    payment_description?: string;
    callback_data?: Record<string, any>;
    webhook_data?: Record<string, any>;
    created_at: string;
    updated_at: string;
    completed_at?: string;
  }
}

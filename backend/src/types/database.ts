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
    status: 'processing' | 'extracted' | 'failed' | 'embedding' | 'embedded' | 'embedding_failed' | 'processed';
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
}

/**
 * Source Types
 * Type definitions for sources with enhanced metadata
 */

/**
 * Source metadata
 * Comprehensive metadata for citations
 */
export interface SourceMetadata {
  // Publication information
  publishedDate?: string; // ISO date string for publication date
  publicationDate?: string; // Alternative field name
  accessDate?: string; // ISO date string for when source was accessed (web sources) - REQUIRED for web sources
  
  // Author information
  author?: string; // Author name
  authors?: string[]; // Multiple authors
  
  // Document-specific metadata
  documentType?: string; // File type (pdf, docx, txt, md) - REQUIRED for documents
  fileSize?: number; // File size in bytes - REQUIRED for documents
  fileSizeFormatted?: string; // Human-readable file size (e.g., "2.5 MB")
  
  // Timestamps
  createdAt?: string; // ISO date string for document creation
  updatedAt?: string; // ISO date string for document last update
  timestamp?: string; // Generic timestamp (legacy support)
  
  // Additional metadata
  publisher?: string; // Publisher name
  journal?: string; // Journal name (for academic sources)
  volume?: string; // Volume number
  issue?: string; // Issue number
  pages?: string; // Page numbers
  doi?: string; // Digital Object Identifier
  isbn?: string; // ISBN for books
  url?: string; // URL (for web sources)
  
  // Quality indicators
  authorityScore?: number; // Domain authority score (0-1)
  qualityScore?: number; // Quality score (0-1)
  relevanceScore?: number; // Relevance score (0-1)
}

/**
 * Enhanced source interface
 * Source with comprehensive metadata
 */
export interface EnhancedSource {
  type: 'document' | 'web';
  title: string;
  url?: string;
  documentId?: string;
  snippet?: string;
  score?: number;
  metadata?: SourceMetadata;
}

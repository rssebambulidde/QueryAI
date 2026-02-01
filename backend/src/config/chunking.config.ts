/**
 * Chunking Configuration
 * Default settings and configuration options for text chunking
 * Includes adaptive chunk sizing based on document type
 */

import { ChunkingStrategy } from '../services/semantic-chunking.service';
import { DocumentType } from '../services/document-type-detection.service';

/**
 * Chunk size profile for a document type
 */
export interface ChunkSizeProfile {
  maxChunkSize: number; // Maximum tokens per chunk
  minChunkSize: number; // Minimum tokens per chunk
  overlapRatio: number; // Overlap as ratio of maxChunkSize (0.0 - 1.0)
  preferredStrategy?: ChunkingStrategy; // Preferred chunking strategy
}

/**
 * Adaptive chunking configuration
 */
export interface AdaptiveChunkingConfig {
  // Document type profiles
  profiles: Record<DocumentType, ChunkSizeProfile>;
  
  // Overlap calculation mode
  overlapMode: 'fixed' | 'ratio' | 'dynamic'; // How to calculate overlap
  
  // Dynamic overlap settings
  dynamicOverlap: {
    minOverlapRatio: number; // Minimum overlap ratio (default: 0.1 = 10%)
    maxOverlapRatio: number; // Maximum overlap ratio (default: 0.2 = 20%)
    baseOverlapRatio: number; // Base overlap ratio (default: 0.125 = 12.5%)
  };
  
  // Enable adaptive sizing
  enabled: boolean;
}

/**
 * Chunking Configuration
 */
export interface ChunkingConfig {
  // Default strategy
  defaultStrategy: ChunkingStrategy;
  
  // Semantic chunking settings
  semantic: {
    enabled: boolean;
    similarityThreshold: number;
    minSentencesForSemantic: number; // Minimum sentences to use semantic chunking
    fallbackToSentence: boolean;
  };
  
  // Sentence-based chunking settings
  sentence: {
    enabled: boolean;
    defaultMaxChunkSize: number;
    defaultOverlapSize: number;
    defaultMinChunkSize: number;
  };
  
  // Adaptive chunking
  adaptive: AdaptiveChunkingConfig;
}

/**
 * Default chunk size profiles for different document types
 */
export const DEFAULT_CHUNK_SIZE_PROFILES: Record<DocumentType, ChunkSizeProfile> = {
  // PDF documents: Typically structured, medium complexity
  pdf: {
    maxChunkSize: 1000, // Larger chunks for structured documents
    minChunkSize: 150,
    overlapRatio: 0.15, // 15% overlap
    preferredStrategy: 'sentence',
  },
  
  // DOCX documents: Similar to PDF, well-structured
  docx: {
    maxChunkSize: 1000,
    minChunkSize: 150,
    overlapRatio: 0.15,
    preferredStrategy: 'sentence',
  },
  
  // Plain text: Simple structure, smaller chunks
  text: {
    maxChunkSize: 800, // Standard size
    minChunkSize: 100,
    overlapRatio: 0.125, // 12.5% overlap
    preferredStrategy: 'sentence',
  },
  
  // Code files: High complexity, need smaller chunks for context
  code: {
    maxChunkSize: 600, // Smaller chunks for code (functions, classes)
    minChunkSize: 80,
    overlapRatio: 0.2, // Higher overlap for code (20%)
    preferredStrategy: 'sentence', // Code benefits from sentence-based (line-based)
  },
  
  // Markdown: Structured but readable, medium chunks
  markdown: {
    maxChunkSize: 900,
    minChunkSize: 120,
    overlapRatio: 0.15,
    preferredStrategy: 'sentence',
  },
  
  // HTML: Structured but can be verbose, medium-large chunks
  html: {
    maxChunkSize: 900,
    minChunkSize: 120,
    overlapRatio: 0.15,
    preferredStrategy: 'sentence',
  },
  
  // Unknown: Use defaults
  unknown: {
    maxChunkSize: 800,
    minChunkSize: 100,
    overlapRatio: 0.125,
    preferredStrategy: 'sentence',
  },
};

/**
 * Default adaptive chunking configuration
 */
export const DEFAULT_ADAPTIVE_CONFIG: AdaptiveChunkingConfig = {
  profiles: DEFAULT_CHUNK_SIZE_PROFILES,
  overlapMode: 'dynamic', // Use dynamic overlap calculation
  dynamicOverlap: {
    minOverlapRatio: 0.1, // 10% minimum
    maxOverlapRatio: 0.2, // 20% maximum
    baseOverlapRatio: 0.125, // 12.5% base
  },
  enabled: true, // Adaptive sizing enabled by default
};

export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  defaultStrategy: 'sentence', // Default to sentence-based for backward compatibility
  
  semantic: {
    enabled: true, // Semantic chunking is available but not default
    similarityThreshold: 0.7, // Default similarity threshold
    minSentencesForSemantic: 3, // Need at least 3 sentences for semantic chunking
    fallbackToSentence: true, // Fallback to sentence-based on failure
  },
  
  sentence: {
    enabled: true,
    defaultMaxChunkSize: 800,
    defaultOverlapSize: 100,
    defaultMinChunkSize: 100,
  },
  
  adaptive: DEFAULT_ADAPTIVE_CONFIG,
};

/**
 * Get chunk size profile for a document type
 */
export function getChunkSizeProfile(
  documentType: DocumentType,
  config: ChunkingConfig = DEFAULT_CHUNKING_CONFIG
): ChunkSizeProfile {
  return config.adaptive.profiles[documentType] || config.adaptive.profiles.unknown;
}

/**
 * Calculate overlap size based on chunk size and mode
 */
export function calculateOverlapSize(
  maxChunkSize: number,
  overlapMode: 'fixed' | 'ratio' | 'dynamic' = 'dynamic',
  profile?: ChunkSizeProfile,
  config?: AdaptiveChunkingConfig
): number {
  if (overlapMode === 'fixed' && profile) {
    // Fixed overlap from profile (if specified)
    return Math.round(maxChunkSize * profile.overlapRatio);
  }
  
  if (overlapMode === 'ratio' && profile) {
    // Use ratio from profile
    return Math.round(maxChunkSize * profile.overlapRatio);
  }
  
  if (overlapMode === 'dynamic' && config) {
    // Dynamic overlap: base ratio, adjusted based on chunk size
    const { baseOverlapRatio, minOverlapRatio, maxOverlapRatio } = config.dynamicOverlap;
    
    // Larger chunks get slightly lower overlap ratio (but not below min)
    // Smaller chunks get slightly higher overlap ratio (but not above max)
    let overlapRatio = baseOverlapRatio;
    
    if (maxChunkSize > 1000) {
      // Very large chunks: reduce overlap slightly
      overlapRatio = Math.max(minOverlapRatio, baseOverlapRatio - 0.02);
    } else if (maxChunkSize < 500) {
      // Small chunks: increase overlap slightly
      overlapRatio = Math.min(maxOverlapRatio, baseOverlapRatio + 0.02);
    }
    
    return Math.round(maxChunkSize * overlapRatio);
  }
  
  // Fallback: 12.5% of max chunk size
  return Math.round(maxChunkSize * 0.125);
}

/**
 * Get adaptive chunking options for a document type
 */
export function getAdaptiveChunkingOptions(
  documentType: DocumentType,
  config: ChunkingConfig = DEFAULT_CHUNKING_CONFIG
): {
  maxChunkSize: number;
  minChunkSize: number;
  overlapSize: number;
  strategy?: ChunkingStrategy;
} {
  if (!config.adaptive.enabled) {
    // Return defaults if adaptive sizing is disabled
    return {
      maxChunkSize: config.sentence.defaultMaxChunkSize,
      minChunkSize: config.sentence.defaultMinChunkSize,
      overlapSize: config.sentence.defaultOverlapSize,
      strategy: config.defaultStrategy,
    };
  }

  const profile = getChunkSizeProfile(documentType, config);
  const overlapSize = calculateOverlapSize(
    profile.maxChunkSize,
    config.adaptive.overlapMode,
    profile,
    config.adaptive
  );

  return {
    maxChunkSize: profile.maxChunkSize,
    minChunkSize: profile.minChunkSize,
    overlapSize,
    strategy: profile.preferredStrategy || config.defaultStrategy,
  };
}

/**
 * Get chunking configuration
 * Can be overridden by environment variables or user preferences
 */
export function getChunkingConfig(): ChunkingConfig {
  // In the future, this could read from environment variables or user settings
  return DEFAULT_CHUNKING_CONFIG;
}

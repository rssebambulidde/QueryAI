/**
 * Citation Format Validator Service
 * Validates citation format and provides citation guidelines
 */

import * as fs from 'fs';
import * as path from 'path';
import logger from '../config/logger';

/**
 * Citation guidelines structure
 */
interface CitationGuidelines {
  whenToCite: Record<string, string>;
  citationFormats: {
    documentCitations: CitationFormat;
    documentCitationsWithUrl: CitationFormat;
    webCitations: CitationFormat;
    webCitationsWithTitle: CitationFormat;
  };
  citationPlacement: {
    inline: CitationPlacement;
    sentenceStart: CitationPlacement;
    sentenceEnd: CitationPlacement;
  };
  citationExamples: Record<string, CitationExample>;
  citationRules: {
    mandatory: string[];
    formatting: string[];
    placement: string[];
    validation: string[];
  };
  commonMistakes: Record<string, CommonMistake>;
}

interface CitationFormat {
  format: string;
  description: string;
  examples: string[];
  rules: string[];
}

interface CitationPlacement {
  description: string;
  examples: string[];
  rules: string[];
}

interface CitationExample {
  type: string;
  example: string;
  explanation: string;
}

interface CommonMistake {
  mistake: string;
  correct: string;
  example: {
    wrong: string;
    correct: string;
  };
}

/**
 * Source information for validation
 */
export interface SourceInfo {
  type: 'document' | 'web';
  index?: number; // Source index (1-based)
  title?: string;
  url?: string;
  documentId?: string;
  id?: string; // Unique identifier
}

/**
 * Citation validation result
 */
export interface CitationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  matchedCitations: number; // Number of citations that match sources
  unmatchedCitations: number; // Number of citations that don't match sources
  missingSources: string[]; // Citations referencing non-existent sources
  invalidUrls: string[]; // Citations with invalid URLs
  invalidDocumentIds: string[]; // Citations with invalid document IDs
}

/**
 * Citation format patterns
 */
const CITATION_PATTERNS = {
  // Document citation: [Document N] or [Document Name]
  documentCitation: /\[Document\s+\d+\]|\[Document\s+[^\]]+\]/i,
  
  // Document citation with URL: [Document Name](document://id)
  documentCitationWithUrl: /\[Document\s+[^\]]+\]\(document:\/\/[^\)]+\)/i,
  
  // Web citation: [Web Source N](URL)
  webCitation: /\[Web\s+Source\s+\d+\]\(https?:\/\/[^\)]+\)/i,
  
  // Web citation with title: [Title](URL)
  webCitationWithTitle: /\[[^\]]+\]\(https?:\/\/[^\)]+\)/i,
  
  // Any markdown link
  markdownLink: /\[[^\]]+\]\([^\)]+\)/g,
};

/**
 * Citation Validator Service
 */
export class CitationValidatorService {
  private static guidelinesCache: CitationGuidelines | null = null;
  private static cacheTimestamp: number = 0;
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Load citation guidelines from JSON file
   */
  private static loadGuidelines(): CitationGuidelines {
    // Check cache
    const now = Date.now();
    if (this.guidelinesCache && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.guidelinesCache;
    }

    try {
      const guidelinesPath = path.join(__dirname, '../data/citation-examples.json');
      const fileContent = fs.readFileSync(guidelinesPath, 'utf-8');
      const data = JSON.parse(fileContent);

      this.guidelinesCache = data.citationGuidelines;
      this.cacheTimestamp = now;

      logger.debug('Citation guidelines loaded');

      return this.guidelinesCache!;
    } catch (error: any) {
      logger.error('Failed to load citation guidelines', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validate citation format in text
   */
  static validateCitationFormat(text: string): CitationValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for markdown links
    const markdownLinks = text.match(CITATION_PATTERNS.markdownLink) || [];
    
    // Check for document citations
    const documentCitations = text.match(CITATION_PATTERNS.documentCitation) || [];
    
    // Check for web citations
    const webCitations = text.match(CITATION_PATTERNS.webCitation) || [];

    // Validate markdown link format
    for (const link of markdownLinks) {
      // Check if it's a valid markdown link
      const linkMatch = link.match(/\[([^\]]+)\]\(([^\)]+)\)/);
      if (!linkMatch) {
        errors.push(`Invalid markdown link format: ${link}`);
        continue;
      }

      const [, textPart, urlPart] = linkMatch;

      // Validate URL format
      if (urlPart.startsWith('http://') || urlPart.startsWith('https://')) {
        // Web citation - check if URL is complete
        if (urlPart.length < 10) {
          warnings.push(`Suspiciously short URL: ${urlPart}`);
        }
      } else if (urlPart.startsWith('document://')) {
        // Document citation with URL - valid
      } else {
        errors.push(`Invalid URL format in citation: ${urlPart}`);
      }

      // Check if text part is empty
      if (!textPart || textPart.trim().length === 0) {
        errors.push(`Empty citation text: ${link}`);
      }
    }

    // Check for potential missing citations
    // Look for sentences with factual indicators but no citations
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    for (const sentence of sentences) {
      const hasCitation = CITATION_PATTERNS.markdownLink.test(sentence) || 
                         CITATION_PATTERNS.documentCitation.test(sentence);
      
      // Check for factual indicators
      const hasFactualIndicators = /(according to|study shows|research|data|statistics|percent|million|billion|found that|reported|stated)/i.test(sentence);
      
      if (hasFactualIndicators && !hasCitation && sentence.length > 20) {
        warnings.push(`Potential missing citation in sentence: "${sentence.substring(0, 100)}..."`);
      }
    }

    // Check for citation clustering (all citations at end)
    const lastParagraph = text.split('\n\n').pop() || '';
    const citationsInLastParagraph = (lastParagraph.match(CITATION_PATTERNS.markdownLink) || []).length;
    const totalCitations = markdownLinks.length;
    
    if (citationsInLastParagraph > 0 && citationsInLastParagraph === totalCitations && totalCitations > 1) {
      suggestions.push('Consider placing citations inline throughout the text rather than clustering them at the end');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Extract citations from text
   */
  static extractCitations(text: string): {
    documentCitations: string[];
    webCitations: string[];
    allCitations: string[];
  } {
    const documentCitations = (text.match(CITATION_PATTERNS.documentCitation) || []).concat(
      text.match(CITATION_PATTERNS.documentCitationWithUrl) || []
    );
    
    const webCitations = text.match(CITATION_PATTERNS.webCitation) || [];
    
    const allCitations = [...documentCitations, ...webCitations];

    return {
      documentCitations: [...new Set(documentCitations)],
      webCitations: [...new Set(webCitations)],
      allCitations: [...new Set(allCitations)],
    };
  }

  /**
   * Format citation guidelines for prompt
   */
  static formatCitationGuidelines(): string {
    try {
      const guidelines = this.loadGuidelines();
      
      let formatted = '\n\n=== ENHANCED CITATION INSTRUCTIONS ===\n\n';
      
      // When to cite
      formatted += 'WHEN TO CITE (MANDATORY):\n';
      formatted += 'You MUST cite sources for:\n';
      for (const [type, description] of Object.entries(guidelines.whenToCite)) {
        formatted += `- ${type.charAt(0).toUpperCase() + type.slice(1)}: ${description}\n`;
      }
      formatted += '\n';

      // Citation formats
      formatted += 'CITATION FORMATS:\n';
      formatted += '1. Document Citations:\n';
      formatted += `   Format: ${guidelines.citationFormats.documentCitations.format}\n`;
      formatted += `   ${guidelines.citationFormats.documentCitations.description}\n`;
      formatted += `   Examples: ${guidelines.citationFormats.documentCitations.examples.join(', ')}\n`;
      formatted += `   Rules:\n`;
      for (const rule of guidelines.citationFormats.documentCitations.rules) {
        formatted += `   - ${rule}\n`;
      }
      formatted += '\n';

      formatted += '2. Document Citations with URL:\n';
      formatted += `   Format: ${guidelines.citationFormats.documentCitationsWithUrl.format}\n`;
      formatted += `   ${guidelines.citationFormats.documentCitationsWithUrl.description}\n`;
      formatted += `   Examples: ${guidelines.citationFormats.documentCitationsWithUrl.examples.join(', ')}\n`;
      formatted += '\n';

      formatted += '3. Web Citations:\n';
      formatted += `   Format: ${guidelines.citationFormats.webCitations.format}\n`;
      formatted += `   ${guidelines.citationFormats.webCitations.description}\n`;
      formatted += `   Examples: ${guidelines.citationFormats.webCitations.examples.join(', ')}\n`;
      formatted += `   Rules:\n`;
      for (const rule of guidelines.citationFormats.webCitations.rules) {
        formatted += `   - ${rule}\n`;
      }
      formatted += '\n';

      // Citation placement
      formatted += 'CITATION PLACEMENT:\n';
      formatted += '1. Inline Citations (PREFERRED):\n';
      formatted += `   ${guidelines.citationPlacement.inline.description}\n`;
      formatted += `   Examples:\n`;
      for (const example of guidelines.citationPlacement.inline.examples) {
        formatted += `   - ${example}\n`;
      }
      formatted += '\n';

      // Citation examples
      formatted += 'CITATION EXAMPLES BY TYPE:\n';
      for (const [key, example] of Object.entries(guidelines.citationExamples)) {
        formatted += `${example.type.charAt(0).toUpperCase() + example.type.slice(1)}:\n`;
        formatted += `   Example: ${example.example}\n`;
        formatted += `   Explanation: ${example.explanation}\n\n`;
      }

      // Common mistakes
      formatted += 'COMMON MISTAKES TO AVOID:\n';
      for (const [key, mistake] of Object.entries(guidelines.commonMistakes)) {
        formatted += `${mistake.mistake}:\n`;
        formatted += `   Wrong: ${mistake.example.wrong}\n`;
        formatted += `   Correct: ${mistake.example.correct}\n`;
        formatted += `   Rule: ${mistake.correct}\n\n`;
      }

      // Mandatory rules
      formatted += 'MANDATORY CITATION RULES:\n';
      for (const rule of guidelines.citationRules.mandatory) {
        formatted += `- ${rule}\n`;
      }
      formatted += '\n';

      formatted += 'FORMATTING RULES:\n';
      for (const rule of guidelines.citationRules.formatting) {
        formatted += `- ${rule}\n`;
      }
      formatted += '\n';

      formatted += 'VALIDATION RULES:\n';
      for (const rule of guidelines.citationRules.validation) {
        formatted += `- ${rule}\n`;
      }
      formatted += '\n';

      formatted += '=== END ENHANCED CITATION INSTRUCTIONS ===\n';

      return formatted;
    } catch (error: any) {
      logger.warn('Failed to format citation guidelines, using fallback', {
        error: error.message,
      });
      return '';
    }
  }

  /**
   * Get citation examples for specific type
   */
  static getCitationExamples(type?: string): string {
    try {
      const guidelines = this.loadGuidelines();
      
      if (type && guidelines.citationExamples[type]) {
        const example = guidelines.citationExamples[type];
        return `${example.type}: ${example.example}\nExplanation: ${example.explanation}`;
      }

      // Return all examples
      let examples = 'CITATION EXAMPLES:\n\n';
      for (const [key, example] of Object.entries(guidelines.citationExamples)) {
        examples += `${example.type.charAt(0).toUpperCase() + example.type.slice(1)}:\n`;
        examples += `  ${example.example}\n`;
        examples += `  ${example.explanation}\n\n`;
      }
      return examples;
    } catch (error: any) {
      logger.warn('Failed to get citation examples', {
        error: error.message,
      });
      return '';
    }
  }

  /**
   * Clear guidelines cache
   */
  static clearCache(): void {
    this.guidelinesCache = null;
    this.cacheTimestamp = 0;
    logger.debug('Citation guidelines cache cleared');
  }

  /**
   * Validate citations against provided sources
   */
  static validateCitationsAgainstSources(
    parsedCitations: import('./citation-parser.service').ParsedCitation[],
    sources: SourceInfo[]
  ): CitationValidationResult {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    const missingSources: string[] = [];
    const invalidUrls: string[] = [];
    const invalidDocumentIds: string[] = [];

    try {
      // Build source index maps for fast lookup
      const documentSourcesByIndex = new Map<number, SourceInfo>();
      const documentSourcesById = new Map<string, SourceInfo>();
      const webSourcesByIndex = new Map<number, SourceInfo>();
      const webSourcesByUrl = new Map<string, SourceInfo>();

      sources.forEach((source, idx) => {
        const sourceIndex = idx + 1; // 1-based index

        if (source.type === 'document') {
          if (source.index !== undefined) {
            documentSourcesByIndex.set(source.index, source);
          }
          if (source.documentId) {
            documentSourcesById.set(source.documentId, source);
          }
          if (source.id) {
            documentSourcesById.set(source.id, source);
          }
          // Also use sourceIndex as fallback
          documentSourcesByIndex.set(sourceIndex, source);
        } else if (source.type === 'web') {
          if (source.index !== undefined) {
            webSourcesByIndex.set(source.index, source);
          }
          if (source.url) {
            webSourcesByUrl.set(source.url, source);
          }
          // Also use sourceIndex as fallback
          webSourcesByIndex.set(sourceIndex, source);
        }
      });

      let matchedCount = 0;
      let unmatchedCount = 0;

      // Validate each citation
      for (const citation of parsedCitations) {
        let matched = false;

        if (citation.type === 'document') {
          // Check by index
          if (citation.index !== undefined) {
            const source = documentSourcesByIndex.get(citation.index);
            if (source) {
              matched = true;
              matchedCount++;

              // Validate document ID if present
              if (citation.documentId) {
                const sourceById = documentSourcesById.get(citation.documentId);
                if (!sourceById && source.documentId && citation.documentId !== source.documentId) {
                  warnings.push(`Citation [Document ${citation.index}] references document ID "${citation.documentId}" but source has ID "${source.documentId}"`);
                }
              }
            } else {
              unmatchedCount++;
              missingSources.push(citation.format);
              errors.push(`Citation ${citation.format} references non-existent Document ${citation.index}`);
            }
          } else if (citation.documentId) {
            // Check by document ID
            const source = documentSourcesById.get(citation.documentId);
            if (source) {
              matched = true;
              matchedCount++;
            } else {
              unmatchedCount++;
              invalidDocumentIds.push(citation.documentId);
              errors.push(`Citation ${citation.format} references non-existent document ID "${citation.documentId}"`);
            }
          } else if (citation.name) {
            // Check by name (fuzzy match)
            const matchingSource = sources.find(
              s => s.type === 'document' && s.title?.toLowerCase().includes(citation.name!.toLowerCase())
            );
            if (matchingSource) {
              matched = true;
              matchedCount++;
              warnings.push(`Citation ${citation.format} matched by name, but consider using index or ID for accuracy`);
            } else {
              unmatchedCount++;
              missingSources.push(citation.format);
              warnings.push(`Citation ${citation.format} references document by name but no matching source found`);
            }
          } else {
            unmatchedCount++;
            errors.push(`Citation ${citation.format} is missing index, document ID, or name`);
          }
        } else if (citation.type === 'web') {
          // Check by index
          if (citation.index !== undefined) {
            const source = webSourcesByIndex.get(citation.index);
            if (source) {
              matched = true;
              matchedCount++;

              // Validate URL if present
              if (citation.url) {
                const sourceByUrl = webSourcesByUrl.get(citation.url);
                if (!sourceByUrl && source.url && citation.url !== source.url) {
                  warnings.push(`Citation [Web Source ${citation.index}] references URL "${citation.url}" but source has URL "${source.url}"`);
                } else if (!sourceByUrl && !source.url) {
                  warnings.push(`Citation [Web Source ${citation.index}] includes URL but source doesn't have one`);
                }
              } else if (source.url) {
                warnings.push(`Citation [Web Source ${citation.index}] is missing URL, source has URL: ${source.url}`);
              }
            } else {
              unmatchedCount++;
              missingSources.push(citation.format);
              errors.push(`Citation ${citation.format} references non-existent Web Source ${citation.index}`);
            }
          } else if (citation.url) {
            // Check by URL
            const source = webSourcesByUrl.get(citation.url);
            if (source) {
              matched = true;
              matchedCount++;
            } else {
              unmatchedCount++;
              invalidUrls.push(citation.url);
              errors.push(`Citation ${citation.format} references non-existent URL "${citation.url}"`);
            }
          } else if (citation.name) {
            // Check by name (fuzzy match)
            const matchingSource = sources.find(
              s => s.type === 'web' && (s.title?.toLowerCase().includes(citation.name!.toLowerCase()) || s.url?.includes(citation.name))
            );
            if (matchingSource) {
              matched = true;
              matchedCount++;
              warnings.push(`Citation ${citation.format} matched by name, but consider using index or URL for accuracy`);
            } else {
              unmatchedCount++;
              missingSources.push(citation.format);
              warnings.push(`Citation ${citation.format} references web source by name but no matching source found`);
            }
          } else {
            unmatchedCount++;
            errors.push(`Citation ${citation.format} is missing index, URL, or name`);
          }
        } else if (citation.type === 'reference') {
          // Reference citations are harder to validate without a reference list
          // Just check format
          if (citation.index === undefined) {
            warnings.push(`Reference citation ${citation.format} is missing index`);
          }
          matchedCount++; // Assume valid if format is correct
        }

        // Additional format validation
        const formatValidation = this.validateCitationFormat(citation.format);
        if (!formatValidation.isValid) {
          errors.push(...formatValidation.errors.map(e => `Citation ${citation.format}: ${e}`));
        }
        if (formatValidation.warnings.length > 0) {
          warnings.push(...formatValidation.warnings.map(w => `Citation ${citation.format}: ${w}`));
        }
      }

      // Check for sources that weren't cited
      const citedIndices = new Set<number>();
      const citedUrls = new Set<string>();
      const citedDocumentIds = new Set<string>();

      parsedCitations.forEach(citation => {
        if (citation.index !== undefined) {
          citedIndices.add(citation.index);
        }
        if (citation.url) {
          citedUrls.add(citation.url);
        }
        if (citation.documentId) {
          citedDocumentIds.add(citation.documentId);
        }
      });

      sources.forEach((source, idx) => {
        const sourceIndex = idx + 1;
        if (source.type === 'document') {
          const wasCited = citedIndices.has(sourceIndex) ||
                          (source.documentId && citedDocumentIds.has(source.documentId)) ||
                          (source.id && citedDocumentIds.has(source.id));
          if (!wasCited) {
            suggestions.push(`Source "${source.title || `Document ${sourceIndex}`}" was provided but not cited`);
          }
        } else if (source.type === 'web') {
          const wasCited = citedIndices.has(sourceIndex) ||
                          (source.url && citedUrls.has(source.url));
          if (!wasCited) {
            suggestions.push(`Source "${source.title || source.url || `Web Source ${sourceIndex}`}" was provided but not cited`);
          }
        }
      });

      const validationTime = Date.now() - startTime;

      if (validationTime > 200) {
        logger.warn('Citation validation exceeded target time', {
          validationTimeMs: validationTime,
          targetTimeMs: 200,
          citationCount: parsedCitations.length,
        });
      }

      logger.debug('Citations validated against sources', {
        totalCitations: parsedCitations.length,
        matchedCitations: matchedCount,
        unmatchedCitations: unmatchedCount,
        validationTimeMs: validationTime,
      });

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
        matchedCitations: matchedCount,
        unmatchedCitations: unmatchedCount,
        missingSources: [...new Set(missingSources)],
        invalidUrls: [...new Set(invalidUrls)],
        invalidDocumentIds: [...new Set(invalidDocumentIds)],
      };
    } catch (error: any) {
      logger.error('Error validating citations against sources', {
        error: error.message,
        citationCount: parsedCitations.length,
        sourceCount: sources.length,
      });

      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: [],
        suggestions: [],
        matchedCitations: 0,
        unmatchedCitations: parsedCitations.length,
        missingSources: [],
        invalidUrls: [],
        invalidDocumentIds: [],
      };
    }
  }

  /**
   * Validate single citation format
   */
  private static validateCitationFormat(citationText: string): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for basic markdown link format
    if (citationText.includes('(') && citationText.includes(')')) {
      const linkMatch = citationText.match(/\[([^\]]+)\]\(([^\)]+)\)/);
      if (!linkMatch) {
        errors.push('Invalid markdown link format');
      } else {
        const [, textPart, urlPart] = linkMatch;

        // Validate URL
        if (urlPart.startsWith('http://') || urlPart.startsWith('https://')) {
          try {
            new URL(urlPart);
          } catch {
            errors.push(`Invalid URL format: ${urlPart}`);
          }
        } else if (urlPart.startsWith('document://')) {
          const docId = urlPart.substring(12);
          if (!docId || docId.trim().length === 0) {
            errors.push('Document ID is empty');
          } else if (!/^[a-zA-Z0-9_-]+$/.test(docId)) {
            warnings.push(`Document ID contains special characters: ${docId}`);
          }
        } else {
          errors.push(`Invalid URL scheme: ${urlPart}`);
        }

        // Validate text part
        if (!textPart || textPart.trim().length === 0) {
          errors.push('Citation text is empty');
        }
      }
    } else {
      // Simple citation without URL (e.g., [Document 1])
      const simpleMatch = citationText.match(/\[([^\]]+)\]/);
      if (!simpleMatch) {
        errors.push('Invalid citation format');
      } else {
        const textPart = simpleMatch[1];
        if (!textPart || textPart.trim().length === 0) {
          errors.push('Citation text is empty');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Verify source URLs/IDs exist
   */
  static async verifySourceExistence(
    sources: SourceInfo[]
  ): Promise<{ valid: SourceInfo[]; invalid: SourceInfo[]; errors: string[] }> {
    const valid: SourceInfo[] = [];
    const invalid: SourceInfo[] = [];
    const errors: string[] = [];

    for (const source of sources) {
      try {
        if (source.type === 'web' && source.url) {
          // Verify URL is accessible (basic check)
          try {
            const url = new URL(source.url);
            if (!['http:', 'https:'].includes(url.protocol)) {
              invalid.push(source);
              errors.push(`Invalid URL protocol for source: ${source.url}`);
              continue;
            }
            // Note: We don't actually fetch the URL to check existence (would be too slow)
            // Just validate format
            valid.push(source);
          } catch (urlError: any) {
            invalid.push(source);
            errors.push(`Invalid URL format for source: ${source.url} - ${urlError.message}`);
          }
        } else if (source.type === 'document' && source.documentId) {
          // Verify document ID format (actual existence check would require DB query)
          if (!/^[a-zA-Z0-9_-]+$/.test(source.documentId)) {
            invalid.push(source);
            errors.push(`Invalid document ID format: ${source.documentId}`);
          } else {
            valid.push(source);
          }
        } else {
          // Source without URL/ID - assume valid if it has a title
          if (source.title) {
            valid.push(source);
          } else {
            invalid.push(source);
            errors.push(`Source missing required identifier (URL, documentId, or title)`);
          }
        }
      } catch (error: any) {
        invalid.push(source);
        errors.push(`Error verifying source: ${error.message}`);
      }
    }

    return { valid, invalid, errors };
  }
}

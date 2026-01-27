/**
 * RAG Pipeline Validation Test Suite
 * Validates retrieval quality, answer quality, and citation accuracy
 */

import { RAGService, RAGOptions, RAGContext } from '../services/rag.service';
import { AIService, QuestionRequest, QuestionResponse, Source } from '../services/ai.service';
import { CitationValidatorService, CitationValidationResult, SourceInfo } from '../services/citation-validator.service';
import { CitationParserService } from '../services/citation-parser.service';
import { AnswerQualityService } from '../services/answer-quality.service';
import logger from '../config/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Test case with expected results
 */
export interface ValidationTestCase {
  id: string;
  query: string;
  category: 'factual' | 'conceptual' | 'procedural' | 'comparative' | 'analytical';
  expectedTopics: string[]; // Expected topics/keywords in answer
  expectedSources: {
    type: 'document' | 'web';
    minCount: number;
    keywords?: string[]; // Keywords that should appear in source content
  }[];
  expectedAnswerLength: {
    min: number;
    max?: number;
  };
  expectedCitations: {
    minCount: number;
    documentCitations?: number;
    webCitations?: number;
  };
  qualityCriteria: {
    accuracy: 'high' | 'medium' | 'low';
    completeness: 'high' | 'medium' | 'low';
    clarity: 'high' | 'medium' | 'low';
  };
  retrievalCriteria: {
    minRelevanceScore: number;
    minSourceCount: number;
    expectedDocumentCount?: number;
    expectedWebCount?: number;
  };
}

/**
 * Validation result for a test case
 */
export interface ValidationResult {
  testCaseId: string;
  query: string;
  passed: boolean;
  retrievalQuality: RetrievalQualityResult;
  answerQuality: AnswerQualityResult;
  citationAccuracy: CitationAccuracyResult;
  overallScore: number; // 0-100
  errors: string[];
  warnings: string[];
  timestamp: string;
}

/**
 * Retrieval quality result
 */
export interface RetrievalQualityResult {
  score: number; // 0-100
  sourceCount: number;
  documentCount: number;
  webCount: number;
  averageRelevanceScore: number;
  minRelevanceScore: number;
  maxRelevanceScore: number;
  passed: boolean;
  issues: string[];
}

/**
 * Answer quality result
 */
export interface AnswerQualityResult {
  score: number; // 0-100
  length: number;
  hasExpectedTopics: boolean;
  topicCoverage: number; // 0-100
  accuracyScore: number; // 0-100
  completenessScore: number; // 0-100
  clarityScore: number; // 0-100
  passed: boolean;
  issues: string[];
}

/**
 * Citation accuracy result
 */
export interface CitationAccuracyResult {
  score: number; // 0-100
  totalCitations: number;
  documentCitations: number;
  webCitations: number;
  validCitations: number;
  invalidCitations: number;
  missingSources: number;
  citationValidation: CitationValidationResult;
  passed: boolean;
  issues: string[];
}

/**
 * Validation test suite
 */
export class ValidationTestSuite {
  private static readonly VALIDATION_REPORTS_DIR = path.join(__dirname, 'validation-reports');

  /**
   * Default test cases
   */
  static getDefaultTestCases(): ValidationTestCase[] {
    return [
      {
        id: 'test-001',
        query: 'What is artificial intelligence?',
        category: 'factual',
        expectedTopics: ['artificial intelligence', 'AI', 'machine', 'intelligence'],
        expectedSources: [
          { type: 'document', minCount: 1 },
          { type: 'web', minCount: 1 },
        ],
        expectedAnswerLength: { min: 100, max: 2000 },
        expectedCitations: {
          minCount: 2,
          documentCitations: 1,
          webCitations: 1,
        },
        qualityCriteria: {
          accuracy: 'high',
          completeness: 'high',
          clarity: 'high',
        },
        retrievalCriteria: {
          minRelevanceScore: 0.7,
          minSourceCount: 2,
          expectedDocumentCount: 1,
          expectedWebCount: 1,
        },
      },
      {
        id: 'test-002',
        query: 'How does machine learning work?',
        category: 'conceptual',
        expectedTopics: ['machine learning', 'algorithm', 'data', 'training', 'model'],
        expectedSources: [
          { type: 'document', minCount: 1 },
          { type: 'web', minCount: 1 },
        ],
        expectedAnswerLength: { min: 150, max: 2000 },
        expectedCitations: {
          minCount: 2,
        },
        qualityCriteria: {
          accuracy: 'high',
          completeness: 'medium',
          clarity: 'high',
        },
        retrievalCriteria: {
          minRelevanceScore: 0.7,
          minSourceCount: 2,
        },
      },
      {
        id: 'test-003',
        query: 'What are the differences between supervised and unsupervised learning?',
        category: 'comparative',
        expectedTopics: ['supervised', 'unsupervised', 'learning', 'difference', 'comparison'],
        expectedSources: [
          { type: 'document', minCount: 1 },
          { type: 'web', minCount: 1 },
        ],
        expectedAnswerLength: { min: 200, max: 2500 },
        expectedCitations: {
          minCount: 2,
        },
        qualityCriteria: {
          accuracy: 'high',
          completeness: 'high',
          clarity: 'high',
        },
        retrievalCriteria: {
          minRelevanceScore: 0.7,
          minSourceCount: 2,
        },
      },
      {
        id: 'test-004',
        query: 'What is deep learning?',
        category: 'factual',
        expectedTopics: ['deep learning', 'neural network', 'deep', 'layers'],
        expectedSources: [
          { type: 'web', minCount: 1 },
        ],
        expectedAnswerLength: { min: 100, max: 2000 },
        expectedCitations: {
          minCount: 1,
          webCitations: 1,
        },
        qualityCriteria: {
          accuracy: 'high',
          completeness: 'medium',
          clarity: 'high',
        },
        retrievalCriteria: {
          minRelevanceScore: 0.7,
          minSourceCount: 1,
          expectedWebCount: 1,
        },
      },
      {
        id: 'test-005',
        query: 'Explain the steps to train a neural network',
        category: 'procedural',
        expectedTopics: ['neural network', 'train', 'training', 'steps', 'process'],
        expectedSources: [
          { type: 'document', minCount: 1 },
          { type: 'web', minCount: 1 },
        ],
        expectedAnswerLength: { min: 200, max: 2500 },
        expectedCitations: {
          minCount: 2,
        },
        qualityCriteria: {
          accuracy: 'high',
          completeness: 'high',
          clarity: 'high',
        },
        retrievalCriteria: {
          minRelevanceScore: 0.7,
          minSourceCount: 2,
        },
      },
    ];
  }

  /**
   * Validate retrieval quality
   */
  static validateRetrievalQuality(
    ragContext: RAGContext,
    testCase: ValidationTestCase
  ): RetrievalQualityResult {
    const issues: string[] = [];
    let score = 100;

    // Count sources
    const documentCount = ragContext.documentContexts.length;
    const webCount = ragContext.webSearchResults.length;
    const sourceCount = documentCount + webCount;

    // Check minimum source count
    if (sourceCount < testCase.retrievalCriteria.minSourceCount) {
      issues.push(`Insufficient sources: got ${sourceCount}, expected at least ${testCase.retrievalCriteria.minSourceCount}`);
      score -= 20;
    }

    // Check expected document count
    if (testCase.retrievalCriteria.expectedDocumentCount !== undefined) {
      if (documentCount < testCase.retrievalCriteria.expectedDocumentCount) {
        issues.push(`Insufficient document sources: got ${documentCount}, expected at least ${testCase.retrievalCriteria.expectedDocumentCount}`);
        score -= 15;
      }
    }

    // Check expected web count
    if (testCase.retrievalCriteria.expectedWebCount !== undefined) {
      if (webCount < testCase.retrievalCriteria.expectedWebCount) {
        issues.push(`Insufficient web sources: got ${webCount}, expected at least ${testCase.retrievalCriteria.expectedWebCount}`);
        score -= 15;
      }
    }

    // Calculate relevance scores
    const documentScores = ragContext.documentContexts.map(d => d.score);
    const webScores = ragContext.webSearchResults.map(w => (w as any).score || 0.5);
    const allScores = [...documentScores, ...webScores];

    if (allScores.length > 0) {
      const averageScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
      const minScore = Math.min(...allScores);
      const maxScore = Math.max(...allScores);

      // Check minimum relevance score
      if (minScore < testCase.retrievalCriteria.minRelevanceScore) {
        issues.push(`Low relevance score: min ${minScore.toFixed(2)}, expected at least ${testCase.retrievalCriteria.minRelevanceScore}`);
        score -= 10;
      }

      // Check if average score is reasonable
      if (averageScore < testCase.retrievalCriteria.minRelevanceScore) {
        issues.push(`Low average relevance score: ${averageScore.toFixed(2)}, expected at least ${testCase.retrievalCriteria.minRelevanceScore}`);
        score -= 10;
      }

      return {
        score: Math.max(0, score),
        sourceCount,
        documentCount,
        webCount,
        averageRelevanceScore: averageScore,
        minRelevanceScore: minScore,
        maxRelevanceScore: maxScore,
        passed: score >= 70,
        issues,
      };
    }

    return {
      score: 0,
      sourceCount,
      documentCount,
      webCount,
      averageRelevanceScore: 0,
      minRelevanceScore: 0,
      maxRelevanceScore: 0,
      passed: false,
      issues: ['No sources retrieved'],
    };
  }

  /**
   * Validate answer quality
   */
  static validateAnswerQuality(
    answer: string,
    testCase: ValidationTestCase
  ): AnswerQualityResult {
    const issues: string[] = [];
    let score = 100;

    // Check answer length
    const length = answer.length;
    if (length < testCase.expectedAnswerLength.min) {
      issues.push(`Answer too short: ${length} characters, expected at least ${testCase.expectedAnswerLength.min}`);
      score -= 15;
    }
    if (testCase.expectedAnswerLength.max && length > testCase.expectedAnswerLength.max) {
      issues.push(`Answer too long: ${length} characters, expected at most ${testCase.expectedAnswerLength.max}`);
      score -= 5;
    }

    // Check for expected topics
    const answerLower = answer.toLowerCase();
    const foundTopics = testCase.expectedTopics.filter(topic =>
      answerLower.includes(topic.toLowerCase())
    );
    const topicCoverage = (foundTopics.length / testCase.expectedTopics.length) * 100;

    if (topicCoverage < 50) {
      issues.push(`Low topic coverage: ${topicCoverage.toFixed(1)}%, expected at least 50%`);
      score -= 20;
    }

    const hasExpectedTopics = foundTopics.length > 0;

    // Calculate quality scores based on criteria
    let accuracyScore = 100;
    let completenessScore = 100;
    let clarityScore = 100;

    // Accuracy scoring (simplified - would need LLM evaluation in production)
    if (testCase.qualityCriteria.accuracy === 'high') {
      // Check for factual indicators
      if (!answerLower.includes('is') && !answerLower.includes('are') && !answerLower.includes('was')) {
        accuracyScore -= 10;
      }
    }

    // Completeness scoring
    if (testCase.qualityCriteria.completeness === 'high') {
      if (topicCoverage < 80) {
        completenessScore -= 20;
      }
    } else if (testCase.qualityCriteria.completeness === 'medium') {
      if (topicCoverage < 60) {
        completenessScore -= 15;
      }
    }

    // Clarity scoring (check for structure)
    const hasParagraphs = answer.includes('\n\n') || answer.split('.').length > 3;
    if (!hasParagraphs && testCase.qualityCriteria.clarity === 'high') {
      clarityScore -= 10;
      issues.push('Answer lacks clear structure');
    }

    // Check for common quality issues
    if (answer.length < 50) {
      issues.push('Answer is too brief');
      score -= 10;
    }

    if (!answer.trim()) {
      issues.push('Answer is empty');
      score = 0;
    }

    return {
      score: Math.max(0, score),
      length,
      hasExpectedTopics,
      topicCoverage,
      accuracyScore,
      completenessScore,
      clarityScore,
      passed: score >= 70 && topicCoverage >= 50,
      issues,
    };
  }

  /**
   * Validate citation accuracy
   */
  static validateCitationAccuracy(
    response: QuestionResponse,
    testCase: ValidationTestCase
  ): CitationAccuracyResult {
    const issues: string[] = [];
    let score = 100;

    const citations = response.citations;
    if (!citations) {
      return {
        score: 0,
        totalCitations: 0,
        documentCitations: 0,
        webCitations: 0,
        validCitations: 0,
        invalidCitations: 0,
        missingSources: 0,
        citationValidation: {
          isValid: false,
          errors: ['No citations found'],
          warnings: [],
          suggestions: [],
          matchedCitations: 0,
          unmatchedCitations: 0,
          missingSources: [],
          invalidUrls: [],
          invalidDocumentIds: [],
        },
        passed: false,
        issues: ['No citations in response'],
      };
    }

    const totalCitations = citations.total || 0;
    const documentCitations = citations.document || 0;
    const webCitations = citations.web || 0;

    // Check minimum citation count
    if (totalCitations < testCase.expectedCitations.minCount) {
      issues.push(`Insufficient citations: got ${totalCitations}, expected at least ${testCase.expectedCitations.minCount}`);
      score -= 20;
    }

    // Check document citation count
    if (testCase.expectedCitations.documentCitations !== undefined) {
      if (documentCitations < testCase.expectedCitations.documentCitations) {
        issues.push(`Insufficient document citations: got ${documentCitations}, expected at least ${testCase.expectedCitations.documentCitations}`);
        score -= 15;
      }
    }

    // Check web citation count
    if (testCase.expectedCitations.webCitations !== undefined) {
      if (webCitations < testCase.expectedCitations.webCitations) {
        issues.push(`Insufficient web citations: got ${webCitations}, expected at least ${testCase.expectedCitations.webCitations}`);
        score -= 15;
      }
    }

    // Validate citations using CitationValidatorService
    // First validate citation format
    const formatValidation = CitationValidatorService.validateCitationFormat(response.answer);
    
    // Parse citations from answer
    const parsedCitations = CitationParserService.parseCitations(response.answer);
    
    // Then validate against sources
    let citationValidation: CitationValidationResult = formatValidation;
    if (parsedCitations.citations.length > 0 && response.sources && response.sources.length > 0) {
      // Convert sources to SourceInfo format
      const sourceInfos: SourceInfo[] = response.sources.map((source, index) => ({
        type: source.type,
        index: index + 1,
        title: source.title,
        url: source.url,
        documentId: source.documentId,
        id: source.documentId || source.url,
      }));
      
      citationValidation = CitationValidatorService.validateCitationsAgainstSources(
        parsedCitations.citations,
        sourceInfos
      );
    }

    const validCitations = citationValidation.matchedCitations;
    const invalidCitations = citationValidation.unmatchedCitations;
    const missingSources = citationValidation.missingSources.length;

    if (!citationValidation.isValid) {
      issues.push(...citationValidation.errors);
      score -= citationValidation.errors.length * 5;
    }

    if (citationValidation.warnings.length > 0) {
      issues.push(...citationValidation.warnings);
      score -= citationValidation.warnings.length * 2;
    }

    if (missingSources > 0) {
      issues.push(`${missingSources} citations reference missing sources`);
      score -= missingSources * 10;
    }

    if (invalidCitations > 0) {
      issues.push(`${invalidCitations} invalid citations found`);
      score -= invalidCitations * 10;
    }

    return {
      score: Math.max(0, score),
      totalCitations,
      documentCitations,
      webCitations,
      validCitations,
      invalidCitations,
      missingSources,
      citationValidation,
      passed: score >= 70 && citationValidation.isValid,
      issues,
    };
  }

  /**
   * Run validation test case
   */
  static async runValidationTest(
    testCase: ValidationTestCase,
    userId: string,
    options?: Partial<RAGOptions>
  ): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      // Step 1: Retrieve context
      const ragOptions: RAGOptions = {
        userId,
        enableDocumentSearch: true,
        enableWebSearch: true,
        maxDocumentChunks: 5,
        maxWebResults: 5,
        ...options,
      };

      const ragContext = await RAGService.retrieveContext(testCase.query, ragOptions);

      // Step 2: Generate answer
      const questionRequest: QuestionRequest = {
        question: testCase.query,
        enableDocumentSearch: true,
        enableWebSearch: true,
        enableCitationParsing: true,
        ...options,
      };

      const response = await AIService.answerQuestion(questionRequest);

      // Step 3: Validate
      const retrievalQuality = this.validateRetrievalQuality(ragContext, testCase);
      const answerQuality = this.validateAnswerQuality(response.answer, testCase);
      const citationAccuracy = this.validateCitationAccuracy(response, testCase);

      // Calculate overall score (weighted average)
      const overallScore =
        retrievalQuality.score * 0.3 +
        answerQuality.score * 0.4 +
        citationAccuracy.score * 0.3;

      const passed = overallScore >= 70 && retrievalQuality.passed && answerQuality.passed && citationAccuracy.passed;

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!retrievalQuality.passed) {
        errors.push(...retrievalQuality.issues);
      } else {
        warnings.push(...retrievalQuality.issues);
      }

      if (!answerQuality.passed) {
        errors.push(...answerQuality.issues);
      } else {
        warnings.push(...answerQuality.issues);
      }

      if (!citationAccuracy.passed) {
        errors.push(...citationAccuracy.issues);
      } else {
        warnings.push(...citationAccuracy.issues);
      }

      return {
        testCaseId: testCase.id,
        query: testCase.query,
        passed,
        retrievalQuality,
        answerQuality,
        citationAccuracy,
        overallScore: Math.round(overallScore),
        errors,
        warnings,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('Validation test failed', {
        testCaseId: testCase.id,
        error: error.message,
      });

      return {
        testCaseId: testCase.id,
        query: testCase.query,
        passed: false,
        retrievalQuality: {
          score: 0,
          sourceCount: 0,
          documentCount: 0,
          webCount: 0,
          averageRelevanceScore: 0,
          minRelevanceScore: 0,
          maxRelevanceScore: 0,
          passed: false,
          issues: [`Error: ${error.message}`],
        },
        answerQuality: {
          score: 0,
          length: 0,
          hasExpectedTopics: false,
          topicCoverage: 0,
          accuracyScore: 0,
          completenessScore: 0,
          clarityScore: 0,
          passed: false,
          issues: [`Error: ${error.message}`],
        },
        citationAccuracy: {
          score: 0,
          totalCitations: 0,
          documentCitations: 0,
          webCitations: 0,
          validCitations: 0,
          invalidCitations: 0,
          missingSources: 0,
          citationValidation: {
            isValid: false,
            errors: [`Error: ${error.message}`],
            warnings: [],
            suggestions: [],
            matchedCitations: 0,
            unmatchedCitations: 0,
            missingSources: [],
            invalidUrls: [],
            invalidDocumentIds: [],
          },
          passed: false,
          issues: [`Error: ${error.message}`],
        },
        overallScore: 0,
        errors: [`Test execution failed: ${error.message}`],
        warnings: [],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Run all validation tests
   */
  static async runAllTests(
    userId: string,
    testCases?: ValidationTestCase[],
    options?: Partial<RAGOptions>
  ): Promise<ValidationResult[]> {
    const cases = testCases || this.getDefaultTestCases();
    const results: ValidationResult[] = [];

    logger.info(`Running ${cases.length} validation tests`);

    for (const testCase of cases) {
      logger.info(`Running test case: ${testCase.id} - ${testCase.query}`);
      const result = await this.runValidationTest(testCase, userId, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Generate validation report
   */
  static generateReport(results: ValidationResult[]): string {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const averageScore = results.reduce((sum, r) => sum + r.overallScore, 0) / totalTests;

    let report = '# RAG Pipeline Validation Report\n\n';
    report += `**Generated**: ${new Date().toISOString()}\n\n`;
    report += `## Summary\n\n`;
    report += `- **Total Tests**: ${totalTests}\n`;
    report += `- **Passed**: ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)\n`;
    report += `- **Failed**: ${failedTests} (${((failedTests / totalTests) * 100).toFixed(1)}%)\n`;
    report += `- **Average Score**: ${averageScore.toFixed(1)}/100\n\n`;

    report += `## Test Results\n\n`;

    for (const result of results) {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      report += `### ${result.testCaseId}: ${result.query}\n\n`;
      report += `**Status**: ${status} | **Score**: ${result.overallScore}/100\n\n`;

      // Retrieval Quality
      report += `#### Retrieval Quality: ${result.retrievalQuality.score}/100\n`;
      report += `- Sources: ${result.retrievalQuality.sourceCount} (Documents: ${result.retrievalQuality.documentCount}, Web: ${result.retrievalQuality.webCount})\n`;
      report += `- Average Relevance: ${result.retrievalQuality.averageRelevanceScore.toFixed(2)}\n`;
      report += `- Min Relevance: ${result.retrievalQuality.minRelevanceScore.toFixed(2)}\n`;
      if (result.retrievalQuality.issues.length > 0) {
        report += `- Issues: ${result.retrievalQuality.issues.join(', ')}\n`;
      }
      report += `\n`;

      // Answer Quality
      report += `#### Answer Quality: ${result.answerQuality.score}/100\n`;
      report += `- Length: ${result.answerQuality.length} characters\n`;
      report += `- Topic Coverage: ${result.answerQuality.topicCoverage.toFixed(1)}%\n`;
      report += `- Accuracy: ${result.answerQuality.accuracyScore}/100\n`;
      report += `- Completeness: ${result.answerQuality.completenessScore}/100\n`;
      report += `- Clarity: ${result.answerQuality.clarityScore}/100\n`;
      if (result.answerQuality.issues.length > 0) {
        report += `- Issues: ${result.answerQuality.issues.join(', ')}\n`;
      }
      report += `\n`;

      // Citation Accuracy
      report += `#### Citation Accuracy: ${result.citationAccuracy.score}/100\n`;
      report += `- Total Citations: ${result.citationAccuracy.totalCitations}\n`;
      report += `- Document Citations: ${result.citationAccuracy.documentCitations}\n`;
      report += `- Web Citations: ${result.citationAccuracy.webCitations}\n`;
      report += `- Valid Citations: ${result.citationAccuracy.validCitations}\n`;
      report += `- Invalid Citations: ${result.citationAccuracy.invalidCitations}\n`;
      report += `- Missing Sources: ${result.citationAccuracy.missingSources}\n`;
      if (result.citationAccuracy.issues.length > 0) {
        report += `- Issues: ${result.citationAccuracy.issues.join(', ')}\n`;
      }
      report += `\n`;

      // Errors and Warnings
      if (result.errors.length > 0) {
        report += `#### Errors\n`;
        result.errors.forEach(error => {
          report += `- ${error}\n`;
        });
        report += `\n`;
      }

      if (result.warnings.length > 0) {
        report += `#### Warnings\n`;
        result.warnings.forEach(warning => {
          report += `- ${warning}\n`;
        });
        report += `\n`;
      }

      report += `---\n\n`;
    }

    // Overall Statistics
    report += `## Overall Statistics\n\n`;

    const avgRetrievalScore = results.reduce((sum, r) => sum + r.retrievalQuality.score, 0) / totalTests;
    const avgAnswerScore = results.reduce((sum, r) => sum + r.answerQuality.score, 0) / totalTests;
    const avgCitationScore = results.reduce((sum, r) => sum + r.citationAccuracy.score, 0) / totalTests;

    report += `- **Average Retrieval Quality**: ${avgRetrievalScore.toFixed(1)}/100\n`;
    report += `- **Average Answer Quality**: ${avgAnswerScore.toFixed(1)}/100\n`;
    report += `- **Average Citation Accuracy**: ${avgCitationScore.toFixed(1)}/100\n\n`;

    // Quality Targets
    report += `## Quality Targets\n\n`;
    report += `| Metric | Target | Average | Status |\n`;
    report += `|--------|--------|---------|--------|\n`;
    report += `| Overall Score | ≥ 70 | ${averageScore.toFixed(1)} | ${averageScore >= 70 ? '✅' : '❌'} |\n`;
    report += `| Retrieval Quality | ≥ 70 | ${avgRetrievalScore.toFixed(1)} | ${avgRetrievalScore >= 70 ? '✅' : '❌'} |\n`;
    report += `| Answer Quality | ≥ 70 | ${avgAnswerScore.toFixed(1)} | ${avgAnswerScore >= 70 ? '✅' : '❌'} |\n`;
    report += `| Citation Accuracy | ≥ 70 | ${avgCitationScore.toFixed(1)} | ${avgCitationScore >= 70 ? '✅' : '❌'} |\n`;

    return report;
  }

  /**
   * Save validation report to file
   */
  static async saveReport(results: ValidationResult[], filename?: string): Promise<string> {
    // Ensure reports directory exists
    if (!fs.existsSync(this.VALIDATION_REPORTS_DIR)) {
      fs.mkdirSync(this.VALIDATION_REPORTS_DIR, { recursive: true });
    }

    const report = this.generateReport(results);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFilename = filename || `validation-report-${timestamp}.md`;
    const reportPath = path.join(this.VALIDATION_REPORTS_DIR, reportFilename);

    fs.writeFileSync(reportPath, report, 'utf-8');

    logger.info(`Validation report saved to: ${reportPath}`);

    return reportPath;
  }

  /**
   * Run validation suite and generate report
   */
  static async runSuiteAndGenerateReport(
    userId: string,
    testCases?: ValidationTestCase[],
    options?: Partial<RAGOptions>
  ): Promise<{ results: ValidationResult[]; reportPath: string }> {
    const results = await this.runAllTests(userId, testCases, options);
    const reportPath = await this.saveReport(results);

    return { results, reportPath };
  }
}

/**
 * A/B Testing Service Tests
 */

import { ABTestingService, ABTest, ABTestVariant, ABTestResult, ABTestAnalysis } from '../services/ab-testing.service';
import { supabaseAdmin } from '../config/database';

// Mock database
jest.mock('../config/database', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

describe('ABTestingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Test Management', () => {
    it('should create a new A/B test', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'test-1',
              name: 'Reranking Test',
              description: 'Test new reranking algorithm',
              feature: 'reranking',
              variant_a: { id: 'A', name: 'Old', config: {} },
              variant_b: { id: 'B', name: 'New', config: {} },
              status: 'draft',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
            error: null,
          }),
        }),
      });

      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      const variantA: ABTestVariant = {
        id: 'A',
        name: 'Old Reranking',
        description: 'Current reranking algorithm',
        config: {},
      };

      const variantB: ABTestVariant = {
        id: 'B',
        name: 'New Reranking',
        description: 'Improved reranking algorithm',
        config: { threshold: 0.8 },
      };

      const test: Omit<ABTest, 'createdAt' | 'updatedAt'> = {
        id: 'test-1',
        name: 'Reranking Test',
        description: 'Test new reranking algorithm',
        feature: 'reranking',
        variantA,
        variantB,
        status: 'draft',
      };

      const result = await ABTestingService.createTest(test);

      expect(result).toBeDefined();
      expect(result.id).toBe('test-1');
      expect(result.name).toBe('Reranking Test');
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should get A/B test by ID', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'test-1',
              name: 'Reranking Test',
              status: 'active',
            },
            error: null,
          }),
        }),
      });

      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      const result = await ABTestingService.getTest('test-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('test-1');
    });

    it('should get active A/B tests', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: [
            { id: 'test-1', status: 'active' },
            { id: 'test-2', status: 'active' },
          ],
          error: null,
        }),
      });

      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      const results = await ABTestingService.getActiveTests();

      expect(results.length).toBe(2);
    });
  });

  describe('Variant Assignment', () => {
    it('should assign variant consistently', async () => {
      // Mock getAssignment to return null (no existing assignment)
      jest.spyOn(ABTestingService, 'getAssignment').mockResolvedValue(null);

      // Mock getTest
      jest.spyOn(ABTestingService, 'getTest').mockResolvedValue({
        id: 'test-1',
        name: 'Test',
        description: 'Test',
        feature: 'reranking',
        variantA: { id: 'A', name: 'A', description: 'A', config: {}, weight: 0.5 },
        variantB: { id: 'B', name: 'B', description: 'B', config: {}, weight: 0.5 },
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      });

      // Mock saveAssignment
      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      const variant1 = await ABTestingService.assignVariant('test-1', 'user-1', 'query-1');
      const variant2 = await ABTestingService.assignVariant('test-1', 'user-1', 'query-1');

      // Should return same variant for same user/query
      expect(variant1).toBe(variant2);
      expect(['A', 'B']).toContain(variant1);
    });

    it('should return existing assignment if present', async () => {
      jest.spyOn(ABTestingService, 'getAssignment').mockResolvedValue({
        testId: 'test-1',
        userId: 'user-1',
        queryId: 'query-1',
        variant: 'B',
        assignedAt: '2024-01-01T00:00:00Z',
      });

      const variant = await ABTestingService.assignVariant('test-1', 'user-1', 'query-1');

      expect(variant).toBe('B');
    });
  });

  describe('Result Recording', () => {
    it('should record test result', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      const result: ABTestResult = {
        testId: 'test-1',
        queryId: 'query-1',
        userId: 'user-1',
        variant: 'A',
        metrics: {
          precision: 0.85,
          recall: 0.80,
          f1Score: 0.82,
          responseTime: 1200,
          answerQuality: 85,
        },
        timestamp: new Date().toISOString(),
      };

      await ABTestingService.recordResult(result);

      expect(mockInsert).toHaveBeenCalled();
    });

    it('should get test results', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [
              {
                test_id: 'test-1',
                query_id: 'query-1',
                user_id: 'user-1',
                variant: 'A',
                metrics: { precision: 0.85 },
                timestamp: '2024-01-01T00:00:00Z',
              },
            ],
            error: null,
          }),
        }),
      });

      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      const results = await ABTestingService.getTestResults('test-1');

      expect(results.length).toBe(1);
      expect(results[0].testId).toBe('test-1');
      expect(results[0].variant).toBe('A');
    });
  });

  describe('Analysis', () => {
    it('should analyze test results', async () => {
      jest.spyOn(ABTestingService, 'getTest').mockResolvedValue({
        id: 'test-1',
        name: 'Test',
        description: 'Test',
        feature: 'reranking',
        variantA: { id: 'A', name: 'A', description: 'A', config: {} },
        variantB: { id: 'B', name: 'B', description: 'B', config: {} },
        status: 'active',
        significanceLevel: 0.05,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      });

      jest.spyOn(ABTestingService, 'getTestResults').mockImplementation(async (testId, variant) => {
        if (variant === 'A') {
          return [
            {
              testId: 'test-1',
              queryId: 'q1',
              userId: 'u1',
              variant: 'A',
              metrics: { precision: 0.8, recall: 0.75, f1Score: 0.77, mrr: 0.7, responseTime: 1000, answerQuality: 80, citationAccuracy: 85, relevanceScore: 0.8, userRating: 4 },
              timestamp: '2024-01-01T00:00:00Z',
            },
            {
              testId: 'test-1',
              queryId: 'q2',
              userId: 'u2',
              variant: 'A',
              metrics: { precision: 0.82, recall: 0.78, f1Score: 0.80, mrr: 0.72, responseTime: 1100, answerQuality: 82, citationAccuracy: 87, relevanceScore: 0.82, userRating: 4 },
              timestamp: '2024-01-01T00:00:00Z',
            },
          ];
        } else {
          return [
            {
              testId: 'test-1',
              queryId: 'q3',
              userId: 'u3',
              variant: 'B',
              metrics: { precision: 0.85, recall: 0.82, f1Score: 0.83, mrr: 0.75, responseTime: 900, answerQuality: 88, citationAccuracy: 90, relevanceScore: 0.85, userRating: 5 },
              timestamp: '2024-01-01T00:00:00Z',
            },
            {
              testId: 'test-1',
              queryId: 'q4',
              userId: 'u4',
              variant: 'B',
              metrics: { precision: 0.87, recall: 0.84, f1Score: 0.85, mrr: 0.77, responseTime: 950, answerQuality: 90, citationAccuracy: 92, relevanceScore: 0.87, userRating: 5 },
              timestamp: '2024-01-01T00:00:00Z',
            },
          ];
        }
      });

      const analysis = await ABTestingService.analyzeTest('test-1');

      expect(analysis).toBeDefined();
      expect(analysis?.variantA.sampleSize).toBe(2);
      expect(analysis?.variantB.sampleSize).toBe(2);
      expect(analysis?.comparison.improvement.precision).toBeGreaterThan(0);
      expect(analysis?.comparison.winner).toBeDefined();
    });

    it('should generate analysis report', () => {
      const test: ABTest = {
        id: 'test-1',
        name: 'Reranking Test',
        description: 'Test',
        feature: 'reranking',
        variantA: { id: 'A', name: 'Old', description: 'Old', config: {} },
        variantB: { id: 'B', name: 'New', description: 'New', config: {} },
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const analysis: ABTestAnalysis = {
        testId: 'test-1',
        variantA: {
          sampleSize: 10,
          metrics: {
            averagePrecision: 0.8,
            averageRecall: 0.75,
            averageF1Score: 0.77,
            averageMRR: 0.7,
            averageResponseTime: 1000,
            averageAnswerQuality: 80,
            averageCitationAccuracy: 85,
            averageRelevanceScore: 0.8,
            averageUserRating: 4,
          },
        },
        variantB: {
          sampleSize: 10,
          metrics: {
            averagePrecision: 0.85,
            averageRecall: 0.82,
            averageF1Score: 0.83,
            averageMRR: 0.75,
            averageResponseTime: 900,
            averageAnswerQuality: 88,
            averageCitationAccuracy: 90,
            averageRelevanceScore: 0.85,
            averageUserRating: 4.5,
          },
        },
        comparison: {
          improvement: {
            precision: 6.25,
            recall: 9.33,
            f1Score: 7.79,
            mrr: 7.14,
            responseTime: 10,
            answerQuality: 10,
            citationAccuracy: 5.88,
            relevanceScore: 6.25,
            userRating: 12.5,
          },
          statisticalSignificance: {
            precision: true,
            recall: true,
            f1Score: true,
            responseTime: true,
            answerQuality: true,
            citationAccuracy: false,
            relevanceScore: true,
            userRating: true,
          },
          pValues: {
            precision: 0.03,
            recall: 0.02,
            f1Score: 0.025,
            responseTime: 0.01,
            answerQuality: 0.02,
            citationAccuracy: 0.1,
            relevanceScore: 0.03,
            userRating: 0.015,
          },
          winner: 'B',
          confidence: 0.89,
        },
        recommendations: ['Variant B shows significant improvements.'],
        generatedAt: new Date().toISOString(),
      };

      const report = ABTestingService.generateAnalysisReport(analysis, test);

      expect(report).toContain('A/B Test Analysis Report');
      expect(report).toContain('Reranking Test');
      expect(report).toContain('Metrics Comparison');
      expect(report).toContain('Recommendations');
    });
  });

  describe('Utility Functions', () => {
    it('should update test status', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      await ABTestingService.updateTestStatus('test-1', 'active');

      expect(mockUpdate).toHaveBeenCalled();
    });
  });
});

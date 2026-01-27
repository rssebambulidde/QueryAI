import { DatabaseService } from '../services/database.service';
import { supabaseAdmin } from '../config/database';

jest.mock('../config/database');

describe('DatabaseService', () => {
  const mockSupabase = {
    from: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (supabaseAdmin as any) = mockSupabase;
  });

  describe('createUserProfile', () => {
    it('should create user profile successfully', async () => {
      const mockData = {
        id: 'user-1',
        email: 'test@example.com',
        full_name: 'Test User',
      };

      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await DatabaseService.createUserProfile('user-1', 'test@example.com', 'Test User');

      expect(result).toEqual(mockData);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles');
      expect(mockQuery.insert).toHaveBeenCalledWith({
        id: 'user-1',
        email: 'test@example.com',
        full_name: 'Test User',
      });
    });

    it('should return null on error', async () => {
      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await DatabaseService.createUserProfile('user-1', 'test@example.com');

      expect(result).toBeNull();
    });
  });

  describe('getUserProfile', () => {
    it('should get user profile successfully', async () => {
      const mockData = {
        id: 'user-1',
        email: 'test@example.com',
        full_name: 'Test User',
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await DatabaseService.getUserProfile('user-1');

      expect(result).toEqual(mockData);
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'user-1');
    });

    it('should return null if user not found', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await DatabaseService.getUserProfile('user-1');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await DatabaseService.getUserProfile('user-1');

      expect(result).toBeNull();
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile successfully', async () => {
      const mockData = {
        id: 'user-1',
        email: 'updated@example.com',
        full_name: 'Updated User',
      };

      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await DatabaseService.updateUserProfile('user-1', {
        email: 'updated@example.com',
      });

      expect(result).toEqual(mockData);
      expect(mockQuery.update).toHaveBeenCalledWith({ email: 'updated@example.com' });
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'user-1');
    });

    it('should return null on error', async () => {
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await DatabaseService.updateUserProfile('user-1', {});

      expect(result).toBeNull();
    });
  });

  describe('getUserSubscription', () => {
    it('should get user subscription successfully', async () => {
      const mockData = {
        id: 'sub-1',
        user_id: 'user-1',
        tier: 'premium',
        status: 'active',
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await DatabaseService.getUserSubscription('user-1');

      expect(result).toEqual(mockData);
    });

    it('should create default subscription if not found', async () => {
      const mockGetQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      const mockCreateQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'sub-1', tier: 'free' },
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockGetQuery)
        .mockReturnValueOnce(mockCreateQuery);

      const result = await DatabaseService.getUserSubscription('user-1');

      expect(result).toBeDefined();
      expect(mockCreateQuery.insert).toHaveBeenCalled();
    });
  });

  describe('logUsage', () => {
    it('should log usage successfully', async () => {
      const mockQuery = {
        insert: jest.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await DatabaseService.logUsage('user-1', 'query', {
        query: 'test query',
      });

      expect(result).toBe(true);
      expect(mockQuery.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        type: 'query',
        metadata: { query: 'test query' },
      });
    });

    it('should return false on error', async () => {
      const mockQuery = {
        insert: jest.fn().mockResolvedValue({
          error: { message: 'Database error' },
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await DatabaseService.logUsage('user-1', 'query');

      expect(result).toBe(false);
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription successfully', async () => {
      const mockData = {
        id: 'sub-1',
        tier: 'pro',
        status: 'active',
      };

      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await DatabaseService.updateSubscription('user-1', {
        tier: 'pro',
      });

      expect(result).toEqual(mockData);
    });

    it('should return null on error', async () => {
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await DatabaseService.updateSubscription('user-1', {});

      expect(result).toBeNull();
    });
  });

  describe('getUserUsageCount', () => {
    it('should get usage count successfully', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
      };

      (mockQuery.select as jest.Mock).mockResolvedValue({ count: 10, error: null });

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await DatabaseService.getUserUsageCount('user-1', 'query');

      expect(result).toBe(10);
    });

    it('should return 0 on error', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      (mockQuery.select as jest.Mock).mockResolvedValue({
        count: null,
        error: { message: 'Database error' },
      });

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await DatabaseService.getUserUsageCount('user-1', 'query');

      expect(result).toBe(0);
    });

    it('should filter by date range', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
      };

      (mockQuery.select as jest.Mock).mockResolvedValue({ count: 5, error: null });

      mockSupabase.from.mockReturnValue(mockQuery);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      await DatabaseService.getUserUsageCount('user-1', 'query', startDate, endDate);

      expect(mockQuery.gte).toHaveBeenCalledWith('created_at', startDate.toISOString());
      expect(mockQuery.lte).toHaveBeenCalledWith('created_at', endDate.toISOString());
    });
  });

  describe('createPayment', () => {
    it('should create payment successfully', async () => {
      const mockPayment = {
        id: 'pay-1',
        user_id: 'user-1',
        amount: 100,
        currency: 'USD',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockPayment, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await DatabaseService.createPayment({
        user_id: 'user-1',
        amount: 100,
        currency: 'USD',
        status: 'pending',
      } as any);

      expect(result).toBeDefined();
      expect(mockQuery.insert).toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      await expect(
        DatabaseService.createPayment({
          user_id: 'user-1',
          amount: 100,
        } as any)
      ).rejects.toThrow();
    });
  });

  describe('getPaymentById', () => {
    it('should get payment successfully', async () => {
      const mockPayment = {
        id: 'pay-1',
        user_id: 'user-1',
        amount: 100,
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockPayment, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await DatabaseService.getPaymentById('pay-1');

      expect(result).toEqual(mockPayment);
    });

    it('should return null if payment not found', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await DatabaseService.getPaymentById('pay-1');

      expect(result).toBeNull();
    });
  });
});

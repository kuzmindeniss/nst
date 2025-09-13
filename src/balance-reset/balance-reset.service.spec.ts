import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { BalanceResetService } from './balance-reset.service';

describe('BalanceResetService', () => {
  let service: BalanceResetService;
  let mockQueue: any;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn(),
      close: jest.fn(),
      getJob: jest.fn(),
      getJobs: jest.fn(),
      clean: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceResetService,
        {
          provide: getQueueToken('reset-balance'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<BalanceResetService>(BalanceResetService);
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resetAllBalances', () => {
    it('should successfully add job to queue and return response', async () => {
      const mockJob = {
        id: '123',
        data: {},
        opts: {},
        name: 'reset-all-balances',
      };
      mockQueue.add.mockResolvedValue(mockJob);

      const result = await service.resetAllBalances();

      expect(result).toEqual({
        message: 'Reset balances job has been queued successfully',
        jobId: '123',
      });
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith('reset-all-balances', {});
      expect(loggerSpy).toHaveBeenCalledWith(
        'Adding reset balances job to queue...',
      );
    });

    it('should return undefined jobId when job creation returns null', async () => {
      mockQueue.add.mockResolvedValue(null);

      const result = await service.resetAllBalances();

      expect(result).toEqual({
        message: 'Reset balances job has been queued successfully',
        jobId: undefined,
      });
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
    });

    it('should return undefined jobId when job has no id', async () => {
      const mockJob = {
        data: {},
        opts: {},
        name: 'reset-all-balances',
      };
      mockQueue.add.mockResolvedValue(mockJob);

      const result = await service.resetAllBalances();

      expect(result).toEqual({
        message: 'Reset balances job has been queued successfully',
        jobId: undefined,
      });
    });

    it('should convert numeric job id to string', async () => {
      const mockJob = {
        id: 456,
        data: {},
        opts: {},
        name: 'reset-all-balances',
      };
      mockQueue.add.mockResolvedValue(mockJob);

      const result = await service.resetAllBalances();

      expect(result).toEqual({
        message: 'Reset balances job has been queued successfully',
        jobId: '456',
      });
    });

    it('should handle queue connection errors', async () => {
      const connectionError = new Error('Redis connection failed');
      mockQueue.add.mockRejectedValue(connectionError);

      await expect(service.resetAllBalances()).rejects.toThrow(
        'Redis connection failed',
      );
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(loggerSpy).toHaveBeenCalledWith(
        'Adding reset balances job to queue...',
      );
    });

    it('should handle queue timeout errors', async () => {
      const timeoutError = new Error('Queue operation timeout');
      timeoutError.name = 'TimeoutError';
      mockQueue.add.mockRejectedValue(timeoutError);

      await expect(service.resetAllBalances()).rejects.toThrow(
        'Queue operation timeout',
      );
    });

    it('should handle queue full errors', async () => {
      const queueFullError = new Error('Queue is full');
      queueFullError.name = 'QueueFullError';
      mockQueue.add.mockRejectedValue(queueFullError);

      await expect(service.resetAllBalances()).rejects.toThrow('Queue is full');
    });

    it('should handle generic queue errors', async () => {
      const genericError = new Error('Unknown queue error');
      mockQueue.add.mockRejectedValue(genericError);

      await expect(service.resetAllBalances()).rejects.toThrow(
        'Unknown queue error',
      );
    });
  });

  describe('Logger Integration', () => {
    it('should log when adding job to queue', async () => {
      const mockJob = { id: '789' };
      mockQueue.add.mockResolvedValue(mockJob);
      loggerSpy.mockClear(); // Clear previous calls

      await service.resetAllBalances();

      expect(loggerSpy).toHaveBeenCalledWith(
        'Adding reset balances job to queue...',
      );
      expect(loggerSpy).toHaveBeenCalledTimes(1);
    });

    it('should log even when queue operation fails', async () => {
      mockQueue.add.mockRejectedValue(new Error('Queue error'));
      loggerSpy.mockClear(); // Clear previous calls

      try {
        await service.resetAllBalances();
      } catch {
        // Expected to throw
      }

      expect(loggerSpy).toHaveBeenCalledWith(
        'Adding reset balances job to queue...',
      );
      expect(loggerSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Queue Integration', () => {
    it('should use correct queue name', () => {
      expect(service).toBeDefined();
      // Queue injection is verified through constructor and DI
    });

    it('should call queue.add with correct parameters', async () => {
      const mockJob = { id: 'test-id' };
      mockQueue.add.mockResolvedValue(mockJob);

      await service.resetAllBalances();

      expect(mockQueue.add).toHaveBeenCalledWith('reset-all-balances', {});
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple concurrent calls', async () => {
      const mockJob1 = { id: 'job-1' };
      const mockJob2 = { id: 'job-2' };
      mockQueue.add
        .mockResolvedValueOnce(mockJob1)
        .mockResolvedValueOnce(mockJob2);

      const [result1, result2] = await Promise.all([
        service.resetAllBalances(),
        service.resetAllBalances(),
      ]);

      expect(result1.jobId).toBe('job-1');
      expect(result2.jobId).toBe('job-2');
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
    });
  });

  describe('Return Value Consistency', () => {
    it('should always return consistent message', async () => {
      const testCases = [
        { id: '1' },
        { id: 2 },
        null,
        undefined,
        { id: 'string-id' },
      ];

      for (const mockJob of testCases) {
        mockQueue.add.mockResolvedValueOnce(mockJob);
        const result = await service.resetAllBalances();
        expect(result.message).toBe(
          'Reset balances job has been queued successfully',
        );
      }
    });

    it('should return proper type structure', async () => {
      mockQueue.add.mockResolvedValue({ id: 'test' });

      const result = await service.resetAllBalances();

      expect(typeof result).toBe('object');
      expect(typeof result.message).toBe('string');
      expect(
        typeof result.jobId === 'string' || result.jobId === undefined,
      ).toBe(true);
      expect(Object.keys(result)).toEqual(['message', 'jobId']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle job with empty string id', async () => {
      const mockJob = { id: '' };
      mockQueue.add.mockResolvedValue(mockJob);

      const result = await service.resetAllBalances();

      expect(result.jobId).toBe('');
    });

    it('should handle job with zero id', async () => {
      const mockJob = { id: 0 };
      mockQueue.add.mockResolvedValue(mockJob);

      const result = await service.resetAllBalances();

      expect(result.jobId).toBe('0');
    });

    it('should handle job with boolean id', async () => {
      const mockJob = { id: true };
      mockQueue.add.mockResolvedValue(mockJob);

      const result = await service.resetAllBalances();

      expect(result.jobId).toBe('true');
    });

    it('should handle malformed job object', async () => {
      const mockJob = { notAnId: 'value' };
      mockQueue.add.mockResolvedValue(mockJob);

      const result = await service.resetAllBalances();

      expect(result.jobId).toBeUndefined();
    });
  });

  describe('Error Recovery', () => {
    it('should not suppress errors from queue', async () => {
      const originalError = new Error('Critical queue failure');
      mockQueue.add.mockRejectedValue(originalError);

      await expect(service.resetAllBalances()).rejects.toBe(originalError);
    });

    it('should maintain error properties', async () => {
      const customError = new Error('Custom error message');
      customError.name = 'CustomError';
      customError.stack = 'custom stack trace';
      mockQueue.add.mockRejectedValue(customError);

      try {
        await service.resetAllBalances();
        fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toBe('Custom error message');
        expect(error.name).toBe('CustomError');
        expect(error.stack).toBe('custom stack trace');
      }
    });
  });
});

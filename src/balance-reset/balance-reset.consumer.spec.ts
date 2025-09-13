import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { BalanceResetConsumer } from './balance-reset.consumer';
import { User } from '../users/user.entity';

describe('BalanceResetConsumer', () => {
  let consumer: BalanceResetConsumer;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  let loggerLogSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    const mockQueryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 5 }),
    } as any;

    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      },
    } as any;

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceResetConsumer,
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    consumer = module.get<BalanceResetConsumer>(BalanceResetConsumer);
    loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(consumer).toBeDefined();
  });

  describe('process', () => {
    it('should successfully reset all user balances', async () => {
      await consumer.process();

      expect(dataSource.createQueryRunner).toHaveBeenCalledTimes(1);
      expect(queryRunner.connect).toHaveBeenCalledTimes(1);
      expect(queryRunner.startTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.manager.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
      expect(loggerLogSpy).toHaveBeenCalledWith(
        'Starting reset balances job...',
      );
      expect(loggerLogSpy).toHaveBeenCalledWith(
        'Successfully reset all user balances',
      );
    });

    it('should build correct query for updating user balances', async () => {
      const mockQueryBuilder = (
        queryRunner.manager as any
      ).createQueryBuilder();

      await consumer.process();

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(User);
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({ balance: 0 });
      expect(mockQueryBuilder.execute).toHaveBeenCalledTimes(1);
    });

    it('should handle database connection errors', async () => {
      const connectionError = new Error('Database connection failed');
      queryRunner.connect = jest.fn().mockRejectedValue(connectionError);

      await expect(consumer.process()).rejects.toThrow(
        'Database connection failed',
      );
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(loggerErrorSpy).not.toHaveBeenCalled();
      expect(queryRunner.release).not.toHaveBeenCalled();
    });

    it('should handle transaction start errors', async () => {
      const transactionError = new Error('Failed to start transaction');
      queryRunner.startTransaction = jest
        .fn()
        .mockRejectedValue(transactionError);

      await expect(consumer.process()).rejects.toThrow(
        'Failed to start transaction',
      );
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(loggerErrorSpy).not.toHaveBeenCalled();
      expect(queryRunner.release).not.toHaveBeenCalled();
    });

    it('should handle query execution errors and rollback transaction', async () => {
      const queryError = new Error('Query execution failed');
      const mockQueryBuilder = queryRunner.manager.createQueryBuilder();
      mockQueryBuilder.execute = jest.fn().mockRejectedValue(queryError);

      await expect(consumer.process()).rejects.toThrow(
        'Query execution failed',
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Error resetting balances:',
        queryError,
      );
    });

    it('should handle commit transaction errors', async () => {
      const commitError = new Error('Failed to commit transaction');
      queryRunner.commitTransaction = jest.fn().mockRejectedValue(commitError);

      await expect(consumer.process()).rejects.toThrow(
        'Failed to commit transaction',
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Error resetting balances:',
        commitError,
      );
    });

    it('should handle rollback errors gracefully', async () => {
      const queryError = new Error('Query failed');
      const rollbackError = new Error('Rollback failed');
      const mockQueryBuilder = (
        queryRunner.manager as any
      ).createQueryBuilder();
      mockQueryBuilder.execute = jest.fn().mockRejectedValue(queryError);
      queryRunner.rollbackTransaction = jest
        .fn()
        .mockRejectedValue(rollbackError);

      await expect(consumer.process()).rejects.toThrow('Rollback failed');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('should handle release errors in finally block', async () => {
      const releaseError = new Error('Failed to release connection');
      queryRunner.release = jest.fn().mockRejectedValue(releaseError);

      await expect(consumer.process()).rejects.toThrow(
        'Failed to release connection',
      );

      expect(queryRunner.release).toHaveBeenCalledTimes(1);
      expect(loggerLogSpy).toHaveBeenCalledWith(
        'Successfully reset all user balances',
      );
    });

    it('should always release query runner even on success', async () => {
      await consumer.process();

      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('should always release query runner when error occurs in try block', async () => {
      const error = new Error('Some error');
      const mockQueryBuilder = (
        queryRunner.manager as any
      ).createQueryBuilder();
      mockQueryBuilder.execute = jest.fn().mockRejectedValue(error);

      await expect(consumer.process()).rejects.toThrow('Some error');

      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('Logging', () => {
    it('should log start message before processing', async () => {
      loggerLogSpy.mockClear();

      await consumer.process();

      expect(loggerLogSpy).toHaveBeenNthCalledWith(
        1,
        'Starting reset balances job...',
      );
    });

    it('should log success message after successful processing', async () => {
      loggerLogSpy.mockClear();

      await consumer.process();

      expect(loggerLogSpy).toHaveBeenNthCalledWith(
        2,
        'Successfully reset all user balances',
      );
      expect(loggerLogSpy).toHaveBeenCalledTimes(2);
    });

    it('should log error message when processing fails', async () => {
      const error = new Error('Processing failed');
      const mockQueryBuilder = (
        queryRunner.manager as any
      ).createQueryBuilder();
      mockQueryBuilder.execute = jest.fn().mockRejectedValue(error);
      loggerErrorSpy.mockClear();

      await expect(consumer.process()).rejects.toThrow('Processing failed');

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Error resetting balances:',
        error,
      );
      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should not log success message when error occurs', async () => {
      const error = new Error('Processing failed');
      queryRunner.connect = jest.fn().mockRejectedValue(error);
      loggerLogSpy.mockClear();

      try {
        await consumer.process();
      } catch {
        // Expected to throw
      }

      expect(loggerLogSpy).toHaveBeenCalledWith(
        'Starting reset balances job...',
      );
      expect(loggerLogSpy).not.toHaveBeenCalledWith(
        'Successfully reset all user balances',
      );
    });
  });

  describe('Transaction Management', () => {
    it('should execute operations in correct order for successful case', async () => {
      const calls: string[] = [];

      queryRunner.connect = jest.fn().mockImplementation(() => {
        calls.push('connect');
        return Promise.resolve();
      });
      queryRunner.startTransaction = jest.fn().mockImplementation(() => {
        calls.push('startTransaction');
        return Promise.resolve();
      });
      const mockQueryBuilder = queryRunner.manager.createQueryBuilder();
      mockQueryBuilder.execute = jest.fn().mockImplementation(() => {
        calls.push('execute');
        return Promise.resolve({ affected: 5 });
      });
      queryRunner.commitTransaction = jest.fn().mockImplementation(() => {
        calls.push('commitTransaction');
        return Promise.resolve();
      });
      queryRunner.release = jest.fn().mockImplementation(() => {
        calls.push('release');
        return Promise.resolve();
      });

      await consumer.process();

      expect(calls).toEqual([
        'connect',
        'startTransaction',
        'execute',
        'commitTransaction',
        'release',
      ]);
    });

    it('should execute rollback before release on error', async () => {
      const calls: string[] = [];
      const error = new Error('Query failed');

      queryRunner.connect = jest.fn().mockImplementation(() => {
        calls.push('connect');
        return Promise.resolve();
      });
      queryRunner.startTransaction = jest.fn().mockImplementation(() => {
        calls.push('startTransaction');
        return Promise.resolve();
      });
      const mockQueryBuilder = queryRunner.manager.createQueryBuilder();
      mockQueryBuilder.execute = jest.fn().mockImplementation(() => {
        calls.push('execute');
        return Promise.reject(error);
      });
      queryRunner.rollbackTransaction = jest.fn().mockImplementation(() => {
        calls.push('rollbackTransaction');
        return Promise.resolve();
      });
      queryRunner.release = jest.fn().mockImplementation(() => {
        calls.push('release');
        return Promise.resolve();
      });

      try {
        await consumer.process();
      } catch {
        // Expected to throw
      }

      expect(calls).toEqual([
        'connect',
        'startTransaction',
        'execute',
        'rollbackTransaction',
        'release',
      ]);
    });

    it('should not call rollback if error occurs before transaction starts', async () => {
      const error = new Error('Connection failed');
      queryRunner.connect = jest.fn().mockRejectedValue(error);

      await expect(consumer.process()).rejects.toThrow('Connection failed');

      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(queryRunner.release).not.toHaveBeenCalled();
    });
  });

  describe('Database Integration', () => {
    it('should use the injected DataSource', async () => {
      await consumer.process();

      expect(dataSource.createQueryRunner).toHaveBeenCalledTimes(1);
    });

    it('should create new query runner for each process call', async () => {
      await consumer.process();
      await consumer.process();

      expect(dataSource.createQueryRunner).toHaveBeenCalledTimes(2);
    });

    it('should update User entity specifically', async () => {
      const mockQueryBuilder = queryRunner.manager.createQueryBuilder();

      await consumer.process();

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(User);
    });

    it('should set balance to 0 for all users', async () => {
      const mockQueryBuilder = (
        queryRunner.manager as any
      ).createQueryBuilder();

      await consumer.process();

      expect(mockQueryBuilder.set).toHaveBeenCalledWith({ balance: 0 });
    });
  });

  describe('Error Propagation', () => {
    it('should propagate original error after rollback', async () => {
      const originalError = new Error('Original query error');
      const mockQueryBuilder = queryRunner.manager.createQueryBuilder();
      mockQueryBuilder.execute = jest.fn().mockRejectedValue(originalError);

      await expect(consumer.process()).rejects.toBe(originalError);
    });

    it('should maintain error properties', async () => {
      const customError = new Error('Custom error message');
      customError.name = 'CustomDatabaseError';
      customError.stack = 'custom stack trace';
      const mockQueryBuilder = queryRunner.manager.createQueryBuilder();
      mockQueryBuilder.execute = jest.fn().mockRejectedValue(customError);

      try {
        await consumer.process();
        fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toBe('Custom error message');
        expect(error.name).toBe('CustomDatabaseError');
        expect(error.stack).toBe('custom stack trace');
      }
    });
  });
});

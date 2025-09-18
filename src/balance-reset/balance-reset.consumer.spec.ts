import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { UpdateResult } from 'typeorm';
import { BalanceResetConsumer } from './balance-reset.consumer';
import { UserRepository } from '../users/repositories/user.repository';

describe('BalanceResetConsumer', () => {
  let consumer: BalanceResetConsumer;
  let userRepository: jest.Mocked<UserRepository>;
  let loggerLogSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    const mockUserRepository = {
      resetBalance: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceResetConsumer,
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    consumer = module.get<BalanceResetConsumer>(BalanceResetConsumer);
    userRepository = module.get(UserRepository);
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
      loggerLogSpy.mockClear();
      loggerErrorSpy.mockClear();

      const mockResult: UpdateResult = {
        affected: 5,
        raw: [],
        generatedMaps: [],
      };
      userRepository.resetBalance.mockResolvedValue(mockResult);

      await consumer.process();

      expect(userRepository.resetBalance).toHaveBeenCalledTimes(1);
      expect(loggerLogSpy).toHaveBeenCalledWith(
        'Starting reset balances job...',
      );
      expect(loggerLogSpy).toHaveBeenCalledWith(
        'Successfully reset all user balances',
      );
      expect(loggerLogSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle errors from UserRepository', async () => {
      const error = new Error('Database error');
      userRepository.resetBalance.mockRejectedValue(error);

      await expect(consumer.process()).rejects.toThrow('Database error');

      expect(userRepository.resetBalance).toHaveBeenCalledTimes(1);
      expect(loggerLogSpy).toHaveBeenCalledWith(
        'Starting reset balances job...',
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Error resetting balances:',
        error,
      );
      expect(loggerLogSpy).not.toHaveBeenCalledWith(
        'Successfully reset all user balances',
      );
    });

    it('should propagate custom errors', async () => {
      const customError = new Error('Custom database error');
      customError.name = 'CustomDatabaseError';
      userRepository.resetBalance.mockRejectedValue(customError);

      try {
        await consumer.process();
        fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toBe('Custom database error');
        expect(error.name).toBe('CustomDatabaseError');
      }

      expect(userRepository.resetBalance).toHaveBeenCalledTimes(1);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Error resetting balances:',
        customError,
      );
    });
  });

  describe('Logging', () => {
    it('should log start message before processing', async () => {
      const mockResult: UpdateResult = {
        affected: 3,
        raw: [],
        generatedMaps: [],
      };
      userRepository.resetBalance.mockResolvedValue(mockResult);
      loggerLogSpy.mockClear();

      await consumer.process();

      expect(loggerLogSpy).toHaveBeenNthCalledWith(
        1,
        'Starting reset balances job...',
      );
    });

    it('should log success message after successful processing', async () => {
      const mockResult: UpdateResult = {
        affected: 3,
        raw: [],
        generatedMaps: [],
      };
      userRepository.resetBalance.mockResolvedValue(mockResult);
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
      userRepository.resetBalance.mockRejectedValue(error);
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
      userRepository.resetBalance.mockRejectedValue(error);
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

  describe('UserRepository Integration', () => {
    it('should delegate to UserRepository for balance reset', async () => {
      const mockResult: UpdateResult = {
        affected: 10,
        raw: [],
        generatedMaps: [],
      };
      userRepository.resetBalance.mockResolvedValue(mockResult);

      await consumer.process();

      expect(userRepository.resetBalance).toHaveBeenCalledWith();
      expect(userRepository.resetBalance).toHaveBeenCalledTimes(1);
    });

    it('should handle zero affected rows', async () => {
      const mockResult: UpdateResult = {
        affected: 0,
        raw: [],
        generatedMaps: [],
      };
      userRepository.resetBalance.mockResolvedValue(mockResult);

      await consumer.process();

      expect(userRepository.resetBalance).toHaveBeenCalledTimes(1);
      expect(loggerLogSpy).toHaveBeenCalledWith(
        'Successfully reset all user balances',
      );
    });
  });

  describe('Error Propagation', () => {
    it('should propagate UserRepository errors unchanged', async () => {
      const repositoryError = new Error('Repository error');
      userRepository.resetBalance.mockRejectedValue(repositoryError);

      await expect(consumer.process()).rejects.toBe(repositoryError);
    });

    it('should maintain error properties when propagating', async () => {
      const customError = new Error('Custom error message');
      customError.name = 'CustomRepositoryError';
      customError.stack = 'custom stack trace';
      userRepository.resetBalance.mockRejectedValue(customError);

      try {
        await consumer.process();
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBe(customError);
        expect(error.message).toBe('Custom error message');
        expect(error.name).toBe('CustomRepositoryError');
        expect(error.stack).toBe('custom stack trace');
      }
    });
  });
});

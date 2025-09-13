import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { User } from '../users/user.entity';
import { TransferDto } from './dto/transfer.dto';

jest.mock('typeorm-transactional', () => ({
  Transactional:
    () => (target: any, propertyName: string, descriptor: PropertyDescriptor) =>
      descriptor,
  initializeTransactionalContext: jest.fn(),
  addTransactionalDataSource: jest.fn(),
}));

describe('BalanceService', () => {
  let service: BalanceService;
  let userRepository: jest.Mocked<Repository<User>>;
  let queryBuilder: jest.Mocked<SelectQueryBuilder<User>>;

  const mockUser1: Partial<User> = {
    login: 'user1',
    email: 'user1@example.com',
    password: 'password',
    age: 25,
    description: 'Test user 1',
    avatars: [],
    balance: 100.5,
  };

  const mockUser2: Partial<User> = {
    login: 'user2',
    email: 'user2@example.com',
    password: 'password',
    age: 30,
    description: 'Test user 2',
    avatars: [],
    balance: 50.25,
  };

  beforeEach(async () => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    } as any;

    const mockRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<BalanceService>(BalanceService);
    userRepository = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('transfer', () => {
    it('should successfully transfer money between users', async () => {
      const transferDto: TransferDto = {
        from: 'user1',
        to: 'user2',
        amount: 25.5,
      };

      const user1Copy = { ...mockUser1 } as User;
      const user2Copy = { ...mockUser2 } as User;

      queryBuilder.getOne
        .mockResolvedValueOnce(user1Copy)
        .mockResolvedValueOnce(user2Copy);

      userRepository.save.mockResolvedValue(undefined as any);

      const result = await service.transfer(transferDto);

      expect(userRepository.createQueryBuilder).toHaveBeenCalledTimes(2);
      expect(queryBuilder.where).toHaveBeenCalledWith('user.login = :login', {
        login: 'user1',
      });
      expect(queryBuilder.where).toHaveBeenCalledWith('user.login = :login', {
        login: 'user2',
      });
      expect(queryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');

      expect(result.fromUser.balance).toBe(75);
      expect(result.toUser.balance).toBe(75.75);
      expect(result.transferredAmount).toBe(25.5);

      expect(userRepository.save).toHaveBeenCalledWith([user1Copy, user2Copy]);
    });

    it('should handle users in different order (alphabetical sorting)', async () => {
      const transferDto: TransferDto = {
        from: 'user2',
        to: 'user1',
        amount: 10,
      };

      const user1Copy = { ...mockUser1 } as User;
      const user2Copy = { ...mockUser2 } as User;

      queryBuilder.getOne
        .mockResolvedValueOnce(user1Copy)
        .mockResolvedValueOnce(user2Copy);

      userRepository.save.mockResolvedValue(undefined as any);

      const result = await service.transfer(transferDto);

      expect(result.fromUser.login).toBe('user2');
      expect(result.toUser.login).toBe('user1');
      expect(result.fromUser.balance).toBe(40.25);
      expect(result.toUser.balance).toBe(110.5);
    });

    it('should throw BadRequestException when transferring to the same user', async () => {
      const transferDto: TransferDto = {
        from: 'user1',
        to: 'user1',
        amount: 10,
      };

      await expect(service.transfer(transferDto)).rejects.toThrow(
        new BadRequestException('Cannot transfer money to yourself'),
      );

      expect(userRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when sender user is not found', async () => {
      const transferDto: TransferDto = {
        from: 'nonexistent',
        to: 'user2',
        amount: 10,
      };

      queryBuilder.getOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...mockUser2 } as User);

      await expect(service.transfer(transferDto)).rejects.toThrow(
        new NotFoundException('User with login nonexistent not found'),
      );
    });

    it('should throw NotFoundException when receiver user is not found', async () => {
      const transferDto: TransferDto = {
        from: 'user1',
        to: 'nonexistent',
        amount: 10,
      };

      queryBuilder.getOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...mockUser1 } as User);

      await expect(service.transfer(transferDto)).rejects.toThrow(
        new NotFoundException('User with login nonexistent not found'),
      );
    });

    it('should throw BadRequestException when sender has insufficient funds', async () => {
      const transferDto: TransferDto = {
        from: 'user1',
        to: 'user2',
        amount: 200,
      };

      const user1Copy = { ...mockUser1 } as User;
      const user2Copy = { ...mockUser2 } as User;

      queryBuilder.getOne
        .mockResolvedValueOnce(user1Copy)
        .mockResolvedValueOnce(user2Copy);

      await expect(service.transfer(transferDto)).rejects.toThrow(
        new BadRequestException(
          'Insufficient funds. Available: $100.50, Required: $200.00',
        ),
      );

      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('should handle decimal precision correctly', async () => {
      const transferDto: TransferDto = {
        from: 'user1',
        to: 'user2',
        amount: 33.33,
      };

      const user1Copy = { ...mockUser1, balance: 100 } as User;
      const user2Copy = { ...mockUser2, balance: 50 } as User;

      queryBuilder.getOne
        .mockResolvedValueOnce(user1Copy)
        .mockResolvedValueOnce(user2Copy);

      userRepository.save.mockResolvedValue(undefined as any);

      const result = await service.transfer(transferDto);

      expect(result.fromUser.balance).toBe(66.67);
      expect(result.toUser.balance).toBe(83.33);
    });

    it('should handle edge case with minimum transfer amount', async () => {
      const transferDto: TransferDto = {
        from: 'user1',
        to: 'user2',
        amount: 0.01,
      };

      const user1Copy = { ...mockUser1, balance: 0.01 } as User;
      const user2Copy = { ...mockUser2, balance: 0 } as User;

      queryBuilder.getOne
        .mockResolvedValueOnce(user1Copy)
        .mockResolvedValueOnce(user2Copy);

      userRepository.save.mockResolvedValue(undefined as any);

      const result = await service.transfer(transferDto);

      expect(result.fromUser.balance).toBe(0);
      expect(result.toUser.balance).toBe(0.01);
    });

    it('should apply pessimistic write lock to both users', async () => {
      const transferDto: TransferDto = {
        from: 'user1',
        to: 'user2',
        amount: 10,
      };

      queryBuilder.getOne
        .mockResolvedValueOnce({ ...mockUser1 } as User)
        .mockResolvedValueOnce({ ...mockUser2 } as User);

      userRepository.save.mockResolvedValue(undefined as any);

      await service.transfer(transferDto);

      expect(queryBuilder.setLock).toHaveBeenCalledTimes(2);
      expect(queryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
    });

    it('should query users in alphabetical order to prevent deadlocks', async () => {
      const transferDto: TransferDto = {
        from: 'zebra',
        to: 'apple',
        amount: 10,
      };

      const userApple = { ...mockUser1, login: 'apple' } as User;
      const userZebra = { ...mockUser2, login: 'zebra', balance: 20 } as User;

      queryBuilder.getOne
        .mockResolvedValueOnce(userApple)
        .mockResolvedValueOnce(userZebra);

      userRepository.save.mockResolvedValue(undefined as any);

      await service.transfer(transferDto);

      const whereCallArgs = (queryBuilder.where as jest.Mock).mock.calls;
      expect(whereCallArgs[0][1]).toEqual({ login: 'apple' });
      expect(whereCallArgs[1][1]).toEqual({ login: 'zebra' });
    });

    it('should save both users after successful transfer', async () => {
      const transferDto: TransferDto = {
        from: 'user1',
        to: 'user2',
        amount: 25,
      };

      const user1Copy = { ...mockUser1 } as User;
      const user2Copy = { ...mockUser2 } as User;

      queryBuilder.getOne
        .mockResolvedValueOnce(user1Copy)
        .mockResolvedValueOnce(user2Copy);

      userRepository.save.mockResolvedValue(undefined as any);

      await service.transfer(transferDto);

      expect(userRepository.save).toHaveBeenCalledTimes(1);
      expect(userRepository.save).toHaveBeenCalledWith([user1Copy, user2Copy]);
    });
  });
});

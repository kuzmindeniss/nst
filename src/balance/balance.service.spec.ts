import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { TransferDto } from './dto/transfer.dto';
import { UserRepository } from '../users/repositories/user.repository';
import { User } from '../users/user.entity';

describe('BalanceService', () => {
  let service: BalanceService;
  let userRepository: jest.Mocked<UserRepository>;

  const mockUser1: User = {
    login: 'user1',
    email: 'user1@example.com',
    password: 'password',
    age: 25,
    description: 'Test user 1',
    avatars: [],
    balance: 75,
  };

  const mockUser2: User = {
    login: 'user2',
    email: 'user2@example.com',
    password: 'password',
    age: 30,
    description: 'Test user 2',
    avatars: [],
    balance: 75.75,
  };

  const mockTransferResult = {
    fromUser: mockUser1,
    toUser: mockUser2,
    transferredAmount: 25.5,
  };

  beforeEach(async () => {
    const mockUserRepository = {
      transfer: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<BalanceService>(BalanceService);
    userRepository = module.get(UserRepository);
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

      userRepository.transfer.mockResolvedValue(mockTransferResult);

      const result = await service.transfer(transferDto);

      expect(userRepository.transfer).toHaveBeenCalledWith(transferDto);
      expect(result).toEqual(mockTransferResult);
      expect(result.transferredAmount).toBe(25.5);
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

      expect(userRepository.transfer).not.toHaveBeenCalled();
    });

    it('should delegate to UserRepository for valid transfers', async () => {
      const transferDto: TransferDto = {
        from: 'user1',
        to: 'user2',
        amount: 50,
      };

      const expectedResult = {
        ...mockTransferResult,
        transferredAmount: 50,
      };

      userRepository.transfer.mockResolvedValue(expectedResult);

      const result = await service.transfer(transferDto);

      expect(userRepository.transfer).toHaveBeenCalledWith(transferDto);
      expect(result).toEqual(expectedResult);
    });

    it('should propagate errors from UserRepository', async () => {
      const transferDto: TransferDto = {
        from: 'user1',
        to: 'user2',
        amount: 1000,
      };

      const repositoryError = new BadRequestException('Insufficient funds');
      userRepository.transfer.mockRejectedValue(repositoryError);

      await expect(service.transfer(transferDto)).rejects.toThrow(
        repositoryError,
      );
      expect(userRepository.transfer).toHaveBeenCalledWith(transferDto);
    });
  });
});

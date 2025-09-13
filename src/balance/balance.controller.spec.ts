import { Test, TestingModule } from '@nestjs/testing';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { AuthGuard } from '../users/guards/auth.guard';
import { TransferDto } from './dto/transfer.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

describe('BalanceController', () => {
  let controller: BalanceController;
  let balanceService: jest.Mocked<BalanceService>;
  let authGuard: jest.Mocked<AuthGuard>;

  const mockTransferResult: any = {
    fromUser: {
      login: 'user1',
      email: 'user1@example.com',
      balance: 75.0,
    },
    toUser: {
      login: 'user2',
      email: 'user2@example.com',
      balance: 75.75,
    },
    transferredAmount: 25.5,
  };

  beforeEach(async () => {
    const mockBalanceService = {
      transfer: jest.fn(),
    };

    const mockAuthGuard = {
      canActivate: jest.fn(),
    };

    const mockJwtService = {
      verifyAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BalanceController],
      providers: [
        {
          provide: BalanceService,
          useValue: mockBalanceService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<BalanceController>(BalanceController);
    balanceService = module.get(BalanceService);
    authGuard = module.get(AuthGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('transfer', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should successfully transfer money between users', async () => {
      const transferDto: TransferDto = {
        from: 'user1',
        to: 'user2',
        amount: 25.5,
      };

      authGuard.canActivate.mockResolvedValue(true);
      balanceService.transfer.mockResolvedValue(mockTransferResult);

      const result = await controller.transfer(transferDto);

      expect(balanceService.transfer).toHaveBeenCalledWith(transferDto);
      expect(result).toEqual(mockTransferResult);
      expect(result.fromUser.balance).toBe(75.0);
      expect(result.toUser.balance).toBe(75.75);
      expect(result.transferredAmount).toBe(25.5);
    });

    it('should handle transfer with decimal amounts', async () => {
      const transferDto: TransferDto = {
        from: 'user1',
        to: 'user2',
        amount: 33.33,
      };

      const decimalResult = {
        ...mockTransferResult,
        fromUser: { ...mockTransferResult.fromUser, balance: 66.67 },
        toUser: { ...mockTransferResult.toUser, balance: 83.33 },
        transferredAmount: 33.33,
      };

      authGuard.canActivate.mockResolvedValue(true);
      balanceService.transfer.mockResolvedValue(decimalResult);

      const result = await controller.transfer(transferDto);

      expect(balanceService.transfer).toHaveBeenCalledWith(transferDto);
      expect(result).toEqual(decimalResult);
      expect(result.transferredAmount).toBe(33.33);
    });

    it('should handle minimum transfer amount', async () => {
      const transferDto: TransferDto = {
        from: 'user1',
        to: 'user2',
        amount: 0.01,
      };

      const minResult = {
        ...mockTransferResult,
        fromUser: { ...mockTransferResult.fromUser, balance: 99.99 },
        toUser: { ...mockTransferResult.toUser, balance: 50.26 },
        transferredAmount: 0.01,
      };

      authGuard.canActivate.mockResolvedValue(true);
      balanceService.transfer.mockResolvedValue(minResult);

      const result = await controller.transfer(transferDto);

      expect(balanceService.transfer).toHaveBeenCalledWith(transferDto);
      expect(result).toEqual(minResult);
      expect(result.transferredAmount).toBe(0.01);
    });

    it('should propagate BadRequestException from service when transferring to same user', async () => {
      const transferDto: TransferDto = {
        from: 'user1',
        to: 'user1',
        amount: 10.0,
      };

      authGuard.canActivate.mockResolvedValue(true);
      balanceService.transfer.mockRejectedValue(
        new BadRequestException('Cannot transfer money to yourself'),
      );

      await expect(controller.transfer(transferDto)).rejects.toThrow(
        new BadRequestException('Cannot transfer money to yourself'),
      );

      expect(balanceService.transfer).toHaveBeenCalledWith(transferDto);
    });

    it('should propagate NotFoundException from service when user not found', async () => {
      const transferDto: TransferDto = {
        from: 'nonexistent',
        to: 'user2',
        amount: 10.0,
      };

      authGuard.canActivate.mockResolvedValue(true);
      balanceService.transfer.mockRejectedValue(
        new NotFoundException('User with login nonexistent not found'),
      );

      await expect(controller.transfer(transferDto)).rejects.toThrow(
        new NotFoundException('User with login nonexistent not found'),
      );

      expect(balanceService.transfer).toHaveBeenCalledWith(transferDto);
    });

    it('should propagate BadRequestException from service when insufficient funds', async () => {
      const transferDto: TransferDto = {
        from: 'user1',
        to: 'user2',
        amount: 1000.0,
      };

      authGuard.canActivate.mockResolvedValue(true);
      balanceService.transfer.mockRejectedValue(
        new BadRequestException(
          'Insufficient funds. Available: $100.50, Required: $1000.00',
        ),
      );

      await expect(controller.transfer(transferDto)).rejects.toThrow(
        new BadRequestException(
          'Insufficient funds. Available: $100.50, Required: $1000.00',
        ),
      );

      expect(balanceService.transfer).toHaveBeenCalledWith(transferDto);
    });

    it('should handle service errors gracefully', async () => {
      const transferDto: TransferDto = {
        from: 'user1',
        to: 'user2',
        amount: 25.0,
      };

      authGuard.canActivate.mockResolvedValue(true);
      balanceService.transfer.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(controller.transfer(transferDto)).rejects.toThrow(
        'Database connection failed',
      );

      expect(balanceService.transfer).toHaveBeenCalledWith(transferDto);
    });

    it('should call balance service with exact parameters', async () => {
      const transferDto: TransferDto = {
        from: 'alice',
        to: 'bob',
        amount: 42.75,
      };

      authGuard.canActivate.mockResolvedValue(true);
      balanceService.transfer.mockResolvedValue(mockTransferResult);

      await controller.transfer(transferDto);

      expect(balanceService.transfer).toHaveBeenCalledTimes(1);
      expect(balanceService.transfer).toHaveBeenCalledWith(transferDto);
    });

    it('should return the exact result from balance service', async () => {
      const transferDto: TransferDto = {
        from: 'user1',
        to: 'user2',
        amount: 15.25,
      };

      const customResult: any = {
        fromUser: {
          login: 'custom1',
          email: 'custom1@test.com',
          balance: 84.75,
        },
        toUser: {
          login: 'custom2',
          email: 'custom2@test.com',
          balance: 65.25,
        },
        transferredAmount: 15.25,
      };

      authGuard.canActivate.mockResolvedValue(true);
      balanceService.transfer.mockResolvedValue(customResult);

      const result = await controller.transfer(transferDto);

      expect(result).toBe(customResult);
      expect(result).toEqual(customResult);
    });
  });

  describe('Controller Structure', () => {
    it('should be protected by AuthGuard', () => {
      const guards = Reflect.getMetadata('__guards__', controller.transfer);
      expect(guards).toBeDefined();
    });

    it('should have proper method decorators', () => {
      expect(typeof controller.transfer).toBe('function');
      expect(controller.transfer).toBeDefined();
    });
  });

  describe('Controller Metadata', () => {
    it('should have correct controller path', () => {
      const controllerPath = Reflect.getMetadata('path', BalanceController);
      expect(controllerPath).toBe('balance');
    });

    it('should have transfer method as POST endpoint', () => {
      const pathMetadata = Reflect.getMetadata('path', controller.transfer);

      expect(pathMetadata).toBe('transfer');
    });
  });
});

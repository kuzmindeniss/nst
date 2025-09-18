import { Test, TestingModule } from '@nestjs/testing';
import { BalanceResetController } from './balance-reset.controller';
import { BalanceResetService } from './balance-reset.service';
import { AuthGuard } from '../users/guards/auth.guard';
import { JwtService } from '@nestjs/jwt';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

describe('BalanceResetController', () => {
  let controller: BalanceResetController;
  let authGuard: AuthGuard;

  const mockBalanceResetService = {
    resetAllBalances: jest.fn(),
  };

  const mockJwtService = {
    verifyAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BalanceResetController],
      providers: [
        {
          provide: BalanceResetService,
          useValue: mockBalanceResetService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        AuthGuard,
      ],
    }).compile();

    controller = module.get<BalanceResetController>(BalanceResetController);
    authGuard = module.get<AuthGuard>(AuthGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('resetAllBalances', () => {
    it('should successfully reset all balances', async () => {
      const expectedResult = {
        message: 'Reset balances job has been queued successfully',
        jobId: '123',
      };
      mockBalanceResetService.resetAllBalances.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.resetAllBalances();

      expect(result).toEqual(expectedResult);
      expect(mockBalanceResetService.resetAllBalances).toHaveBeenCalledTimes(1);
      expect(mockBalanceResetService.resetAllBalances).toHaveBeenCalledWith();
    });

    it('should handle service errors', async () => {
      const errorMessage = 'Queue connection failed';
      mockBalanceResetService.resetAllBalances.mockRejectedValue(
        new Error(errorMessage),
      );

      await expect(controller.resetAllBalances()).rejects.toThrow(errorMessage);
      expect(mockBalanceResetService.resetAllBalances).toHaveBeenCalledTimes(1);
    });

    it('should return result with undefined jobId when job creation fails', async () => {
      const expectedResult = {
        message: 'Reset balances job has been queued successfully',
        jobId: undefined,
      };
      mockBalanceResetService.resetAllBalances.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.resetAllBalances();

      expect(result).toEqual(expectedResult);
      expect(result.jobId).toBeUndefined();
    });
  });

  describe('AuthGuard Integration', () => {
    let mockExecutionContext: Partial<ExecutionContext>;
    let mockRequest: any;

    beforeEach(() => {
      mockRequest = {
        headers: {},
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      };
    });

    it('should allow access with valid token', async () => {
      mockRequest.headers.authorization = 'Bearer valid-token';
      mockJwtService.verifyAsync.mockResolvedValue({
        user: { login: 'testuser', email: 'test@example.com' },
      });

      const canActivate = await authGuard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(canActivate).toBe(true);
      expect(mockRequest.user).toEqual({
        login: 'testuser',
        email: 'test@example.com',
      });
    });

    it('should deny access without token', async () => {
      mockRequest.headers.authorization = undefined;

      await expect(
        authGuard.canActivate(mockExecutionContext as ExecutionContext),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should deny access with invalid token', async () => {
      mockRequest.headers.authorization = 'Bearer invalid-token';
      mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await expect(
        authGuard.canActivate(mockExecutionContext as ExecutionContext),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should deny access with malformed authorization header', async () => {
      mockRequest.headers.authorization = 'InvalidFormat token';

      await expect(
        authGuard.canActivate(mockExecutionContext as ExecutionContext),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should deny access with empty authorization header', async () => {
      mockRequest.headers.authorization = '';

      await expect(
        authGuard.canActivate(mockExecutionContext as ExecutionContext),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Controller Metadata', () => {
    it('should have correct route path', () => {
      const controllerMetadata = Reflect.getMetadata(
        'path',
        BalanceResetController,
      );
      expect(controllerMetadata).toBe('balance-reset');
    });

    it('should have POST method decorated', () => {
      const pathMetadata = Reflect.getMetadata(
        'path',
        controller.resetAllBalances,
      );
      const methodMetadata = Reflect.getMetadata(
        'method',
        controller.resetAllBalances,
      );
      expect(pathMetadata).toBe('/');
      expect(methodMetadata).toBe(1);
    });

    it('should use AuthGuard', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        controller.resetAllBalances,
      );
      expect(guards).toBeDefined();
      expect(guards).toHaveLength(1);
      expect(guards[0]).toBe(AuthGuard);
    });
  });

  describe('Error Handling', () => {
    it('should propagate service timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockBalanceResetService.resetAllBalances.mockRejectedValue(timeoutError);

      await expect(controller.resetAllBalances()).rejects.toThrow(
        'Request timeout',
      );
    });

    it('should propagate service connection errors', async () => {
      const connectionError = new Error('Redis connection failed');
      connectionError.name = 'ConnectionError';
      mockBalanceResetService.resetAllBalances.mockRejectedValue(
        connectionError,
      );

      await expect(controller.resetAllBalances()).rejects.toThrow(
        'Redis connection failed',
      );
    });
  });

  describe('Service Integration', () => {
    it('should call service method exactly once per request', async () => {
      const expectedResult = {
        message: 'Reset balances job has been queued successfully',
        jobId: '456',
      };
      mockBalanceResetService.resetAllBalances.mockResolvedValue(
        expectedResult,
      );

      await controller.resetAllBalances();
      await controller.resetAllBalances();

      expect(mockBalanceResetService.resetAllBalances).toHaveBeenCalledTimes(2);
    });

    it('should not modify service response', async () => {
      const serviceResponse = {
        message: 'Reset balances job has been queued successfully',
        jobId: '789',
        additionalData: 'should be preserved',
      };
      mockBalanceResetService.resetAllBalances.mockResolvedValue(
        serviceResponse,
      );

      const result = await controller.resetAllBalances();

      expect(result).toEqual(serviceResponse);
      expect(result).toBe(serviceResponse);
    });
  });
});

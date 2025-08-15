import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthGuard } from './guards/auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SearchQueryDto } from './dto/search.dto';
import { UpdateUserDto } from './dto/update.dto';
import { User } from './user.entity';
import { UserResponseDto } from './dto/user.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  const mockUser: User = {
    login: 'testuser',
    email: 'test@example.com',
    password: 'hashedpassword',
    age: 25,
    description: 'Test user description',
  };

  const mockUserResponse: UserResponseDto = {
    login: 'testuser',
    email: 'test@example.com',
    age: 25,
    description: 'Test user description',
  };

  const mockUserWithToken = {
    user: mockUser,
    accessToken: 'jwt-token-123',
  };

  const mockPaginatedResult = {
    items: [mockUser],
    meta: {
      itemCount: 1,
      totalItems: 1,
      itemsPerPage: 10,
      totalPages: 1,
      currentPage: 1,
    },
  } as any;

  const mockRequest = {
    user: mockUserResponse,
  } as Request;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            paginate: jest.fn(),
            register: jest.fn(),
            login: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /users (paginate)', () => {
    it('should return paginated users', async () => {
      const searchQuery: SearchQueryDto = { page: 1, limit: 10 };
      usersService.paginate.mockResolvedValue(mockPaginatedResult);

      const result = await controller.paginate(searchQuery);

      expect(result).toEqual(mockPaginatedResult);
      expect(usersService.paginate).toHaveBeenCalledWith(searchQuery);
    });

    it('should return paginated users with login filter', async () => {
      const searchQuery: SearchQueryDto = {
        page: 1,
        limit: 10,
        login: 'testuser',
      };
      usersService.paginate.mockResolvedValue(mockPaginatedResult);

      const result = await controller.paginate(searchQuery);

      expect(result).toEqual(mockPaginatedResult);
      expect(usersService.paginate).toHaveBeenCalledWith(searchQuery);
    });

    it('should be protected by AuthGuard', () => {
      const guards = Reflect.getMetadata('__guards__', controller.paginate);
      expect(guards).toContain(AuthGuard);
    });
  });

  describe('POST /users/register', () => {
    it('should register a new user successfully', async () => {
      const registerDto: RegisterDto = {
        login: 'newuser',
        email: 'new@example.com',
        password: 'password123',
        age: 30,
        description: 'New user',
      };

      usersService.register.mockResolvedValue(mockUserWithToken);

      const result = await controller.register(registerDto);

      expect(result).toEqual(mockUserWithToken);
      expect(usersService.register).toHaveBeenCalledWith(registerDto);
    });

    it('should handle registration errors', async () => {
      const registerDto: RegisterDto = {
        login: 'existinguser',
        email: 'existing@example.com',
        password: 'password123',
        age: 30,
      };

      const error = new Error('User already exists');
      usersService.register.mockRejectedValue(error);

      await expect(controller.register(registerDto)).rejects.toThrow(error);
      expect(usersService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('POST /users/login', () => {
    it('should login user successfully', async () => {
      const loginDto: LoginDto = {
        login: 'testuser',
        password: 'password123',
      };

      usersService.login.mockResolvedValue(mockUserWithToken);

      const result = await controller.login(loginDto);

      expect(result).toEqual(mockUserWithToken);
      expect(usersService.login).toHaveBeenCalledWith(loginDto);
    });

    it('should handle login errors', async () => {
      const loginDto: LoginDto = {
        login: 'testuser',
        password: 'wrongpassword',
      };

      const error = new Error('Invalid credentials');
      usersService.login.mockRejectedValue(error);

      await expect(controller.login(loginDto)).rejects.toThrow(error);
      expect(usersService.login).toHaveBeenCalledWith(loginDto);
    });
  });

  describe('GET /users/me', () => {
    it('should return current user from request', () => {
      const result = controller.me(mockRequest);

      expect(result).toEqual(mockUserResponse);
    });

    it('should be protected by AuthGuard', () => {
      const guards = Reflect.getMetadata('__guards__', controller.me);
      expect(guards).toContain(AuthGuard);
    });
  });

  describe('PATCH /users/:login', () => {
    it('should update user successfully', async () => {
      const login = 'testuser';
      const updateDto: UpdateUserDto = {
        email: 'updated@example.com',
        age: 30,
      };
      const updatedUser = { ...mockUser, ...updateDto };

      usersService.update.mockResolvedValue(updatedUser);

      const result = await controller.update(login, mockRequest, updateDto);

      expect(result).toEqual(updatedUser);
      expect(usersService.update).toHaveBeenCalledWith(login, updateDto);
    });

    it('should handle update errors', async () => {
      const login = 'nonexistent';
      const updateDto: UpdateUserDto = {
        email: 'updated@example.com',
      };

      const error = new Error('User not found');
      usersService.update.mockRejectedValue(error);

      await expect(
        controller.update(login, mockRequest, updateDto),
      ).rejects.toThrow(error);
      expect(usersService.update).toHaveBeenCalledWith(login, updateDto);
    });

    it('should be protected by AuthGuard', () => {
      const guards = Reflect.getMetadata('__guards__', controller.update);
      expect(guards).toContain(AuthGuard);
    });
  });

  describe('DELETE /users/:login', () => {
    it('should delete user successfully', async () => {
      const login = 'testuser';
      usersService.delete.mockResolvedValue(mockUser);

      const result = await controller.delete(login);

      expect(result).toEqual(mockUser);
      expect(usersService.delete).toHaveBeenCalledWith(login);
    });

    it('should handle delete errors', async () => {
      const login = 'nonexistent';
      const error = new Error('User not found');
      usersService.delete.mockRejectedValue(error);

      await expect(controller.delete(login)).rejects.toThrow(error);
      expect(usersService.delete).toHaveBeenCalledWith(login);
    });

    it('should be protected by AuthGuard', () => {
      const guards = Reflect.getMetadata('__guards__', controller.delete);
      expect(guards).toContain(AuthGuard);
    });
  });

  describe('Guard Protection Tests', () => {
    it('should protect paginate endpoint with AuthGuard', () => {
      const guards = Reflect.getMetadata('__guards__', controller.paginate);
      expect(guards).toContain(AuthGuard);
    });

    it('should protect me endpoint with AuthGuard', () => {
      const guards = Reflect.getMetadata('__guards__', controller.me);
      expect(guards).toContain(AuthGuard);
    });

    it('should protect update endpoint with AuthGuard', () => {
      const guards = Reflect.getMetadata('__guards__', controller.update);
      expect(guards).toContain(AuthGuard);
    });

    it('should protect delete endpoint with AuthGuard', () => {
      const guards = Reflect.getMetadata('__guards__', controller.delete);
      expect(guards).toContain(AuthGuard);
    });
  });

  describe('Controller Metadata', () => {
    it('should have correct controller path', () => {
      const path = Reflect.getMetadata('path', UsersController);
      expect(path).toBe('users');
    });
  });
});

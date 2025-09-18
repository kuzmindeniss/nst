import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { User } from './user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SearchQueryDto } from './dto/search.dto';
import { UpdateUserDto } from './dto/update.dto';
import { IFileService } from 'src/providers/files/files.adapter';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { UserRepository } from './repositories/user.repository';
import { AvatarRepository } from './repositories/avatar.repository';

jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: jest.Mocked<UserRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let cacheManager: jest.Mocked<any>;

  const mockUser: User = {
    login: 'testuser',
    email: 'test@example.com',
    password: 'hashedpassword',
    age: 25,
    description: 'Test user description',
    avatars: [],
    balance: 0,
  };

  const mockUserResponseDto = {
    login: 'testuser',
    email: 'test@example.com',
    age: 25,
    description: 'Test user description',
    balance: 0,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockUserRepository = {
      findAll: jest.fn(),
      findByLogin: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      findWithPagination: jest.fn(),
    };

    const mockAvatarRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const mockFileService = {
      uploadFile: jest.fn(),
      removeFile: jest.fn(),
    };

    const mockJwtService = {
      signAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
        {
          provide: AvatarRepository,
          useValue: mockAvatarRepository,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: IFileService,
          useValue: mockFileService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get(UserRepository);
    jwtService = module.get(JwtService);
    cacheManager = module.get(CACHE_MANAGER);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      const users = [mockUser];
      userRepository.findAll.mockResolvedValue(users);

      const result = await service.findAll();

      expect(result).toEqual(users);
      expect(userRepository.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a user by login', async () => {
      userRepository.findByLogin.mockResolvedValue(mockUser);

      const result = await service.findOne('testuser');

      expect(result).toEqual(mockUser);
      expect(userRepository.findByLogin).toHaveBeenCalledWith({
        login: 'testuser',
      });
    });

    it('should return null if user not found', async () => {
      userRepository.findByLogin.mockResolvedValue(null);

      const result = await service.findOne('nonexistent');

      expect(result).toBeNull();
      expect(userRepository.findByLogin).toHaveBeenCalledWith({
        login: 'nonexistent',
      });
    });
  });

  describe('getUsersPaginated', () => {
    it('should return cached users when available', async () => {
      const options: SearchQueryDto = { page: 1, limit: 10 };
      const cachedResult = { items: [mockUserResponseDto], meta: {} };

      cacheManager.get.mockResolvedValue(cachedResult);

      const result = await service.getUsersPaginated(options);

      expect(result).toEqual(cachedResult);
      expect(cacheManager.get).toHaveBeenCalledWith(
        'users:page=1:limit=10:login=undefined',
      );
      expect(userRepository.findWithPagination).not.toHaveBeenCalled();
    });

    it('should fetch and cache users when not cached', async () => {
      const options: SearchQueryDto = { page: 1, limit: 10 };
      const paginatedResult = {
        items: [mockUserResponseDto],
        meta: {
          itemCount: 1,
          itemsPerPage: 10,
          currentPage: 1,
          totalItems: 1,
          totalPages: 1,
        },
      };

      cacheManager.get.mockResolvedValue(null);
      userRepository.findWithPagination.mockResolvedValue(
        paginatedResult as any,
      );

      const result = await service.getUsersPaginated(options);

      expect(result).toEqual(paginatedResult);
      expect(userRepository.findWithPagination).toHaveBeenCalledWith(options);
      expect(cacheManager.set).toHaveBeenCalledWith(
        'users:page=1:limit=10:login=undefined',
        paginatedResult,
        30000,
      );
    });

    it('should handle login filter correctly', async () => {
      const options: SearchQueryDto = { page: 1, limit: 10, login: 'testuser' };

      cacheManager.get.mockResolvedValue(null);
      userRepository.findWithPagination.mockResolvedValue({
        items: [mockUserResponseDto],
        meta: {
          itemCount: 1,
          itemsPerPage: 10,
          currentPage: 1,
          totalItems: 1,
          totalPages: 1,
        },
      });

      await service.getUsersPaginated(options);

      expect(cacheManager.get).toHaveBeenCalledWith(
        'users:page=1:limit=10:login=testuser',
      );
      expect(userRepository.findWithPagination).toHaveBeenCalledWith(options);
    });
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      login: 'newuser',
      email: 'new@example.com',
      password: 'password123',
      age: 30,
      description: 'New user',
    };

    it('should successfully register a new user', async () => {
      const hashedPassword = 'hashedpassword123';
      const accessToken = 'jwt-token';
      const createdUser = {
        ...registerDto,
        password: hashedPassword,
        avatars: [],
        balance: 0,
      } as User;

      userRepository.findByLogin.mockResolvedValue(null);
      userRepository.findByEmail.mockResolvedValue(null);
      (mockedBcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      userRepository.create.mockResolvedValue(createdUser);
      userRepository.save.mockResolvedValue(createdUser);
      jwtService.signAsync.mockResolvedValue(accessToken);

      const result = await service.register(registerDto);

      expect(result).toEqual({
        user: createdUser,
        accessToken,
      });
      expect(userRepository.findByLogin).toHaveBeenCalledWith({
        login: 'newuser',
      });
      expect(userRepository.findByEmail).toHaveBeenCalledWith({
        email: 'new@example.com',
      });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(userRepository.create).toHaveBeenCalledWith({
        ...registerDto,
        password: hashedPassword,
      });
    });

    it('should throw ConflictException if user with login already exists', async () => {
      userRepository.findByLogin.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        new ConflictException('User with this login already exists'),
      );

      expect(userRepository.findByLogin).toHaveBeenCalledWith({
        login: 'newuser',
      });
    });

    it('should throw ConflictException if user with email already exists', async () => {
      userRepository.findByLogin.mockResolvedValue(null);
      userRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        new ConflictException('User with this email already exists'),
      );

      expect(userRepository.findByEmail).toHaveBeenCalledWith({
        email: 'new@example.com',
      });
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      login: 'testuser',
      password: 'password123',
    };

    it('should successfully login with valid credentials', async () => {
      const accessToken = 'jwt-token';

      userRepository.findByLogin.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      jwtService.signAsync.mockResolvedValue(accessToken);

      const result = await service.login(loginDto);

      expect(result).toEqual({
        user: mockUser,
        accessToken,
      });
      expect(userRepository.findByLogin).toHaveBeenCalledWith({
        login: 'testuser',
      });
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        'password123',
        'hashedpassword',
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        user: { login: 'testuser', email: 'test@example.com' },
      });
    });

    it('should throw BadRequestException if user not found', async () => {
      userRepository.findByLogin.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        new BadRequestException('Invalid credentials'),
      );

      expect(userRepository.findByLogin).toHaveBeenCalledWith({
        login: 'testuser',
      });
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if password is invalid', async () => {
      userRepository.findByLogin.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(service.login(loginDto)).rejects.toThrow(
        new BadRequestException('Invalid credentials'),
      );

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        'password123',
        'hashedpassword',
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateUserDto = {
      email: 'updated@example.com',
      password: 'newpassword123',
      age: 35,
      description: 'Updated description',
    };

    it('should successfully update user', async () => {
      const updatedUser = { ...mockUser, ...updateDto, password: 'newhashed' };

      userRepository.findByLogin.mockResolvedValue(mockUser);
      userRepository.findByEmail.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('newhashed' as never);
      userRepository.save.mockResolvedValue(updatedUser);

      const result = await service.update('testuser', updateDto);

      expect(result).toEqual(updatedUser);
      expect(userRepository.findByLogin).toHaveBeenCalledWith({
        login: 'testuser',
      });
      expect(userRepository.findByEmail).toHaveBeenCalledWith({
        email: 'updated@example.com',
      });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findByLogin.mockResolvedValue(null);

      await expect(service.update('nonexistent', updateDto)).rejects.toThrow(
        new NotFoundException('User not found'),
      );
    });

    it('should throw ConflictException if email already exists for another user', async () => {
      const currentUser: User = {
        login: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        age: 25,
        description: 'Test user description',
        avatars: [],
        balance: 0,
      };

      const anotherUser: User = {
        login: 'anotheruser',
        email: 'updated@example.com',
        password: 'somepassword',
        age: 30,
        description: 'Another user',
        avatars: [],
        balance: 0,
      };

      userRepository.findByLogin.mockResolvedValue(currentUser);
      userRepository.findByEmail.mockResolvedValue(anotherUser);

      await expect(
        service.update('testuser', { email: 'updated@example.com' }),
      ).rejects.toThrow(
        new ConflictException('User with this email already exists'),
      );

      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('should not hash password if length is less than 6 characters', async () => {
      userRepository.findByLogin.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);

      await service.update('testuser', { password: '123' });

      expect(mockedBcrypt.hash).not.toHaveBeenCalled();
    });

    it('should allow updating email to the same email', async () => {
      userRepository.findByLogin.mockResolvedValue(mockUser);
      userRepository.findByEmail.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);

      const result = await service.update('testuser', {
        email: 'test@example.com',
      });

      expect(result).toEqual(mockUser);
      expect(userRepository.save).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should successfully delete user', async () => {
      userRepository.findByLogin.mockResolvedValue(mockUser);
      userRepository.remove.mockResolvedValue(mockUser);

      const result = await service.delete('testuser');

      expect(result).toEqual(mockUser);
      expect(userRepository.findByLogin).toHaveBeenCalledWith({
        login: 'testuser',
      });
      expect(userRepository.remove).toHaveBeenCalledWith(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findByLogin.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(
        new NotFoundException('User not found'),
      );

      expect(userRepository.remove).not.toHaveBeenCalled();
    });
  });
});

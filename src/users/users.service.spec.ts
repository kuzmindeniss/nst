import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository, SelectQueryBuilder } from 'typeorm';
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

jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

jest.mock('nestjs-typeorm-paginate', () => ({
  paginate: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: jest.Mocked<Repository<User>>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser: User = {
    login: 'testuser',
    email: 'test@example.com',
    password: 'hashedpassword',
    age: 25,
    description: 'Test user description',
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
  } as unknown as SelectQueryBuilder<User>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            findOneBy: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get(getRepositoryToken(User));
    jwtService = module.get(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      const users = [mockUser];
      userRepository.find.mockResolvedValue(users);

      const result = await service.findAll();

      expect(result).toEqual(users);
      expect(userRepository.find).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a user by login', async () => {
      userRepository.findOneBy.mockResolvedValue(mockUser);

      const result = await service.findOne('testuser');

      expect(result).toEqual(mockUser);
      expect(userRepository.findOneBy).toHaveBeenCalledWith({
        login: 'testuser',
      });
    });

    it('should return null if user not found', async () => {
      userRepository.findOneBy.mockResolvedValue(null);

      const result = await service.findOne('nonexistent');

      expect(result).toBeNull();
      expect(userRepository.findOneBy).toHaveBeenCalledWith({
        login: 'nonexistent',
      });
    });
  });

  describe('paginate', () => {
    it('should call paginate with correct parameters when no login filter', async () => {
      const { paginate } = jest.requireMock('nestjs-typeorm-paginate');
      const options: SearchQueryDto = { page: 1, limit: 10 };
      const expectedResult = { items: [mockUser], meta: {} };

      paginate.mockResolvedValue(expectedResult);
      userRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.paginate(options);

      expect(result).toEqual(expectedResult);
      expect(userRepository.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(mockQueryBuilder.where).not.toHaveBeenCalled();
      expect(paginate).toHaveBeenCalledWith(mockQueryBuilder, {
        page: 1,
        limit: 10,
      });
    });

    it('should apply login filter when provided', async () => {
      const { paginate } = jest.requireMock('nestjs-typeorm-paginate');
      const options: SearchQueryDto = { page: 1, limit: 10, login: 'testuser' };
      const expectedResult = { items: [mockUser], meta: {} };

      paginate.mockResolvedValue(expectedResult);
      userRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.paginate(options);

      expect(result).toEqual(expectedResult);
      expect(userRepository.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'user.login = :login',
        {
          login: 'testuser',
        },
      );
      expect(paginate).toHaveBeenCalledWith(mockQueryBuilder, {
        page: 1,
        limit: 10,
      });
    });

    it('should not apply filter for empty login string', async () => {
      const { paginate } = jest.requireMock('nestjs-typeorm-paginate');
      const options: SearchQueryDto = { page: 1, limit: 10, login: '   ' };
      const expectedResult = { items: [mockUser], meta: {} };

      paginate.mockResolvedValue(expectedResult);
      userRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.paginate(options);

      expect(mockQueryBuilder.where).not.toHaveBeenCalled();
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

      userRepository.findOneBy
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (mockedBcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      userRepository.create.mockReturnValue({
        ...registerDto,
        password: hashedPassword,
      } as User);
      userRepository.save.mockResolvedValue({
        ...registerDto,
        password: hashedPassword,
      } as User);
      jwtService.signAsync.mockResolvedValue(accessToken);

      const result = await service.register(registerDto);

      expect(result).toEqual({
        user: { ...registerDto, password: hashedPassword },
        accessToken,
      });
      expect(userRepository.findOneBy).toHaveBeenCalledWith({
        login: 'newuser',
      });
      expect(userRepository.findOneBy).toHaveBeenCalledWith({
        email: 'new@example.com',
      });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(userRepository.create).toHaveBeenCalledWith({
        ...registerDto,
        password: hashedPassword,
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        user: { login: 'newuser', email: 'new@example.com' },
      });
    });

    it('should throw ConflictException if user with login already exists', async () => {
      userRepository.findOneBy.mockResolvedValueOnce(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        new ConflictException('User with this login already exists'),
      );

      expect(userRepository.findOneBy).toHaveBeenCalledWith({
        login: 'newuser',
      });
    });

    it('should throw ConflictException if user with email already exists', async () => {
      userRepository.findOneBy
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        new ConflictException('User with this email already exists'),
      );

      expect(userRepository.findOneBy).toHaveBeenCalledWith({
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

      userRepository.findOne.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      jwtService.signAsync.mockResolvedValue(accessToken);

      const result = await service.login(loginDto);

      expect(result).toEqual({
        user: mockUser,
        accessToken,
      });
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { login: 'testuser' },
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
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        new BadRequestException('Invalid credentials'),
      );

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { login: 'testuser' },
      });
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if password is invalid', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
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

      userRepository.findOne
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);
      mockedBcrypt.hash.mockResolvedValue('newhashed' as never);
      userRepository.save.mockResolvedValue(updatedUser);

      const result = await service.update('testuser', updateDto);

      expect(result).toEqual(updatedUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { login: 'testuser' },
      });
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'updated@example.com' },
      });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

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
      };

      const anotherUser: User = {
        login: 'anotheruser',
        email: 'updated@example.com',
        password: 'somepassword',
        age: 30,
        description: 'Another user',
      };

      userRepository.findOne
        .mockResolvedValueOnce(currentUser)
        .mockResolvedValueOnce(anotherUser);

      await expect(
        service.update('testuser', { email: 'updated@example.com' }),
      ).rejects.toThrow(
        new ConflictException('User with this email already exists'),
      );

      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('should not hash password if length is less than 6 characters', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);

      await service.update('testuser', { password: '123' });

      expect(mockedBcrypt.hash).not.toHaveBeenCalled();
    });

    it('should allow updating email to the same email', async () => {
      userRepository.findOne
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockUser);
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
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.remove.mockResolvedValue(mockUser);

      const result = await service.delete('testuser');

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { login: 'testuser' },
      });
      expect(userRepository.remove).toHaveBeenCalledWith(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(
        new NotFoundException('User not found'),
      );

      expect(userRepository.remove).not.toHaveBeenCalled();
    });
  });
});

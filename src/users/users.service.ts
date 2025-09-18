import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { RegisterDto } from './dto/register.dto';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { SearchQueryDto } from './dto/search.dto';
import { UpdateUserDto } from './dto/update.dto';
import { IFileService } from 'src/providers/files/files.adapter';
import { v4 } from 'uuid';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { UserRepository } from './repositories/user.repository';
import { AvatarRepository } from './repositories/avatar.repository';

@Injectable()
export class UsersService {
  avatarFolder = 'avatars';

  constructor(
    private readonly jwtService: JwtService,
    private readonly fileService: IFileService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly userRepository: UserRepository,
    private readonly avatarRepository: AvatarRepository,
  ) {}

  findAll() {
    return this.userRepository.findAll();
  }

  async getUsersPaginated(options: SearchQueryDto) {
    const { page, limit, login } = options;

    const cacheKey = `users:page=${options.page}:limit=${options.limit}:login=${options.login}`;

    const cachedUsers = await this.cacheManager.get(cacheKey);
    if (cachedUsers) {
      return cachedUsers;
    }

    const users = await this.userRepository.findWithPagination({
      page,
      limit,
      login,
    });

    await this.cacheManager.set(cacheKey, users, 30000);

    return users;
  }

  findOne(login: string) {
    return this.userRepository.findByLogin({ login });
  }

  async login({
    login,
    password,
  }: LoginDto): Promise<{ user: User; accessToken: string }> {
    const user = await this.userRepository.findByLogin({ login });
    if (!user) {
      throw new BadRequestException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new BadRequestException('Invalid credentials');
    }

    const payload = {
      user: { login: user.login, email: user.email },
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return { user, accessToken };
  }

  async register({
    login,
    email,
    password,
    age,
    description,
  }: RegisterDto): Promise<{ user: User; accessToken: string }> {
    const existingUserByLogin = await this.userRepository.findByLogin({
      login,
    });
    if (existingUserByLogin) {
      throw new ConflictException('User with this login already exists');
    }

    const existingUserByEmail = await this.userRepository.findByEmail({
      email,
    });
    if (existingUserByEmail) {
      throw new ConflictException('User with this email already exists');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = await this.userRepository.create({
      login,
      email,
      password: hashedPassword,
      age,
      description,
    });

    const savedUser = await this.userRepository.save(user);

    const payload = {
      user: {
        login: savedUser.login,
        email: savedUser.email,
      },
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return { user: savedUser, accessToken };
  }

  async update(currentLogin: string, updates: UpdateUserDto): Promise<User> {
    const user = await this.userRepository.findByLogin({ login: currentLogin });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (updates.email && updates.email !== user.email) {
      const existingByEmail = await this.userRepository.findByEmail({
        email: updates.email,
      });
      if (existingByEmail && existingByEmail.login !== user.login) {
        throw new ConflictException('User with this email already exists');
      }
      user.email = updates.email;
    }

    if (updates.password && updates.password.length > 5) {
      const saltRounds = 10;
      user.password = await bcrypt.hash(updates.password, saltRounds);
    }

    if (updates.age) {
      user.age = updates.age;
    }

    if (updates.description) {
      user.description = updates.description;
    }

    return this.userRepository.save(user);
  }

  async delete(login: string) {
    const user = await this.userRepository.findByLogin({ login });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.userRepository.remove(user);
  }

  async uploadAvatar(login: string, file: Express.Multer.File) {
    const user = await this.userRepository.findByLogin({
      login,
      relations: ['avatars'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.avatars?.length > 5) {
      throw new BadRequestException(
        'Failed to upload avatar: user already has 5 avatars',
      );
    }

    const fileName = v4();
    const filePayload = {
      file,
      folder: this.avatarFolder,
      name: fileName,
    };
    try {
      await this.fileService.uploadFile(filePayload);
    } catch (err) {
      throw new BadRequestException(`Failed to upload avatar: ${err}`);
    }

    const avatar = await this.avatarRepository.create({
      id: fileName,
      isActive: user?.avatars?.length ? false : true,
      user,
    });
    return this.avatarRepository.save(avatar);
  }

  async deleteAvatar(login: string, avatarId: string) {
    const avatar = await this.avatarRepository.findById({ id: avatarId });
    if (!avatar) {
      throw new NotFoundException('Avatar not found');
    }
    if (avatar.user.login !== login) {
      throw new ForbiddenException('You are not allowed to delete this avatar');
    }

    await this.fileService.removeFile({
      path: `${this.avatarFolder}/${avatar.id}`,
    });

    return await this.avatarRepository.remove(avatar);
  }
}

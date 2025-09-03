import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { RegisterDto } from './dto/register.dto';
import { paginate } from 'nestjs-typeorm-paginate';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { SearchQueryDto } from './dto/search.dto';
import { UpdateUserDto } from './dto/update.dto';
import { Avatar } from './avatar.entity';
import { IFileService } from 'src/providers/files/files.adapter';
import { v4 } from 'uuid';

@Injectable()
export class UsersService {
  avatarFolder = 'avatars';

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Avatar)
    private avatarsRepository: Repository<Avatar>,
    private readonly jwtService: JwtService,
    private readonly fileService: IFileService,
  ) {}

  findAll() {
    return this.usersRepository.find();
  }

  getUsersPaginated(options: SearchQueryDto) {
    const { page, limit, login } = options;

    const queryBuilder = this.usersRepository.createQueryBuilder('user');

    if (login && login.trim().length > 0) {
      queryBuilder.where('user.login = :login', { login });
    }

    return paginate<User>(queryBuilder, { page, limit });
  }

  findOne(login: string) {
    return this.usersRepository.findOneBy({ login });
  }

  async login({
    login,
    password,
  }: LoginDto): Promise<{ user: User; accessToken: string }> {
    const user = await this.usersRepository.findOne({ where: { login } });
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
    const existingUserByLogin = await this.usersRepository.findOneBy({ login });
    if (existingUserByLogin) {
      throw new ConflictException('User with this login already exists');
    }

    const existingUserByEmail = await this.usersRepository.findOneBy({ email });
    if (existingUserByEmail) {
      throw new ConflictException('User with this email already exists');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = this.usersRepository.create({
      login,
      email,
      password: hashedPassword,
      age,
      description,
    });

    const savedUser = await this.usersRepository.save(user);

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
    const user = await this.usersRepository.findOne({
      where: { login: currentLogin },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (updates.email && updates.email !== user.email) {
      const existingByEmail = await this.usersRepository.findOne({
        where: { email: updates.email },
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

    return this.usersRepository.save(user);
  }

  async delete(login: string) {
    const user = await this.usersRepository.findOne({ where: { login } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.usersRepository.remove(user);
  }

  async uploadAvatar(login: string, file: Express.Multer.File) {
    const user = await this.usersRepository.findOne({
      where: { login },
      relations: ['avatars'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.avatars.length > 5) {
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

    const avatar = this.avatarsRepository.create({
      id: fileName,
      isActive: user?.avatars?.length ? false : true,
      user,
    });
    return this.avatarsRepository.save(avatar);
  }

  async deleteAvatar(login: string, avatarId: string) {
    const avatar = await this.avatarsRepository.findOne({
      where: { id: avatarId },
      relations: ['user'],
    });
    if (!avatar) {
      throw new NotFoundException('Avatar not found');
    }
    if (avatar.user.login !== login) {
      throw new ForbiddenException('You are not allowed to delete this avatar');
    }

    await this.fileService.removeFile({
      path: `${this.avatarFolder}/${avatar.id}`,
    });

    return await this.avatarsRepository.remove(avatar);
  }
}

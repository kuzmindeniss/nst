import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
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

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  findAll() {
    return this.usersRepository.find();
  }

  paginate(options: SearchQueryDto) {
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
}

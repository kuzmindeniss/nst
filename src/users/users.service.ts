import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { RegisterDto } from './dto/register.dto';
import { IPaginationOptions, paginate } from 'nestjs-typeorm-paginate';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  findAll() {
    return this.usersRepository.find();
  }

  paginate(options: IPaginationOptions) {
    return paginate(this.usersRepository, options);
  }

  findOne(login: string) {
    return this.usersRepository.findOneBy({ login });
  }

  async register({
    login,
    email,
    password,
    age,
    description,
  }: RegisterDto): Promise<User> {
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

    return this.usersRepository.save(user);
  }
}

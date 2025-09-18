import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOneOptions, Repository } from 'typeorm';
import { User } from '../user.entity';
import { SearchQueryDto } from '../dto/search.dto';
import { paginate } from 'nestjs-typeorm-paginate';
import { plainToInstance } from 'class-transformer';
import { UserResponseDto } from '../dto/user.dto';
import { IsolationLevel, Transactional } from 'typeorm-transactional';
import { TransferDto } from 'src/balance/dto/transfer.dto';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<User[]> {
    return this.repository.find();
  }

  async findByLogin({
    login,
    relations,
  }: {
    login: string;
    relations?: FindOneOptions<User>['relations'];
  }): Promise<User | null> {
    return this.repository.findOne({
      where: { login },
      relations,
    });
  }

  async findByEmail({ email }: { email: string }): Promise<User | null> {
    return this.repository.findOneBy({ email });
  }

  async save(user: User): Promise<User> {
    return this.repository.save(user);
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = this.repository.create(userData);
    return this.repository.save(user);
  }

  async remove(user: User): Promise<User> {
    return this.repository.remove(user);
  }

  async findWithPagination({ limit, page, login }: SearchQueryDto) {
    const queryBuilder = this.repository.createQueryBuilder('user');

    if (login && login.trim().length > 0) {
      queryBuilder.where('user.login = :login', { login });
    }

    const res = await paginate<User>(queryBuilder, { page, limit });

    return {
      ...res,
      items: res.items.map((user) =>
        plainToInstance(UserResponseDto, user, {
          excludeExtraneousValues: true,
        }),
      ),
    };
  }

  @Transactional({ isolationLevel: IsolationLevel.REPEATABLE_READ })
  async transfer({ from, to, amount }: TransferDto) {
    const fromUser = await this.findByLogin({ login: from });
    const toUser = await this.findByLogin({ login: to });

    if (!fromUser) {
      throw new NotFoundException(`User with login ${from} not found`);
    }

    if (!toUser) {
      throw new NotFoundException(`User with login ${to} not found`);
    }

    const fromUserBalance = Number(fromUser.balance);
    if (fromUserBalance < amount) {
      throw new BadRequestException(
        `Insufficient funds. Available: $${fromUserBalance.toFixed(2)}, Required: $${amount.toFixed(2)}`,
      );
    }

    fromUser.balance = Number((fromUserBalance - amount).toFixed(2));
    toUser.balance = Number((Number(toUser.balance) + amount).toFixed(2));

    await this.repository.save([fromUser, toUser]);

    return {
      fromUser,
      toUser,
      transferredAmount: amount,
    };
  }

  @Transactional({ isolationLevel: IsolationLevel.READ_UNCOMMITTED })
  async resetBalance() {
    return await this.dataSource
      .createQueryBuilder()
      .update(User)
      .set({ balance: 0 })
      .execute();
  }
}

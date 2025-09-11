import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TransferDto } from './dto/transfer.dto';
import { Transactional } from 'typeorm-transactional';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  @Transactional()
  async transfer(transferDto: TransferDto) {
    const { from, to, amount } = transferDto;

    if (from === to) {
      throw new BadRequestException('Cannot transfer money to yourself');
    }

    const [user1Login, user2Login] = [from, to].sort();

    const user1 = await this.usersRepo
      .createQueryBuilder('user')
      .where('user.login = :login', { login: user1Login })
      .setLock('pessimistic_write')
      .getOne();

    const user2 = await this.usersRepo
      .createQueryBuilder('user')
      .where('user.login = :login', { login: user2Login })
      .setLock('pessimistic_write')
      .getOne();

    const fromUser = user1Login === from ? user1 : user2;
    const toUser = user1Login === to ? user1 : user2;

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

    await this.usersRepo.save([fromUser, toUser]);

    return {
      fromUser,
      toUser,
      transferredAmount: amount,
    };
  }
}

import { Module } from '@nestjs/common';
import { BalanceResetController } from './balance-reset.controller';
import { BalanceResetService } from './balance-reset.service';
import { User } from 'src/users/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { BalanceResetConsumer } from './balance-reset.consumer';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    BullModule.registerQueue({
      name: 'reset-balance',
    }),
  ],
  controllers: [BalanceResetController],
  providers: [BalanceResetService, BalanceResetConsumer],
})
export class BalanceResetModule {}

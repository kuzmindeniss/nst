import { Module } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { BalanceController } from './balance.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/user.entity';

@Module({
  providers: [BalanceService],
  controllers: [BalanceController],
  imports: [TypeOrmModule.forFeature([User])],
})
export class BalanceModule {}

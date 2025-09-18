import { Module } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { BalanceController } from './balance.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/user.entity';
import { UserRepository } from 'src/users/repositories/user.repository';

@Module({
  providers: [BalanceService, UserRepository],
  controllers: [BalanceController],
  imports: [TypeOrmModule.forFeature([User])],
})
export class BalanceModule {}

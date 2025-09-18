import { Controller, Post, UseGuards } from '@nestjs/common';
import { BalanceResetService } from './balance-reset.service';
import { AuthGuard } from 'src/users/guards/auth.guard';

@Controller('balance-reset')
export class BalanceResetController {
  constructor(private readonly balanceResetService: BalanceResetService) {}

  @Post()
  @UseGuards(AuthGuard)
  async resetAllBalances() {
    return this.balanceResetService.resetAllBalances();
  }
}

import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { AuthGuard } from 'src/users/guards/auth.guard';
import { TransferDto } from './dto/transfer.dto';

@Controller('balance')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Post('transfer')
  @UseGuards(AuthGuard)
  async transfer(@Body() transferDto: TransferDto) {
    return this.balanceService.transfer(transferDto);
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { TransferDto } from './dto/transfer.dto';
import { UserRepository } from 'src/users/repositories/user.repository';

@Injectable()
export class BalanceService {
  constructor(private readonly userRepository: UserRepository) {}

  async transfer(transferDto: TransferDto) {
    if (transferDto.from === transferDto.to) {
      throw new BadRequestException('Cannot transfer money to yourself');
    }

    return this.userRepository.transfer(transferDto);
  }
}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { UserRepository } from 'src/users/repositories/user.repository';

@Processor('reset-balance')
export class BalanceResetConsumer extends WorkerHost {
  private readonly logger = new Logger(BalanceResetConsumer.name);

  constructor(private userRepository: UserRepository) {
    super();
  }

  async process(): Promise<any> {
    this.logger.log('Starting reset balances job...');

    try {
      await this.userRepository.resetBalance();
      this.logger.log('Successfully reset all user balances');
    } catch (error) {
      this.logger.error('Error resetting balances:', error);
      throw error;
    }
  }
}

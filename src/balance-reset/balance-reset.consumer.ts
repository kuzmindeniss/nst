import { Processor, WorkerHost } from '@nestjs/bullmq';
import { User } from 'src/users/user.entity';
import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';

@Processor('reset-balance')
export class BalanceResetConsumer extends WorkerHost {
  private readonly logger = new Logger(BalanceResetConsumer.name);

  constructor(private dataSource: DataSource) {
    super();
  }

  async process(): Promise<any> {
    this.logger.log('Starting reset balances job...');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager
        .createQueryBuilder()
        .update(User)
        .set({ balance: 0 })
        .execute();

      await queryRunner.commitTransaction();
      this.logger.log('Successfully reset all user balances');
    } catch (error) {
      this.logger.error('Error resetting balances:', error);
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}

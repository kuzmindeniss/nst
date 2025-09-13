import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class BalanceResetService {
  private readonly logger = new Logger(BalanceResetService.name);

  constructor(
    @InjectQueue('reset-balance')
    private readonly resetBalanceQueue: Queue,
  ) {}

  async resetAllBalances(): Promise<{
    message: string;
    jobId: string | undefined;
  }> {
    this.logger.log('Adding reset balances job to queue...');

    const job = await this.resetBalanceQueue.add('reset-all-balances', {});

    return {
      message: 'Reset balances job has been queued successfully',
      jobId: job?.id?.toString(),
    };
  }
}

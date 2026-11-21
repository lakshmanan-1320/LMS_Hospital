import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';
import { RefundsRepository } from './refunds.repository';

@Module({
  imports: [DatabaseModule, OrdersModule, PaymentsModule],
  controllers: [RefundsController],
  providers: [RefundsService, RefundsRepository],
  exports: [RefundsService, RefundsRepository],
})
export class RefundsModule {}


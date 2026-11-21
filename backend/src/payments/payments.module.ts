import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CartModule } from '../cart/cart.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { RazorpayGatewayService } from './services/razorpay-gateway.service';

@Module({
  imports: [DatabaseModule, CartModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsRepository, RazorpayGatewayService],
  exports: [PaymentsService, PaymentsRepository, RazorpayGatewayService],
})
export class PaymentsModule {}


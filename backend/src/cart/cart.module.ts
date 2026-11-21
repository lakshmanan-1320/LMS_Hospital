import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CouponsModule } from '../coupons/coupons.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartRepository } from './cart.repository';

@Module({
  imports: [DatabaseModule, CouponsModule],
  controllers: [CartController],
  providers: [CartService, CartRepository],
  exports: [CartService, CartRepository],
})
export class CartModule {}


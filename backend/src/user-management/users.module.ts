
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';

import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
  ],
  controllers: [
    UsersController,
  ],
  providers: [
    UsersRepository,
    UsersService,
  ],
  exports: [
    UsersService,
    UsersRepository,
  ],
})
export class UsersModule {}

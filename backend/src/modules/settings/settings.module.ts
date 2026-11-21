import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SettingsRepository } from './settings.repository';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [SettingsController],
  providers: [SettingsRepository, SettingsService],
  exports: [SettingsRepository, SettingsService],
})
export class SettingsModule {}

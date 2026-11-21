import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService, STORAGE_PROVIDER } from './storage.service';
import { StorageProvider } from './storage.interface';
import { LocalStorageProvider } from './local/local-storage.provider';
import { AwsStorageProvider } from './aws/aws-storage.provider';

@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): StorageProvider => {
        const provider = configService.get<string>('storage.provider');

        if (provider === 's3') {
          return new AwsStorageProvider(configService);
        }

        return new LocalStorageProvider(configService);
      },
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}

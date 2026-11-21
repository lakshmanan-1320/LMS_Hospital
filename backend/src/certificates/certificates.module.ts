import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { StorageModule } from '../providers/storage/storage.module';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';
import { CertificatesRepository } from './certificates.repository';
import { PdfGeneratorService } from './pdf-generator.service';

@Module({
  imports: [DatabaseModule, StorageModule],
  controllers: [CertificatesController],
  providers: [
    CertificatesService,
    CertificatesRepository,
    PdfGeneratorService,
  ],
  exports: [CertificatesService, CertificatesRepository],
})
export class CertificatesModule {}

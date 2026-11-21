
import { Inject, Injectable } from '@nestjs/common';
import { StorageProvider, StorageRange } from './storage.interface';

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

@Injectable()
export class StorageService implements StorageProvider {
  constructor(
    @Inject(STORAGE_PROVIDER)
    private readonly provider: StorageProvider,
  ) {}

  get name(): 'local' | 's3' {
    return this.provider.name;
  }

  save(
    sourcePath: string,
    storageKey: string,
    contentType: string,
  ): Promise<void> {
    return this.provider.save(sourcePath, storageKey, contentType);
  }

  delete(storageKey: string): Promise<void> {
    return this.provider.delete(storageKey);
  }

  exists(storageKey: string): Promise<boolean> {
    return this.provider.exists(storageKey);
  }

  getReadStream(
    storageKey: string,
    range?: StorageRange,
  ) {
    return this.provider.getReadStream(storageKey, range);
  }

  getSignedUrl(
    storageKey: string,
    expiresInSeconds = 300,
  ): Promise<string> {
    if (!this.provider.getSignedUrl) {
      throw new Error(
        'Signed URLs are not supported by the active storage provider',
      );
    }

    return this.provider.getSignedUrl(storageKey, expiresInSeconds);
  }
}

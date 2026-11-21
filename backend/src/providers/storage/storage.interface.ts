
import { Readable } from 'stream';

export interface StorageRange {
  start: number;
  end: number;
}

export interface StorageProvider {
  readonly name: 'local' | 's3';

  save(
    sourcePath: string,
    storageKey: string,
    contentType: string,
  ): Promise<void>;

  delete(storageKey: string): Promise<void>;

  exists(storageKey: string): Promise<boolean>;

  getReadStream(
    storageKey: string,
    range?: StorageRange,
  ): Promise<Readable>;

  getSignedUrl?(
    storageKey: string,
    expiresInSeconds?: number,
  ): Promise<string>;
}

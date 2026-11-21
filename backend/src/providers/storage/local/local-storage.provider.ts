
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createReadStream,
  createWriteStream,
} from 'fs';
import {
  mkdir,
  unlink,
  access,
  lstat,
} from 'fs/promises';
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'path';
import { pipeline } from 'stream/promises';
import { StorageProvider, StorageRange } from '../storage.interface';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local' as const;

  private readonly root: string;

  constructor(private readonly configService: ConfigService) {
    this.root = resolve(
      this.configService.get<string>('storage.localRoot'),
    );
  }

  private resolveStoragePath(storageKey: string): string {
    if (
      !storageKey ||
      isAbsolute(storageKey) ||
      storageKey.includes('\0')
    ) {
      throw new BadRequestException('Invalid storage key');
    }

    const filePath = resolve(this.root, storageKey);
    const relativePath = relative(this.root, filePath);

    if (
      !relativePath ||
      relativePath === '..' ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath)
    ) {
      throw new BadRequestException('Invalid storage key');
    }

    return filePath;
  }

  async save(
    sourcePath: string,
    storageKey: string,
    _contentType: string,
  ): Promise<void> {
    const destination = this.resolveStoragePath(storageKey);

    await mkdir(dirname(destination), { recursive: true });

    await pipeline(
      createReadStream(sourcePath),
      createWriteStream(destination, { flags: 'wx' }),
    );
  }

  async delete(storageKey: string): Promise<void> {
    const filePath = this.resolveStoragePath(storageKey);

    try {
      const stats = await lstat(filePath);

      if (!stats.isFile()) {
        throw new BadRequestException('Storage key is not a file');
      }

      await unlink(filePath);
    } catch (error: any) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    const filePath = this.resolveStoragePath(storageKey);

    try {
      await access(filePath);
      const stats = await lstat(filePath);
      return stats.isFile();
    } catch (error: any) {
      if (error?.code === 'ENOENT') return false;
      throw error;
    }
  }

  async getReadStream(
    storageKey: string,
    range?: StorageRange,
  ) {
    const filePath = this.resolveStoragePath(storageKey);

    if (!(await this.exists(storageKey))) {
      throw new NotFoundException('Stored file not found');
    }

    if (
      range &&
      (!Number.isSafeInteger(range.start) ||
        !Number.isSafeInteger(range.end) ||
        range.start < 0 ||
        range.end < range.start)
    ) {
      throw new BadRequestException('Invalid storage byte range');
    }

    return createReadStream(
      filePath,
      range
        ? { start: range.start, end: range.end }
        : undefined,
    );
  }
}

import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { StorageProvider, StorageRange } from '../storage.interface';
@Injectable()
export class AwsStorageProvider implements StorageProvider {
  readonly name = 's3' as const;

  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    const aws = this.configService.get('storage.aws');

    this.bucket = aws.bucket;

    this.client = new S3Client({
      region: aws.region,
      credentials: {
        accessKeyId: aws.accessKeyId,
        secretAccessKey: aws.secretAccessKey,
      },
    });
  }

  async save(
    sourcePath: string,
    storageKey: string,
    contentType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: createReadStream(sourcePath),
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
      }),
    );
  }

  async delete(storageKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      }),
    );
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        }),
      );

      return true;
    } catch (error: any) {
      if (
        error?.name === 'NotFound' ||
        error?.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }

      throw error;
    }
  }

    async getReadStream(
    storageKey: string,
    range?: StorageRange,
  ): Promise<Readable> {
    if (
      range &&
      (!Number.isSafeInteger(range.start) ||
        !Number.isSafeInteger(range.end) ||
        range.start < 0 ||
        range.end < range.start)
    ) {
      throw new InternalServerErrorException(
        'Invalid storage byte range',
      );
    }

    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        ...(range
          ? { Range: `bytes=${range.start}-${range.end}` }
          : {}),
      }),
    );

    if (!response.Body) {
      throw new NotFoundException('Stored file not found');
    }

    return response.Body as Readable;
  }

  async getSignedUrl(
    storageKey: string,
    expiresInSeconds = 300,
  ): Promise<string> {
    if (
      !Number.isInteger(expiresInSeconds) ||
      expiresInSeconds < 1 ||
      expiresInSeconds > 900
    ) {
      throw new InternalServerErrorException(
        'Signed URL expiry must be between 1 and 900 seconds',
      );
    }

    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      }),
      { expiresIn: expiresInSeconds },
    );
  }
}

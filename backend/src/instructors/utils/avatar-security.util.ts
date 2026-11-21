import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export type DetectedImageType = 'jpg' | 'png' | 'webp';

/**
 * Validates image buffer using magic bytes (file signature sniffing).
 * Never trusts client-reported MIME type or extension.
 */
export function detectImageSignature(buffer: Buffer): DetectedImageType {
  if (!buffer || buffer.length < 12) {
    throw new BadRequestException('Uploaded file is empty or corrupted');
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  // WebP: RIFF (bytes 0-3) + WEBP (bytes 8-11)
  const isRiff =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46;
  const isWebp =
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;

  if (isRiff && isWebp) {
    return 'webp';
  }

  throw new BadRequestException(
    'Invalid file format. Only genuine JPEG, PNG, or WebP images are accepted.',
  );
}

/**
 * Generates a cryptographically random filename and saves file securely.
 * Checks for path traversal and returns relative public URL.
 */
export async function saveAvatarSecurely(
  buffer: Buffer,
  targetDir: string,
): Promise<{ filename: string; publicUrl: string }> {
  if (buffer.length > MAX_AVATAR_SIZE_BYTES) {
    throw new BadRequestException(
      `File size exceeds limit of ${MAX_AVATAR_SIZE_BYTES / (1024 * 1024)}MB`,
    );
  }

  const extension = detectImageSignature(buffer);
  const randomToken = crypto.randomBytes(16).toString('hex');
  const filename = `avatar-${Date.now()}-${randomToken}.${extension}`;

  const resolvedDir = path.resolve(targetDir);
  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true });
  }

  const destinationPath = path.resolve(resolvedDir, filename);

  // Path traversal guard
  if (!destinationPath.startsWith(resolvedDir)) {
    throw new BadRequestException('Invalid storage path detected');
  }

  await fs.promises.writeFile(destinationPath, buffer);

  return {
    filename,
    publicUrl: `/uploads/avatars/${filename}`,
  };
}


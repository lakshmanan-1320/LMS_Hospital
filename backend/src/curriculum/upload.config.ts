
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { diskStorage } from 'multer';
import { BadRequestException } from '@nestjs/common';

export const UPLOAD_ROOT = resolve(process.cwd(), 'storage', 'uploads');

mkdirSync(UPLOAD_ROOT, { recursive: true });

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

export const curriculumUploadOptions = {
  storage: diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, UPLOAD_ROOT);
    },
    filename: (_req, file, callback) => {
      const extension = file.originalname
        .split('.')
        .pop()
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, '');

      callback(
        null,
        `${Date.now()}-${require('crypto').randomUUID()}.${extension || 'bin'}`,
      );
    },
  }),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    const allowedMimeTypes = [
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return callback(
        new BadRequestException('Unsupported file type'),
        false,
      );
    }

    callback(null, true);
  },
};

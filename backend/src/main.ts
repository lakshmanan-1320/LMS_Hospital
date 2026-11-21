import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Cookie parser for reading HTTP-only refresh token cookies
  const cookieMiddleware = (cookieParser as any).default || cookieParser;
  app.use(cookieMiddleware());

  // Enable CORS with credentials for frontend interaction (supports localhost on any port e.g. 3000, 3001)
  const configuredOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);
      if (
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
        origin === configuredOrigin
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Static file serving for uploads (course thumbnails, avatars, etc.)
  const uploadsDir = path.join(process.cwd(), 'uploads');
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (_) {}
  app.use('/uploads', express.static(uploadsDir));

  // Strict Validation Pipe (Whitelist only, rejects extra properties like role)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global interceptors & filters
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Enable graceful shutdown hooks
  app.enableShutdownHooks();

  const port = process.env.PORT || 5001;
  await app.listen(port);
  logger.log(`LMS Backend running on: http://localhost:${port}`);
  logger.log(`Authentication endpoints mounted at: http://localhost:${port}/auth/*`);
  logger.log(`Health check ready at: http://localhost:${port}/health`);
}

bootstrap();

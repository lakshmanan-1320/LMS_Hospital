import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class HealthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async check() {
    const dbPing = await this.databaseService.ping();

    return {
      status: dbPing.ok ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        driver: 'pg (native node-postgres)',
        connected: dbPing.ok,
        latencyMs: dbPing.latencyMs,
        ...(dbPing.error ? { error: dbPing.error } : {}),
      },
      environment: process.env.NODE_ENV || 'development',
    };
  }
}


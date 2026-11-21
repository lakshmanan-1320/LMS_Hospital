import {
  Injectable,
  Inject,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { PG_POOL } from './database.tokens';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Execute a direct parameterized SQL query against the connection pool.
   * Strictly no ORM.
   */
  async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const res = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      this.logger.debug(`Executed query: ${text.slice(0, 100)}... in ${duration}ms (rows: ${res.rowCount})`);
      return res;
    } catch (error) {
      this.logger.error(`Query failed: ${text.slice(0, 100)}... - ${error.message}`);
      throw error;
    }
  }

  /**
   * Alias for query - execute a direct parameterized SQL query against the connection pool.
   */
  async executeQuery<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
  ): Promise<QueryResult<T>> {
    return this.query<T>(text, params);
  }

  /**
   * Acquire a dedicated client from the pool for manual workflows.
   * Remember to release() after use!
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Execute a series of queries atomically within a transaction block.
   * Automatically executes BEGIN, COMMIT, or ROLLBACK upon failure.
   */
  async withTransaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Transaction rolled back due to error: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Ping database to verify connectivity and measure latency.
   */
  async ping(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      await this.pool.query('SELECT 1 AS ping');
      return {
        ok: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: error.message,
      };
    }
  }

  /**
   * Close all pooled connections when the application terminates.
   */
  async onApplicationShutdown(signal?: string) {
    this.logger.log(`Closing PostgreSQL pool on signal: ${signal || 'shutdown'}`);
    await this.pool.end();
  }
}


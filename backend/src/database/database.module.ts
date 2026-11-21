import { Global, Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PG_POOL } from './database.tokens';
import { DatabaseService } from './database.service';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('DatabasePool');
        const dbConfig = configService.get('database');

        const pool = new Pool(dbConfig);

        pool.on('error', (err) => {
          logger.error('Unexpected error on idle PostgreSQL client', err.stack);
        });

        logger.log(
          `PostgreSQL pool initialized -> ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database} (max: ${dbConfig.max})`,
        );

        return pool;
      },
    },
    DatabaseService,
  ],
  exports: [PG_POOL, DatabaseService],
})
export class DatabaseModule {}


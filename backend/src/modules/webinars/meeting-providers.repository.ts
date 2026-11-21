import { Injectable, Inject, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface MeetingProviderAccountEntity {
  account_id: string;
  provider: string;
  account_email: string;
  account_name?: string;
  access_token?: string;
  refresh_token: string;
  token_expires_at?: Date;
  scope?: string;
  credentials?: Record<string, any>;
  provider_metadata?: Record<string, any>;
  is_active: boolean;
  is_default: boolean;
  connected_by?: string;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class MeetingProvidersRepository {
  private readonly logger = new Logger(MeetingProvidersRepository.name);

  constructor(@Inject(DatabaseService) private readonly databaseService: DatabaseService) {}

  /**
   * Find active connected account for a provider.
   */
  async findActiveAccount(provider: string): Promise<MeetingProviderAccountEntity | null> {
    const query = `
      SELECT *
      FROM meeting_provider_accounts
      WHERE provider = $1 AND is_active = TRUE
      ORDER BY is_default DESC, updated_at DESC
      LIMIT 1;
    `;
    const res = await this.databaseService.query<MeetingProviderAccountEntity>(query, [provider]);
    return res.rows[0] || null;
  }

  /**
   * Upsert a meeting provider account connection.
   */
  async upsertAccount(data: {
    provider: string;
    accountEmail: string;
    accountName?: string;
    accessToken?: string;
    refreshToken: string;
    tokenExpiresAt?: Date;
    scope?: string;
    credentials?: Record<string, any>;
    providerMetadata?: Record<string, any>;
    connectedBy?: string;
  }): Promise<MeetingProviderAccountEntity> {
    const query = `
      INSERT INTO meeting_provider_accounts (
        provider,
        account_email,
        account_name,
        access_token,
        refresh_token,
        token_expires_at,
        scope,
        credentials,
        provider_metadata,
        is_active,
        is_default,
        connected_by,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, TRUE, $10, CURRENT_TIMESTAMP)
      ON CONFLICT (provider, account_email) DO UPDATE
      SET access_token = COALESCE(EXCLUDED.access_token, meeting_provider_accounts.access_token),
          refresh_token = COALESCE(EXCLUDED.refresh_token, meeting_provider_accounts.refresh_token),
          token_expires_at = COALESCE(EXCLUDED.token_expires_at, meeting_provider_accounts.token_expires_at),
          scope = COALESCE(EXCLUDED.scope, meeting_provider_accounts.scope),
          account_name = COALESCE(EXCLUDED.account_name, meeting_provider_accounts.account_name),
          credentials = COALESCE(EXCLUDED.credentials, meeting_provider_accounts.credentials),
          provider_metadata = COALESCE(EXCLUDED.provider_metadata, meeting_provider_accounts.provider_metadata),
          is_active = TRUE,
          connected_by = COALESCE(EXCLUDED.connected_by, meeting_provider_accounts.connected_by),
          updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const res = await this.databaseService.query<MeetingProviderAccountEntity>(query, [
      data.provider,
      data.accountEmail.toLowerCase().trim(),
      data.accountName || null,
      data.accessToken || null,
      data.refreshToken,
      data.tokenExpiresAt || null,
      data.scope || null,
      JSON.stringify(data.credentials || {}),
      JSON.stringify(data.providerMetadata || {}),
      data.connectedBy || null,
    ]);

    return res.rows[0];
  }

  /**
   * Update transient access token.
   */
  async updateAccessToken(accountId: string, accessToken: string, expiresAt: Date): Promise<void> {
    const query = `
      UPDATE meeting_provider_accounts
      SET access_token = $1,
          token_expires_at = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE account_id = $3;
    `;
    await this.databaseService.query(query, [accessToken, expiresAt, accountId]);
  }

  /**
   * Disconnect an account.
   */
  async disconnectAccount(provider: string, accountId?: string): Promise<boolean> {
    let query = `
      UPDATE meeting_provider_accounts
      SET is_active = FALSE,
          updated_at = CURRENT_TIMESTAMP
      WHERE provider = $1
    `;
    const params: any[] = [provider];

    if (accountId) {
      query += ` AND account_id = $2;`;
      params.push(accountId);
    } else {
      query += `;`;
    }

    const res = await this.databaseService.query(query, params);
    return (res.rowCount || 0) > 0;
  }
}

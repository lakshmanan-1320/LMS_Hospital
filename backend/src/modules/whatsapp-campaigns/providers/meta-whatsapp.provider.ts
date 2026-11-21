import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { decryptSecret } from '../utils/whatsapp-secret-box';
import { WhatsappConfigRecord } from '../interfaces/whatsapp-campaign.interfaces';

@Injectable()
export class MetaWhatsappProvider {
  private readonly logger = new Logger(MetaWhatsappProvider.name);

  async validateConnection(config: WhatsappConfigRecord): Promise<{
    valid: boolean;
    displayPhoneNumber?: string;
    verifiedName?: string;
    qualityRating?: string;
    error?: string;
  }> {
    const accessToken = decryptSecret(config.access_token_encrypted);
    if (!accessToken) {
      throw new BadRequestException('Access token is missing or corrupted.');
    }

    const version = config.graph_version || 'v26.0';
    const url = `https://graph.facebook.com/${version}/${encodeURIComponent(
      config.phone_number_id,
    )}?fields=display_phone_number,verified_name,code_verification_status,quality_rating`;

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          valid: false,
          error: data.error?.message || 'Meta Cloud API validation failed.',
        };
      }

      return {
        valid: true,
        displayPhoneNumber: data.display_phone_number || config.display_phone_number || '',
        verifiedName: data.verified_name || config.business_name || '',
        qualityRating: data.quality_rating || 'UNKNOWN',
      };
    } catch (err: any) {
      this.logger.error(`Meta Cloud API connection error: ${err.message}`);
      return {
        valid: false,
        error: err.message || 'Network error reaching Meta Cloud API.',
      };
    }
  }

  async fetchTemplates(config: WhatsappConfigRecord): Promise<any[]> {
    const accessToken = decryptSecret(config.access_token_encrypted);
    if (!accessToken) {
      throw new BadRequestException('Access token is missing or corrupted.');
    }

    const version = config.graph_version || 'v26.0';
    const url = new URL(
      `https://graph.facebook.com/${version}/${encodeURIComponent(
        config.waba_id,
      )}/message_templates`,
    );
    url.searchParams.set(
      'fields',
      'id,name,status,language,category,components,rejected_reason',
    );
    url.searchParams.set('limit', '100');

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new BadRequestException(
        data.error?.message || 'Failed to fetch WhatsApp templates from Meta.',
      );
    }

    return data.data || [];
  }

  async sendTemplateMessage(
    config: WhatsappConfigRecord,
    toPhone: string,
    templateName: string,
    language: string,
    parameters: string[] = [],
  ): Promise<{ messageId: string }> {
    const accessToken = decryptSecret(config.access_token_encrypted);
    if (!accessToken) {
      throw new BadRequestException('Access token is missing or corrupted.');
    }

    const version = config.graph_version || 'v26.0';
    const targetRecipient = config.redirect_to ? config.redirect_to.trim() : toPhone.trim();

    const templatePayload: any = {
      name: templateName,
      language: { code: language || 'en_US' },
    };

    if (parameters.length > 0) {
      templatePayload.components = [
        {
          type: 'body',
          parameters: parameters.map((val) => ({
            type: 'text',
            text: String(val || ''),
          })),
        },
      ];
    }

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: targetRecipient,
      type: 'template',
      template: templatePayload,
    };

    const url = `https://graph.facebook.com/${version}/${encodeURIComponent(
      config.phone_number_id,
    )}/messages`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      const errMsg = data.error?.message || 'Meta Cloud API rejected template message.';
      this.logger.error(`Send error for ${targetRecipient}: ${errMsg}`, JSON.stringify(data));
      throw new BadRequestException(errMsg);
    }

    const messageId = data.messages?.[0]?.id || `wa_meta_${Date.now()}`;
    return { messageId };
  }
}


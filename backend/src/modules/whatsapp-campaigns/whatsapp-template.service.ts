import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { WhatsappCampaignsRepository } from './whatsapp-campaigns.repository';
import { MetaWhatsappProvider } from './providers/meta-whatsapp.provider';
import { extractTemplateVariableNumbers } from './utils/whatsapp.utils';
import { WhatsappTemplateRecord } from './interfaces/whatsapp-campaign.interfaces';

@Injectable()
export class WhatsappTemplateService {
  private readonly logger = new Logger(WhatsappTemplateService.name);

  constructor(
    @Inject(WhatsappCampaignsRepository)
    private readonly repository: WhatsappCampaignsRepository,
    @Inject(MetaWhatsappProvider)
    private readonly metaProvider: MetaWhatsappProvider,
  ) {}

  async listTemplates(activeOnly = false): Promise<WhatsappTemplateRecord[]> {
    return this.repository.listTemplates(activeOnly);
  }

  async syncMetaTemplates(): Promise<{
    synced: number;
    templates: WhatsappTemplateRecord[];
  }> {
    const config = await this.repository.findConfig();
    if (!config || !config.waba_id) {
      throw new BadRequestException(
        'WhatsApp Business Account is not configured. Please complete setup in WhatsApp Gateway Settings first.',
      );
    }

    this.logger.log(`Syncing templates from Meta Cloud API for WABA: ${config.waba_id}...`);
    const metaTemplates = await this.metaProvider.fetchTemplates(config);

    const savedTemplates: WhatsappTemplateRecord[] = [];

    for (const mt of metaTemplates) {
      const components = mt.components || [];
      const bodyComp = components.find((c: any) => c.type === 'BODY') || {};
      const bodyText = bodyComp.text || '';
      const varNums = extractTemplateVariableNumbers(bodyText);
      const variables = varNums.map((n) => String(n));

      const record = await this.repository.upsertTemplate({
        meta_template_id: mt.id,
        name: mt.name,
        language: mt.language || 'en_US',
        category: mt.category || 'UTILITY',
        status: mt.status || 'APPROVED',
        body_text: bodyText,
        components,
        variables,
        rejected_reason: mt.rejected_reason || null,
      });

      savedTemplates.push(record);
    }

    this.logger.log(`Successfully synced ${savedTemplates.length} templates from Meta.`);
    return {
      synced: savedTemplates.length,
      templates: savedTemplates,
    };
  }
}


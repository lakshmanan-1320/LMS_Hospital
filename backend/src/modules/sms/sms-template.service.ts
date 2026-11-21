import { Injectable, Inject, BadRequestException, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { SmsRepository } from './sms.repository';
import { SmsProviderFactory } from './providers/sms-provider.factory';
import { SmsTemplateEntity, TemplateVariable } from './interfaces/sms.interface';
import { extractVariables, humanizeKey, guessSource, renderTemplate, VARIABLE_SOURCES } from './utils/sms.utils';
import { decryptSecret } from './utils/secret-box';

@Injectable()
export class SmsTemplateService {
  private readonly logger = new Logger(SmsTemplateService.name);

  constructor(
    @Inject(SmsRepository) private readonly smsRepository: SmsRepository,
    @Inject(SmsProviderFactory) private readonly providerFactory: SmsProviderFactory,
  ) {}

  async listTemplates(activeOnly: boolean = false): Promise<SmsTemplateEntity[]> {
    return this.smsRepository.listTemplates(activeOnly);
  }

  async getTemplateById(templateId: string): Promise<SmsTemplateEntity> {
    const template = await this.smsRepository.findTemplateById(templateId);
    if (!template) {
      throw new NotFoundException(`SMS Template with ID '${templateId}' not found.`);
    }
    return template;
  }

  getVariableSources() {
    return VARIABLE_SOURCES;
  }

  async createTemplate(data: {
    providerTemplateId?: string;
    dltTemplateId?: string;
    name: string;
    category?: string;
    body: string;
    variables?: TemplateVariable[];
    userId?: string;
  }): Promise<SmsTemplateEntity> {
    if (!data.name || !data.name.trim()) {
      throw new BadRequestException('Template name is required.');
    }
    if (!data.body || !data.body.trim()) {
      throw new BadRequestException('Template body is required.');
    }

    const config = await this.smsRepository.findConfig();
    let providerTemplateId = data.providerTemplateId?.trim() || '';

    // If no providerTemplateId provided, generate one or create via MSG91
    if (!providerTemplateId) {
      if (config && config.status === 'active') {
        try {
          const provider = this.providerFactory.getProvider(config.provider_key);
          const creds = JSON.parse(decryptSecret(config.credentials_encrypted) || '{}');
          if (typeof provider.createTemplate === 'function') {
            const created = await provider.createTemplate(creds, {
              name: data.name,
              body: data.body,
              senderId: config.sender_id,
              dltTemplateId: data.dltTemplateId,
            });
            providerTemplateId = created.providerTemplateId;
          }
        } catch (err: any) {
          this.logger.warn(`Could not register template directly on provider: ${err.message}`);
          providerTemplateId = `tpl_${Date.now().toString(36)}`;
        }
      } else {
        providerTemplateId = `tpl_${Date.now().toString(36)}`;
      }
    }

    const duplicate = await this.smsRepository.findTemplateByProviderId(providerTemplateId);
    if (duplicate) {
      throw new ConflictException(`Template with Provider Template ID '${providerTemplateId}' already exists.`);
    }

    // Extract variables and auto-generate default mapping
    const extractedKeys = extractVariables(data.body);
    const existingVariablesMap = new Map((data.variables || []).map((v) => [v.key, v]));
    const finalVariables: TemplateVariable[] = extractedKeys.map((key) => {
      const existing = existingVariablesMap.get(key);
      return {
        key,
        label: existing?.label || humanizeKey(key),
        mapTo: existing?.mapTo || guessSource(key),
      };
    });

    return this.smsRepository.createTemplate({
      providerTemplateId,
      dltTemplateId: data.dltTemplateId || null,
      name: data.name.trim(),
      category: data.category || 'transactional',
      body: data.body,
      variables: finalVariables,
      isActive: true,
      createdBy: data.userId || null,
    });
  }

  async updateTemplate(
    templateId: string,
    data: {
      name?: string;
      body?: string;
      dltTemplateId?: string | null;
      category?: string;
      variables?: TemplateVariable[];
      isActive?: boolean;
    },
  ): Promise<SmsTemplateEntity> {
    const current = await this.getTemplateById(templateId);

    let finalVariables = data.variables;
    if (data.body && data.body !== current.body) {
      const keys = extractVariables(data.body);
      const existingMap = new Map((data.variables || current.variables || []).map((v) => [v.key, v]));
      finalVariables = keys.map((key) => existingMap.get(key) || { key, label: humanizeKey(key), mapTo: guessSource(key) });
    }

    const updated = await this.smsRepository.updateTemplate(templateId, {
      ...data,
      variables: finalVariables,
    });
    if (!updated) {
      throw new NotFoundException(`Template with ID '${templateId}' not found.`);
    }
    return updated;
  }

  async deleteTemplate(templateId: string): Promise<{ success: boolean }> {
    await this.getTemplateById(templateId);
    await this.smsRepository.deleteTemplate(templateId);
    return { success: true };
  }

  previewRender(body: string, sampleValues: Record<string, any>): string {
    return renderTemplate(body, sampleValues);
  }
}

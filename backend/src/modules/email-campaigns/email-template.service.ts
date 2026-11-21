import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EmailCampaignsRepository } from './email-campaigns.repository';
import {
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
} from './dto/email-campaign.dto';
import {
  extractEmailVariables,
  STARTER_EMAIL_TEMPLATES,
} from './utils/email-template.utils';

@Injectable()
export class EmailTemplateService {
  private readonly logger = new Logger(EmailTemplateService.name);

  constructor(
    @Inject(EmailCampaignsRepository)
    private readonly repo: EmailCampaignsRepository,
  ) {}

  async listTemplates(activeOnly = false) {
    let templates = await this.repo.getTemplates(activeOnly);

    // Auto-seed starter templates on first load if table is completely empty
    if (templates.length === 0) {
      this.logger.log('Seeding starter responsive email templates...');
      for (const starter of STARTER_EMAIL_TEMPLATES) {
        const vars = extractEmailVariables(starter.html_content);
        await this.repo.createTemplate({
          name: starter.name,
          subject: starter.subject,
          preview_text: starter.preview_text,
          category: starter.category,
          html_content: starter.html_content,
          variables: vars,
        });
      }
      templates = await this.repo.getTemplates(activeOnly);
    }

    return templates;
  }

  async getTemplate(id: string) {
    const template = await this.repo.getTemplateById(id);
    if (!template) {
      throw new NotFoundException(`Email template with ID '${id}' not found`);
    }
    return template;
  }

  async createTemplate(dto: CreateEmailTemplateDto, userId?: string) {
    const extractedVars = extractEmailVariables(dto.html_content);
    const combinedVars = Array.from(new Set([...(dto.variables || []), ...extractedVars]));

    return this.repo.createTemplate({
      name: dto.name,
      subject: dto.subject,
      preview_text: dto.preview_text,
      category: dto.category,
      html_content: dto.html_content,
      plain_text: dto.plain_text,
      variables: combinedVars,
      userId,
    });
  }

  async updateTemplate(id: string, dto: UpdateEmailTemplateDto) {
    const existing = await this.getTemplate(id);

    let variables: string[] | undefined = undefined;
    if (dto.html_content) {
      variables = extractEmailVariables(dto.html_content);
    }

    const updated = await this.repo.updateTemplate(id, {
      ...dto,
      variables,
    });

    if (!updated) {
      throw new NotFoundException(`Email template with ID '${id}' not found`);
    }
    return updated;
  }

  async deleteTemplate(id: string) {
    await this.getTemplate(id);
    const success = await this.repo.deleteTemplate(id);
    if (!success) {
      throw new BadRequestException(`Failed to remove template '${id}'`);
    }
    return { success: true, message: 'Template removed successfully' };
  }

  getStarterPresets() {
    return STARTER_EMAIL_TEMPLATES;
  }
}

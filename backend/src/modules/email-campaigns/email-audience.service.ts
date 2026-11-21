import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { EmailCampaignsRepository } from './email-campaigns.repository';
import { EmailRecipient, EmailTargetType } from './interfaces/email-campaign.interfaces';

@Injectable()
export class EmailAudienceService {
  constructor(
    @Inject(EmailCampaignsRepository)
    private readonly repo: EmailCampaignsRepository,
  ) {}

  async getAudienceCount(
    targetType: EmailTargetType,
    customRecipients?: { email: string; name?: string }[],
  ): Promise<number> {
    if (targetType === 'custom_list') {
      return customRecipients ? customRecipients.length : 0;
    }
    return this.repo.getAudienceCount(targetType);
  }

  async resolveRecipients(
    targetType: EmailTargetType,
    customRecipients?: { email: string; name?: string; variables?: Record<string, any> }[],
  ): Promise<EmailRecipient[]> {
    if (targetType === 'custom_list') {
      if (!customRecipients || customRecipients.length === 0) {
        throw new BadRequestException('Custom recipients list cannot be empty.');
      }

      // Deduplicate by lowercase email and validate
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const seen = new Set<string>();
      const resolved: EmailRecipient[] = [];

      for (const item of customRecipients) {
        const email = String(item.email || '').trim().toLowerCase();
        if (emailRegex.test(email) && !seen.has(email)) {
          seen.add(email);
          const name = item.name ? String(item.name).trim() : 'Learner';
          resolved.push({
            email,
            name,
            variables: {
              email,
              name,
              first_name: name.split(' ')[0] || 'Learner',
              current_year: new Date().getFullYear().toString(),
              ...(item.variables || {}),
            },
          });
        }
      }

      return resolved;
    }

    return this.repo.getAudienceRecipients(targetType);
  }
}

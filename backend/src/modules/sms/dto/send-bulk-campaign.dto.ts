export interface CustomSmsRecipientDto {
  mobile: string;
  name?: string;
  variables?: Record<string, string>;
}

export class SendBulkCampaignDto {
  campaignName: string;
  templateId: string; // Strictly required!
  targetType: 'webinar_registrants' | 'course_students' | 'custom_list';
  targetId?: string;
  customVariables?: Record<string, string>;
  customRecipients?: CustomSmsRecipientDto[];
  includedPhoneNumbers?: string[];
  countryCodeFilter?: string;
}



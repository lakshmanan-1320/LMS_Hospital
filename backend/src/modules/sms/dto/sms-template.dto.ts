import { TemplateVariable } from '../interfaces/sms.interface';

export class CreateSmsTemplateDto {
  providerTemplateId?: string;
  dltTemplateId?: string;
  name: string;
  category?: string;
  body: string;
  variables?: TemplateVariable[];
}

export class UpdateSmsTemplateDto {
  name?: string;
  body?: string;
  dltTemplateId?: string;
  category?: string;
  variables?: TemplateVariable[];
  isActive?: boolean;
}


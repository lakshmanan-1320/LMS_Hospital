import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaveWhatsappConfigDto {
  @IsString()
  @IsNotEmpty()
  app_id: string;

  @IsString()
  @IsOptional()
  app_secret?: string; // If omitted on update, retains existing secret

  @IsString()
  @IsNotEmpty()
  waba_id: string; // WhatsApp Business Account ID

  @IsString()
  @IsNotEmpty()
  phone_number_id: string; // Meta Phone Number ID (e.g. 1069...)

  @IsString()
  @IsOptional()
  display_phone_number?: string;

  @IsString()
  @IsOptional()
  business_name?: string;

  @IsString()
  @IsOptional()
  access_token?: string; // System User permanent token

  @IsString()
  @IsOptional()
  webhook_verify_token?: string;

  @IsString()
  @IsOptional()
  graph_version?: string; // Default v26.0

  @IsOptional()
  @IsString()
  redirect_to?: string; // Test phone number
}

export class TestWhatsappGatewayDto {
  @IsString()
  @IsNotEmpty()
  to_phone: string;

  @IsOptional()
  @IsString()
  template_name?: string;

  @IsOptional()
  @IsString()
  custom_message?: string;
}

export class CustomWhatsappRecipientDto {
  @IsString()
  @IsNotEmpty()
  mobile: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  variables?: Record<string, string>; // Maps "1": "Value", "2": "Value"
}

export class SendBulkWhatsappDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  template_name: string;

  @IsString()
  @IsOptional()
  language?: string; // Default en_US

  @IsIn(['webinar_registrants', 'course_students', 'all_users', 'custom_list'])
  target_type: 'webinar_registrants' | 'course_students' | 'all_users' | 'custom_list';

  @IsOptional()
  @IsString()
  target_id?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomWhatsappRecipientDto)
  custom_recipients?: CustomWhatsappRecipientDto[];

  @IsOptional()
  custom_variables?: Record<string, string>;
}


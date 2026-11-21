import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsEmail,
  IsIn,
  IsArray,
  IsBoolean,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaveEmailConfigDto {
  @IsString()
  @IsNotEmpty()
  host: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @IsIn(['ssl', 'tls', 'none'])
  encryption: 'ssl' | 'tls' | 'none';

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsOptional()
  password?: string; // If omitted on update, retains existing encrypted password

  @IsString()
  @IsNotEmpty()
  from_name: string;

  @IsEmail()
  from_email: string;

  @IsOptional()
  @IsString()
  redirect_to?: string;
}

export class TestEmailGatewayDto {
  @IsEmail()
  to_email: string;

  @IsOptional()
  @IsString()
  custom_message?: string;
}

export class CreateEmailTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsOptional()
  @IsString()
  preview_text?: string;

  @IsIn(['announcement', 'promotional', 'newsletter', 'transactional', 'alert'])
  category: 'announcement' | 'promotional' | 'newsletter' | 'transactional' | 'alert';

  @IsString()
  @IsNotEmpty()
  html_content: string;

  @IsOptional()
  @IsString()
  plain_text?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];
}

export class UpdateEmailTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  preview_text?: string;

  @IsOptional()
  @IsIn(['announcement', 'promotional', 'newsletter', 'transactional', 'alert'])
  category?: 'announcement' | 'promotional' | 'newsletter' | 'transactional' | 'alert';

  @IsOptional()
  @IsString()
  html_content?: string;

  @IsOptional()
  @IsString()
  plain_text?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class CustomRecipientDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  variables?: Record<string, any>;
}

export class SendBulkEmailDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  template_id: string;

  @IsIn(['students', 'instructors', 'all_users', 'custom_list'])
  target_type: 'students' | 'instructors' | 'all_users' | 'custom_list';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomRecipientDto)
  custom_recipients?: CustomRecipientDto[];

  @IsOptional()
  custom_variables?: Record<string, any>;
}


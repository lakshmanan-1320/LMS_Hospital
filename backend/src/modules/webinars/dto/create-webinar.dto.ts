import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsBoolean,
  IsArray,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WebinarProviderType, WebinarHostRole } from '../interfaces/webinar.interface';

export class CustomFieldDefinitionDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsEnum(['text', 'number', 'dropdown', 'checkbox'])
  type: 'text' | 'number' | 'dropdown' | 'checkbox';

  @IsBoolean()
  required: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}

export class WebinarHostAssignmentDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsEnum(['primary_host', 'co_host', 'moderator'])
  hostRole?: WebinarHostRole = 'primary_host';

  @IsOptional()
  @IsInt()
  displayOrder?: number = 0;
}

export class CreateWebinarDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsEnum(['google_meet', 'zoom', 'zoho'])
  provider?: WebinarProviderType = 'google_meet';

  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @IsDateString()
  @IsNotEmpty()
  endTime: string;

  @IsOptional()
  @IsString()
  timezone?: string = 'UTC';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  maxParticipants?: number = 100;

  @IsOptional()
  @IsBoolean()
  isPublicRegistration?: boolean = true;

  @IsOptional()
  @IsUUID()
  hostId?: string;

  @IsOptional()
  @IsString()
  hostEmail?: string;

  @IsOptional()
  @IsString()
  hostName?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WebinarHostAssignmentDto)
  hosts?: WebinarHostAssignmentDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomFieldDefinitionDto)
  customRegistrationFields?: CustomFieldDefinitionDto[] = [];
}


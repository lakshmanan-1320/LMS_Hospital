import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsArray,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CustomFieldDefinitionDto, WebinarHostAssignmentDto } from './create-webinar.dto';

export class UpdateWebinarDto {
  @IsOptional()
  @IsString()
  title?: string;

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
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  maxParticipants?: number;

  @IsOptional()
  @IsBoolean()
  isPublicRegistration?: boolean;

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
  customRegistrationFields?: CustomFieldDefinitionDto[];
}


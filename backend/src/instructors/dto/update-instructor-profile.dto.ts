import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  ArrayMaxSize,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { QualificationDto } from './qualification.dto';

/** Helper to clean, trim, and deduplicate string arrays case-insensitively */
function cleanAndDedupeArray(value: any): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      const lower = trimmed.toLowerCase();
      if (trimmed.length > 0 && !seen.has(lower)) {
        seen.add(lower);
        result.push(trimmed);
      }
    }
  }
  return result;
}

export class UpdateInstructorProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must contain only lowercase alphanumeric characters and single hyphens (e.g. jane-doe)',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  bio?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(70)
  experienceYears?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => QualificationDto)
  qualifications?: QualificationDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  @Transform(({ value }) => cleanAndDedupeArray(value))
  expertise?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  @Transform(({ value }) => cleanAndDedupeArray(value))
  skills?: string[];

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  websiteUrl?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  linkedinUrl?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  githubUrl?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  twitterUrl?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  youtubeUrl?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  facebookUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}


import { IsEmail, IsOptional, IsString, IsObject, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

// One decorator per field so each invalid field returns exactly one clear message.
// Matches() also fails for missing / non-string values, so it doubles as the "required" check.
// Name: 1–50 chars, letters (any language), spaces, apostrophes, dots, hyphens; starts with a letter.
const NAME_PATTERN = /^(?=.{1,50}$)\p{L}[\p{L}\p{M} .'-]*$/u;

export class RegisterWebinarDto {
  @Matches(NAME_PATTERN, {
    message: "First name is required: letters, spaces, ' . - only, up to 50 characters",
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  firstName: string;

  @Matches(NAME_PATTERN, {
    message: "Last name is required: letters, spaces, ' . - only, up to 50 characters",
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  lastName: string;

  @IsEmail({}, { message: 'A valid email address is required' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  // Required (matches the admin "Standard System Fields"). Spaces, dashes, dots and brackets are
  // stripped, then the number must be 7–15 digits with an optional leading "+" (E.164 length).
  @Matches(/^\+?[0-9]{7,15}$/, {
    message: 'A valid phone number is required (7–15 digits, optional + country code)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/[\s\-().]/g, '') : value))
  phoneNumber: string;

  @IsOptional()
  @IsObject()
  customFieldResponses?: Record<string, any>;

  // Optional traffic attribution (raw, never invented)
  @IsOptional()
  @IsString()
  utmSource?: string;

  @IsOptional()
  @IsString()
  utmMedium?: string;

  @IsOptional()
  @IsString()
  utmCampaign?: string;

  @IsOptional()
  @IsString()
  utmTerm?: string;

  @IsOptional()
  @IsString()
  utmContent?: string;

  @IsOptional()
  @IsString()
  referrer?: string;
}


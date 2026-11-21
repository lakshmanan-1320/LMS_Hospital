import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min, ValidateNested } from 'class-validator';

/** Bestseller: top X% of a category's courses by recent enrollments, with a minimum audience. */
export class BestsellerBadgeRuleDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  /** Look-back window for "recent" enrollments, in days. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) windowDays?: number;
  /** Top percentage of the category, by enrollments in the window. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) topPercent?: number;
  /** Minimum total students before a course can be a bestseller. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000000) minStudents?: number;
}

/** Highest rated: average rating at or above a threshold, with enough reviews. */
export class HighestRatedBadgeRuleDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 1 }) @Min(1) @Max(5) minRating?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000000) minReviews?: number;
}

/** New: published within the last N days. */
export class NewCourseBadgeRuleDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) withinDays?: number;
}

export class CourseBadgeSettingsDto {
  @IsOptional() @ValidateNested() @Type(() => BestsellerBadgeRuleDto) bestseller?: BestsellerBadgeRuleDto;
  @IsOptional() @ValidateNested() @Type(() => HighestRatedBadgeRuleDto) highestRated?: HighestRatedBadgeRuleDto;
  @IsOptional() @ValidateNested() @Type(() => NewCourseBadgeRuleDto) newCourse?: NewCourseBadgeRuleDto;
}

export interface CourseBadgeRules {
  bestseller: { enabled: boolean; windowDays: number; topPercent: number; minStudents: number };
  highestRated: { enabled: boolean; minRating: number; minReviews: number };
  newCourse: { enabled: boolean; withinDays: number };
}

export const DEFAULT_COURSE_BADGE_RULES: CourseBadgeRules = {
  bestseller: { enabled: true, windowDays: 90, topPercent: 10, minStudents: 25 },
  highestRated: { enabled: true, minRating: 4.5, minReviews: 10 },
  newCourse: { enabled: true, withinDays: 30 },
};

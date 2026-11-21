import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ModerateReviewDto {
  @IsNotEmpty({ message: 'Moderation status is required.' })
  @IsIn(['published', 'hidden', 'flagged'], {
    message: 'Status must be one of: published, hidden, flagged.',
  })
  status: 'published' | 'hidden' | 'flagged';

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Moderation reason cannot exceed 1000 characters.' })
  moderationReason?: string;
}

import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateProgressDto {
  @IsInt()
  @Min(0)
  positionSeconds: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @IsOptional()
  @IsString()
  sessionId?: string;
}

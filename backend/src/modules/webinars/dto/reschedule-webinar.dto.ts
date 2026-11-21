import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RescheduleWebinarDto {
  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @IsDateString()
  @IsNotEmpty()
  endTime: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}


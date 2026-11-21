import { IsUUID, IsNotEmpty, IsNumber, Min, IsString, IsOptional } from 'class-validator';

export class CorrectAttendanceDto {
  @IsUUID()
  @IsNotEmpty()
  webinarId: string;

  @IsUUID()
  @IsNotEmpty()
  webinarRegistrationId: string;

  @IsNumber()
  @Min(0)
  additionalSeconds: number;

  @IsString()
  @IsOptional()
  reason?: string;
}

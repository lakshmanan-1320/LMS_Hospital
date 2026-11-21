import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class JoinWebinarDto {
  @IsString()
  @IsNotEmpty()
  joinToken: string;
}

export class AttendanceIntervalDto {
  @IsString()
  @IsNotEmpty()
  webinarRegistrationId: string;

  @IsOptional()
  @IsString()
  attendanceId?: string;
}


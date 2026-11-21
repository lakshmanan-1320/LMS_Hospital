import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class RevokeCertificateDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5, { message: 'Revocation reason must be at least 5 characters long' })
  reason: string;
}

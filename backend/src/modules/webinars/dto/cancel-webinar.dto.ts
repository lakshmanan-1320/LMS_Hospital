import { IsNotEmpty, IsString } from 'class-validator';

export class CancelWebinarDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}


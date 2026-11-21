import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateVisibilityDto {
  @IsBoolean()
  @IsNotEmpty()
  isPublic: boolean;
}


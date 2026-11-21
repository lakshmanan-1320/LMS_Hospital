
import { IsBoolean } from 'class-validator';

export class UpdateUserStatusValidation {
  @IsBoolean()
  isActive: boolean;
}

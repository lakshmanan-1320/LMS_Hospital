import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordValidation {
  @IsString({ message: 'Token must be a string' })
  @IsNotEmpty({ message: 'Password reset token is required' })
  token: string;

  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  newPassword: string;
}


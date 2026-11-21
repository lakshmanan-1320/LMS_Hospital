import { IsUUID, IsNotEmpty } from 'class-validator';

export class AddToCartDto {
  @IsUUID('4', { message: 'courseId must be a valid UUID v4' })
  @IsNotEmpty({ message: 'courseId is required' })
  courseId: string;
}


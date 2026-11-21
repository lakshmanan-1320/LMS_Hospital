import { IsBoolean, IsNotEmpty } from 'class-validator';

export class FeaturedDto {
  @IsNotEmpty({ message: 'isFeatured is required' })
  @IsBoolean({ message: 'isFeatured must be a boolean' })
  isFeatured: boolean;
}


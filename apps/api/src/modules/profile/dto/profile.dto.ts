import { IsEmail } from 'class-validator';

export class UpdateProfileDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  email!: string;
}

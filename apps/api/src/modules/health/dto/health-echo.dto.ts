import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Diagnostic DTO used to verify HTTP boundary validation rules
 * without introducing business domain models.
 */
export class HealthEchoDto {
  @IsString()
  @IsNotEmpty()
  message!: string;
}

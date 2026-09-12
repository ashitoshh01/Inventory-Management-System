import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class UpdateOrganizationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateMembershipDto {
  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsUUID()
  roleId!: string;
}

export class UpdateMembershipDto {
  @IsUUID()
  @IsOptional()
  roleId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

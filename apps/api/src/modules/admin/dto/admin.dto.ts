import { IsString, IsEmail, IsOptional, IsBoolean, IsEnum, IsInt, Min, Max, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

// --- Pagination ---

export class AdminPaginationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// --- Organizations ---

export class AdminCreateOrganizationDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

export class AdminUpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// --- Users ---

export class AdminCreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  roleId?: string;
}

export class AdminUpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdminAddMembershipDto {
  @IsString()
  organizationId!: string;

  @IsString()
  roleId!: string;
}

export class AdminUpdateMembershipDto {
  @IsOptional()
  @IsString()
  roleId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// --- Account Requests ---

export class AdminCreateAccountRequestDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdminUpdateAccountRequestDto {
  @IsOptional()
  @IsEnum(['PENDING', 'CONTACTED', 'APPROVED', 'REJECTED', 'COMPLETED'])
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// --- Audit Filters ---

export class AdminAuditQueryDto extends AdminPaginationDto {
  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}

// --- Inventory Filters ---

export class AdminInventoryQueryDto extends AdminPaginationDto {
  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export interface UserDto {
  id: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationDto {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoleDto {
  id: string;
  name: string;
  description: string | null;
}

export interface OrganizationMembershipDto {
  id: string;
  userId: string;
  organizationId: string;
  role: RoleDto;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthMeResponse {
  user: UserDto;
  memberships: OrganizationMembershipDto[];
  activeOrganization: OrganizationDto | null;
}

export interface LoginResponse {
  user: UserDto;
  // Tokens are stored in HttpOnly cookies, not returned here.
}

export interface RegisterResponse {
  user: UserDto;
  organization: OrganizationDto;
}

export interface RegisterDto {
  email: string;
  password: string;
  organizationName: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

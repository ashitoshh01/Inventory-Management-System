import { apiClient } from './client';
import {
  LoginDto,
  LoginResponse,
  AuthMeResponse,
  ChangePasswordDto,
  UpdateProfileDto,
  ProfileResponse,
  UserDto,
} from '@repo/types';

export const authApi = {
  login: (data: LoginDto) =>
    apiClient<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: () =>
    apiClient<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    }),

  getMe: () =>
    apiClient<AuthMeResponse>('/auth/me', {
      method: 'GET',
    }),

  changePassword: (data: ChangePasswordDto) =>
    apiClient<{ success: boolean; user: UserDto }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getProfile: () =>
    apiClient<ProfileResponse>('/profile/me', {
      method: 'GET',
    }),

  updateProfile: (data: UpdateProfileDto) =>
    apiClient<{ user: UserDto }>('/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

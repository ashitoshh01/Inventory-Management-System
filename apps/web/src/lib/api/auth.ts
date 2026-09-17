import { apiClient } from './client';
import {
  LoginDto,
  LoginResponse,
  AuthMeResponse,
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
};

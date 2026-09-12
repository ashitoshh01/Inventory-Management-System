import { apiClient } from './client';
import { RegisterDto, LoginDto, RegisterResponse, LoginResponse, AuthMeResponse } from '@repo/types';

export const authApi = {
  register: (data: RegisterDto) => 
    apiClient<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

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

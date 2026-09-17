import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ForbiddenException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Partial<AuthService>;

  beforeEach(() => {
    authService = {
      login: jest.fn().mockResolvedValue({
        user: {
          id: 'user-1',
          email: 'test@example.com',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      }),
      register: jest.fn(), // Method still exists on the service
      refreshSession: jest.fn(),
      logout: jest.fn(),
      getMe: jest.fn(),
      changePassword: jest.fn().mockResolvedValue({
        user: {
          id: 'user-1',
          email: 'test@example.com',
          isActive: true,
          mustChangePassword: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      }),
    };

    // Directly instantiate the controller to avoid NestJS DI resolution issues
    controller = new AuthController(authService as AuthService);
  });

  describe('POST /auth/register', () => {
    it('should throw ForbiddenException for public registration', async () => {
      await expect(controller.register()).rejects.toThrow(ForbiddenException);
    });

    it('should return the correct error message', async () => {
      await expect(controller.register()).rejects.toThrow(
        'Public registration is disabled. Please contact the administrator to request an account.',
      );
    });

    it('should NOT call AuthService.register()', async () => {
      try {
        await controller.register();
      } catch {
        // Expected to throw
      }
      expect(authService.register).not.toHaveBeenCalled();
    });
  });

  describe('AuthService.register() preserved', () => {
    it('should still exist on the AuthService for admin use', () => {
      expect(authService.register).toBeDefined();
      expect(typeof authService.register).toBe('function');
    });
  });

  describe('POST /auth/login', () => {
    it('should call AuthService.login() and return user data', async () => {
      const mockRes = {
        cookie: jest.fn(),
      } as any;

      const dto = { email: 'test@example.com', password: 'password123' };
      const result = await controller.login(dto, mockRes);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should set accessToken and refreshToken cookies', async () => {
      const mockRes = {
        cookie: jest.fn(),
      } as any;

      const dto = { email: 'test@example.com', password: 'password123' };
      await controller.login(dto, mockRes);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'accessToken',
        'mock-access-token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'mock-refresh-token',
        expect.objectContaining({ httpOnly: true }),
      );
    });
  });

  describe('POST /auth/change-password', () => {
    it('should call AuthService.changePassword() and return success with user and updated cookies', async () => {
      const mockRes = {
        cookie: jest.fn(),
      } as any;

      const dto = {
        currentPassword: 'CurrentPassword123!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      };

      const result = await controller.changePassword({ id: 'user-1' }, dto, mockRes);

      expect(authService.changePassword).toHaveBeenCalledWith('user-1', dto);
      expect(result.success).toBe(true);
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.mustChangePassword).toBe(false);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'accessToken',
        'new-access-token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'new-refresh-token',
        expect.objectContaining({ httpOnly: true }),
      );
    });
  });
});

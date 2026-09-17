import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirstLoginPasswordModal } from '../first-login-password-modal';
import * as AuthContext from '../../providers/AuthProvider';
import { authApi } from '../../../lib/api/auth';
import { toast } from 'sonner';

vi.mock('../../../lib/api/auth', () => ({
  authApi: {
    changePassword: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('FirstLoginPasswordModal', () => {
  const mockRefreshUser = vi.fn();
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT render when user does NOT require password change (mustChangePassword: false)', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: {
        id: 'u1',
        email: 'user@stockministry.com',
        isActive: true,
        mustChangePassword: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      isLoading: false,
      isPlatformAdmin: false,
      memberships: null,
      activeOrganizationId: null,
      activeOrganization: null,
      activeMembership: null,
      login: vi.fn(),
      logout: mockLogout,
      setActiveOrganizationId: vi.fn(),
      refreshUser: mockRefreshUser,
    });

    render(<FirstLoginPasswordModal />);

    expect(screen.queryByText(/Password Change Required/i)).not.toBeInTheDocument();
  });

  it('renders mandatory modal when user has mustChangePassword: true', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: {
        id: 'u-temp',
        email: 'temp@stockministry.com',
        isActive: true,
        mustChangePassword: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      isLoading: false,
      isPlatformAdmin: false,
      memberships: null,
      activeOrganizationId: null,
      activeOrganization: null,
      activeMembership: null,
      login: vi.fn(),
      logout: mockLogout,
      setActiveOrganizationId: vi.fn(),
      refreshUser: mockRefreshUser,
    });

    render(<FirstLoginPasswordModal />);

    expect(screen.getByText(/Password Change Required/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Your administrator created this account with a temporary password/i),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter temporary password/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Minimum 8 characters/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Re-enter new password/i)).toBeInTheDocument();
  });

  it('shows error when new password is too short (< 8 characters)', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: {
        id: 'u-temp',
        email: 'temp@stockministry.com',
        isActive: true,
        mustChangePassword: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      isLoading: false,
      isPlatformAdmin: false,
      memberships: null,
      activeOrganizationId: null,
      activeOrganization: null,
      activeMembership: null,
      login: vi.fn(),
      logout: mockLogout,
      setActiveOrganizationId: vi.fn(),
      refreshUser: mockRefreshUser,
    });

    render(<FirstLoginPasswordModal />);

    fireEvent.change(screen.getByPlaceholderText(/Enter temporary password/i), {
      target: { value: 'CurrentTempPass123!' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Minimum 8 characters/i), {
      target: { value: 'short' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Re-enter new password/i), {
      target: { value: 'short' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Set Password & Continue/i }));

    expect(
      await screen.findByText(/New password must be at least 8 characters long/i),
    ).toBeInTheDocument();
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  it('shows error when new password and confirm password do not match', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: {
        id: 'u-temp',
        email: 'temp@stockministry.com',
        isActive: true,
        mustChangePassword: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      isLoading: false,
      isPlatformAdmin: false,
      memberships: null,
      activeOrganizationId: null,
      activeOrganization: null,
      activeMembership: null,
      login: vi.fn(),
      logout: mockLogout,
      setActiveOrganizationId: vi.fn(),
      refreshUser: mockRefreshUser,
    });

    render(<FirstLoginPasswordModal />);

    fireEvent.change(screen.getByPlaceholderText(/Enter temporary password/i), {
      target: { value: 'CurrentTempPass123!' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Minimum 8 characters/i), {
      target: { value: 'NewPassword123!' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Re-enter new password/i), {
      target: { value: 'DifferentPassword123!' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Set Password & Continue/i }));

    expect(
      await screen.findByText(/New password and confirmation password do not match/i),
    ).toBeInTheDocument();
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  it('successfully submits password change and calls refreshUser', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: {
        id: 'u-temp',
        email: 'temp@stockministry.com',
        isActive: true,
        mustChangePassword: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      isLoading: false,
      isPlatformAdmin: false,
      memberships: null,
      activeOrganizationId: null,
      activeOrganization: null,
      activeMembership: null,
      login: vi.fn(),
      logout: mockLogout,
      setActiveOrganizationId: vi.fn(),
      refreshUser: mockRefreshUser,
    });

    (authApi.changePassword as any).mockResolvedValue({
      data: { success: true },
    });

    render(<FirstLoginPasswordModal />);

    fireEvent.change(screen.getByPlaceholderText(/Enter temporary password/i), {
      target: { value: 'CurrentTempPass123!' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Minimum 8 characters/i), {
      target: { value: 'NewPassword123!' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Re-enter new password/i), {
      target: { value: 'NewPassword123!' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Set Password & Continue/i }));

    await waitFor(() => {
      expect(authApi.changePassword).toHaveBeenCalledWith({
        currentPassword: 'CurrentTempPass123!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      });
      expect(toast.success).toHaveBeenCalled();
      expect(mockRefreshUser).toHaveBeenCalled();
    });
  });
});

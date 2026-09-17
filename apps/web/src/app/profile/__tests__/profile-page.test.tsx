import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProfilePage from '../page';
import * as AuthContext from '../../../components/providers/AuthProvider';
import { authApi } from '../../../lib/api/auth';
import { toast } from 'sonner';

vi.mock('../../../lib/api/auth', () => ({
  authApi: {
    updateProfile: vi.fn(),
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

describe('ProfilePage (/profile)', () => {
  const mockRefreshUser = vi.fn();

  const mockUser = {
    id: 'user-uuid-1234-5678',
    email: 'testuser@stockministry.com',
    isActive: true,
    isPlatformAdmin: false,
    mustChangePassword: false,
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-02-15T12:00:00.000Z',
  };

  const mockMemberships = [
    {
      id: 'm-1',
      userId: 'user-uuid-1234-5678',
      organizationId: 'org-1',
      isActive: true,
      createdAt: '2026-01-15T10:00:00.000Z',
      updatedAt: '2026-01-15T10:00:00.000Z',
      role: {
        id: 'role-1',
        name: 'Manager',
        description: 'Inventory and stock operations manager',
      },
      organization: {
        id: 'org-1',
        name: 'Central Logistics Corp',
        slug: 'central-logistics',
        isActive: true,
        createdAt: '2026-01-15T10:00:00.000Z',
        updatedAt: '2026-01-15T10:00:00.000Z',
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: mockUser,
      isLoading: false,
      isPlatformAdmin: false,
      memberships: mockMemberships,
      activeOrganizationId: 'org-1',
      activeOrganization: mockMemberships[0]?.organization ?? null,
      activeMembership: mockMemberships[0] ?? null,
      login: vi.fn(),
      logout: vi.fn(),
      setActiveOrganizationId: vi.fn(),
      refreshUser: mockRefreshUser,
    });
  });

  it('renders user profile overview, personal info, password form, and organization roles', () => {
    render(<ProfilePage />);

    expect(screen.getByRole('heading', { level: 1, name: /User Profile/i })).toBeInTheDocument();
    expect(screen.getByText('testuser@stockministry.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('user-uuid-1234-5678')).toBeInTheDocument();
    expect(screen.getByText('Central Logistics Corp')).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();
  });

  it('allows user to edit their email and submit the update', async () => {
    (authApi.updateProfile as any).mockResolvedValue({
      data: {
        user: {
          ...mockUser,
          email: 'newemail@stockministry.com',
        },
      },
    });

    render(<ProfilePage />);

    const emailInput = screen.getByPlaceholderText(/name@organization.com/i);
    expect(emailInput).toHaveValue('testuser@stockministry.com');

    fireEvent.change(emailInput, { target: { value: 'newemail@stockministry.com' } });
    expect(emailInput).toHaveValue('newemail@stockministry.com');

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(authApi.updateProfile).toHaveBeenCalledWith({
        email: 'newemail@stockministry.com',
      });
      expect(toast.success).toHaveBeenCalledWith('Profile email updated successfully.');
      expect(mockRefreshUser).toHaveBeenCalled();
    });
  });

  it('handles email update API failure with an error message', async () => {
    (authApi.updateProfile as any).mockRejectedValue(
      new Error('Email is already taken by another account'),
    );

    render(<ProfilePage />);

    const emailInput = screen.getByPlaceholderText(/name@organization.com/i);
    fireEvent.change(emailInput, { target: { value: 'taken@stockministry.com' } });

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    expect(
      await screen.findByText(/Email is already taken by another account/i),
    ).toBeInTheDocument();
  });

  it('allows user to change their password with validation and success feedback', async () => {
    (authApi.changePassword as any).mockResolvedValue({
      data: { success: true },
    });

    render(<ProfilePage />);

    fireEvent.change(screen.getByPlaceholderText(/Enter current password/i), {
      target: { value: 'OldPassword123!' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Minimum 8 characters/i), {
      target: { value: 'NewPassword123!' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Confirm new password/i), {
      target: { value: 'NewPassword123!' },
    });

    const submitBtn = screen.getByRole('button', { name: /Update Password/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(authApi.changePassword).toHaveBeenCalledWith({
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      });
      expect(toast.success).toHaveBeenCalledWith('Password changed successfully.');
      expect(mockRefreshUser).toHaveBeenCalled();
    });
  });

  it('validates password mismatch on change password submission', async () => {
    render(<ProfilePage />);

    fireEvent.change(screen.getByPlaceholderText(/Enter current password/i), {
      target: { value: 'OldPassword123!' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Minimum 8 characters/i), {
      target: { value: 'NewPassword123!' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Confirm new password/i), {
      target: { value: 'MismatchPassword123!' },
    });

    const submitBtn = screen.getByRole('button', { name: /Update Password/i });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(/New password and confirmation password do not match/i),
    ).toBeInTheDocument();
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });
});

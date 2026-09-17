import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminLayout from '../layout';
import * as AuthContext from '../../../components/providers/AuthProvider';

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/admin',
}));

describe('Admin Access Control (AdminLayout)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when user is a platform administrator', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: {
        id: 'admin-1',
        email: 'admin@stockministry.com',
        isActive: true,
        isPlatformAdmin: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      isLoading: false,
      isPlatformAdmin: true,
      memberships: null,
      activeOrganizationId: null,
      activeOrganization: null,
      activeMembership: null,
      login: vi.fn(),
      logout: vi.fn(),
      setActiveOrganizationId: vi.fn(),
      refreshUser: vi.fn(),
    });

    render(
      <AdminLayout>
        <div data-testid="admin-content">Admin Secret Data</div>
      </AdminLayout>,
    );

    expect(screen.getByTestId("admin-content")).toBeInTheDocument();
    expect(screen.getByText("Platform Administration")).toBeInTheDocument();
  });

  it('blocks access and shows Access Denied when user is NOT a platform admin', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: {
        id: 'user-1',
        email: 'regular@tenant.com',
        isActive: true,
        isPlatformAdmin: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      isLoading: false,
      isPlatformAdmin: false,
      memberships: null,
      activeOrganizationId: 'org-1',
      activeOrganization: null,
      activeMembership: null,
      login: vi.fn(),
      logout: vi.fn(),
      setActiveOrganizationId: vi.fn(),
      refreshUser: vi.fn(),
    });

    render(
      <AdminLayout>
        <div data-testid="admin-content">Admin Secret Data</div>
      </AdminLayout>,
    );

    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(
      screen.getByText(/This area is restricted to StockMinistry platform administrators/i),
    ).toBeInTheDocument();
  });

  it('shows loading state while authentication is resolving', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: null,
      isLoading: true,
      isPlatformAdmin: false,
      memberships: null,
      activeOrganizationId: null,
      activeOrganization: null,
      activeMembership: null,
      login: vi.fn(),
      logout: vi.fn(),
      setActiveOrganizationId: vi.fn(),
      refreshUser: vi.fn(),
    });

    render(
      <AdminLayout>
        <div data-testid="admin-content">Admin Secret Data</div>
      </AdminLayout>,
    );

    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Verifying platform administrator credentials/i),
    ).toBeInTheDocument();
  });
});

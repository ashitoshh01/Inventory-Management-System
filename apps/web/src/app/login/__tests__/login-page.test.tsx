import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from '../page';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line
    return <img {...(props as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

// Mock AuthProvider
const mockLogin = vi.fn();
vi.mock('../../../components/providers/AuthProvider', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    isLoading: false,
    memberships: null,
    activeOrganizationId: null,
    activeOrganization: null,
    activeMembership: null,
    logout: vi.fn(),
    setActiveOrganizationId: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the login form with email and password fields', () => {
    render(<LoginPage />);

    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders the "Create account" WhatsApp link', () => {
    render(<LoginPage />);

    const createAccountLink = screen.getByText('Create account');
    expect(createAccountLink).toBeInTheDocument();
    expect(createAccountLink.tagName).toBe('A');
  });

  it('has the correct WhatsApp deep-link URL', () => {
    render(<LoginPage />);

    const link = screen.getByText('Create account');
    expect(link).toHaveAttribute(
      'href',
      'https://wa.me/919604019444?text=Hi%2C%20I%20would%20like%20to%20request%20an%20account%20on%20StockMinistry.com.',
    );
  });

  it('WhatsApp URL contains the correct phone number', () => {
    render(<LoginPage />);

    const link = screen.getByText('Create account');
    const href = link.getAttribute('href') || '';
    expect(href).toContain('wa.me/919604019444');
  });

  it('WhatsApp URL contains the correct URL-encoded message', () => {
    render(<LoginPage />);

    const link = screen.getByText('Create account');
    const href = link.getAttribute('href') || '';
    // The decoded message should be: "Hi, I would like to request an account on StockMinistry.com."
    const url = new URL(href);
    const text = url.searchParams.get('text');
    expect(text).toBe('Hi, I would like to request an account on StockMinistry.com.');
  });

  it('WhatsApp link opens in a new tab', () => {
    render(<LoginPage />);

    const link = screen.getByText('Create account');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('does NOT have a link to /register', () => {
    render(<LoginPage />);

    const registerLinks = screen.queryAllByRole('link').filter((el) => {
      const href = el.getAttribute('href');
      return href === '/register' || href?.startsWith('/register');
    });

    expect(registerLinks).toHaveLength(0);
  });

  it('displays "Don\'t have an account?" text', () => {
    render(<LoginPage />);

    expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
  });

  it('does NOT contain "Register here" text', () => {
    render(<LoginPage />);

    expect(screen.queryByText(/register here/i)).not.toBeInTheDocument();
  });
});

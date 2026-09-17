import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RegisterPage from '../page';

// Mock next/navigation
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe('RegisterPage', () => {
  it('calls router.replace with /login to redirect', () => {
    render(<RegisterPage />);

    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('does NOT render a registration form', () => {
    render(<RegisterPage />);

    // No form elements for registration
    expect(screen.queryByPlaceholderText(/organization/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create account/i })).not.toBeInTheDocument();
  });

  it('shows a redirect message', () => {
    render(<RegisterPage />);

    expect(screen.getByText(/redirecting to login/i)).toBeInTheDocument();
  });
});

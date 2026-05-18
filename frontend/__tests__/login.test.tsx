import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../src/pages/login';

describe('Login Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  test('renders login form with email and password fields', () => {
    render(<Login />);
    expect(screen.getByPlaceholderText('admin@portal.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  test('renders submit button with "Войти" text', () => {
    render(<Login />);
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
  });

  test('pre-fills default email and password', () => {
    render(<Login />);
    expect(screen.getByPlaceholderText('admin@portal.com')).toHaveValue('admin@portal.com');
    expect(screen.getByPlaceholderText('••••••••')).toHaveValue('admin123');
  });

  test('allows user to type in email and password fields', async () => {
    const user = userEvent.setup();
    render(<Login />);
    const emailInput = screen.getByPlaceholderText('admin@portal.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    await user.clear(emailInput);
    await user.type(emailInput, 'newuser@example.com');
    await user.clear(passwordInput);
    await user.type(passwordInput, 'newpassword');
    expect(emailInput).toHaveValue('newuser@example.com');
    expect(passwordInput).toHaveValue('newpassword');
  });

  test('shows loading state when submitting', async () => {
    const user = userEvent.setup();
    global.fetch.mockImplementation(() => new Promise(() => {}));
    render(<Login />);
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    expect(screen.getByRole('button', { name: 'Вход...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Вход...' })).toBeInTheDocument();
  });

  test('shows error message on login failure', async () => {
    const user = userEvent.setup();
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' }),
    } as any);
    render(<Login />);
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  test('error is preserved after failed login (not auto-cleared on type)', async () => {
    // The Login component does NOT auto-clear error on typing
    // This documents actual behavior: error is cleared only on next submit
    render(<Login />);
    // Pre-populate error state via a failed login
    const mockFetch = global.fetch as jest.Mock;
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' }),
    } as any);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
    // Type in the email field — error should STILL be visible (no auto-clear)
    await user.type(screen.getByPlaceholderText('admin@portal.com'), 'x');
    // Error persists because the component does not clear on onChange
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });
});

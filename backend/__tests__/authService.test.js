'use strict';

/**
 * AuthService unit tests
 * Tests business logic with mocked DB pool (no real DB needed).
 */

jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  let authService;
  let mockQuery;

  beforeEach(() => {
    jest.resetModules();

    mockQuery = jest.fn();

    // Mock bcryptjs — hash returns deterministic result, compare returns true for 'password123'
    const bcrypt = require('bcryptjs');
    bcrypt.hash.mockResolvedValue('hashed_password');
    bcrypt.compare.mockImplementation((input, hash) => Promise.resolve(input === 'password123'));

    // Mock jsonwebtoken
    const jwt = require('jsonwebtoken');
    jwt.sign.mockReturnValue('mock.jwt.token');
    jest.doMock('../src/config', () => ({
      JWT_SECRET: 'test-secret-key',
      JWT_EXPIRY: '1h',
      pool: { query: mockQuery },
    }));

    const { AuthService } = require('../src/services/authService');
    authService = new AuthService();
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('register', () => {
    test('creates a new user and returns a token', async () => {
      const newUser = { id: 1, email: 'test@example.com', username: 'testuser' };
      // findByEmail → no user found
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // create → new user
      mockQuery.mockResolvedValueOnce({ rows: [newUser] });

      const result = await authService.register({
        email: 'test@example.com',
        password: 'password123',
        username: 'testuser',
      });

      expect(result.token).toBeDefined();
      expect(result.user).toMatchObject({ id: 1, email: 'test@example.com' });
    });

    test('returns error 409 if user already exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, email: 'test@example.com' }] });

      const result = await authService.register({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual({ error: 'User already exists', status: 409 });
    });

    test('registers user without username', async () => {
      const newUser = { id: 2, email: 'user@example.com', username: null };
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({ rows: [newUser] });

      const result = await authService.register({
        email: 'user@example.com',
        password: 'password123',
      });

      expect(result.token).toBeDefined();
      expect(result.user.email).toBe('user@example.com');
    });
  });

  describe('login', () => {
    test('returns token and user on valid credentials', async () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
        password_hash: 'hashedpassword',
      };
      mockQuery.mockResolvedValueOnce({ rows: [user] });

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.token).toBeDefined();
      expect(result.user).toMatchObject({
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
      });
    });

    test('returns error 401 if user not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await authService.login({
        email: 'notfound@example.com',
        password: 'password123',
      });

      expect(result).toEqual({ error: 'Invalid credentials', status: 401 });
    });

    test('returns error 401 if password is wrong', async () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        password_hash: 'hashedpassword',
      };
      mockQuery.mockResolvedValueOnce({ rows: [user] });

      const result = await authService.login({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(result).toEqual({ error: 'Invalid credentials', status: 401 });
    });
  });
});

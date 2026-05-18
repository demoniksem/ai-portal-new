'use strict';

const jwt = require('jsonwebtoken');

// Load the real authMiddleware
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests';
const { authMiddleware } = require('../../src/middleware/auth');

describe('Auth Middleware (src/middleware/auth.js)', () => {
  let mockReq;
  let mockRes;
  let nextFn;

  beforeEach(() => {
    mockReq = { headers: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFn = jest.fn();
  });

  test('rejects request with no authorization header', () => {
    authMiddleware(mockReq, mockRes, nextFn);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(nextFn).not.toHaveBeenCalled();
  });

  test('rejects request with authorization header but no Bearer prefix', () => {
    mockReq.headers.authorization = 'Basic sometoken';
    authMiddleware(mockReq, mockRes, nextFn);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(nextFn).not.toHaveBeenCalled();
  });

  test('rejects request with invalid token', () => {
    mockReq.headers.authorization = 'Bearer invalid.token.here';
    authMiddleware(mockReq, mockRes, nextFn);
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(nextFn).not.toHaveBeenCalled();
  });

  test('rejects request with expired token', () => {
    const expiredToken = jwt.sign(
      { id: 1, email: 'test@example.com' },
      'test-jwt-secret-for-unit-tests',
      { expiresIn: '-1s' }
    );
    mockReq.headers.authorization = `Bearer ${expiredToken}`;
    authMiddleware(mockReq, mockRes, nextFn);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token expired' });
    expect(nextFn).not.toHaveBeenCalled();
  });

  test('accepts request with valid token and sets req.user', () => {
    const validToken = jwt.sign(
      { id: 42, email: 'test@example.com' },
      'test-jwt-secret-for-unit-tests',
      { expiresIn: '1h' }
    );
    mockReq.headers.authorization = `Bearer ${validToken}`;
    authMiddleware(mockReq, mockRes, nextFn);
    expect(nextFn).toHaveBeenCalled();
    expect(mockReq.user).toMatchObject({ id: 42, email: 'test@example.com' });
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  test('rejects token signed with wrong secret', () => {
    const wrongSecretToken = jwt.sign(
      { id: 42, email: 'test@example.com' },
      'wrong-secret',
      { expiresIn: '1h' }
    );
    mockReq.headers.authorization = `Bearer ${wrongSecretToken}`;
    authMiddleware(mockReq, mockRes, nextFn);
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(nextFn).not.toHaveBeenCalled();
  });

  test('handles malformed authorization header', () => {
    mockReq.headers.authorization = 'Bearer';
    authMiddleware(mockReq, mockRes, nextFn);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(nextFn).not.toHaveBeenCalled();
  });
});

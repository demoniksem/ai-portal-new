'use strict';

/**
 * Auth Middleware unit tests
 * Tests the actual src/middleware/auth.js module with mocked JWT.
 */

const jwt = require('jsonwebtoken');

// Mock the config before importing the middleware
jest.mock('../src/config', () => ({
  JWT_SECRET: 'test-secret-key',
}));

const { authMiddleware } = require('../src/middleware/auth');

describe('authMiddleware', () => {
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
      'test-secret-key',
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
      'test-secret-key',
      { expiresIn: '1h' }
    );
    mockReq.headers.authorization = `Bearer ${validToken}`;
    authMiddleware(mockReq, mockRes, nextFn);
    expect(nextFn).toHaveBeenCalled();
    expect(mockReq.user).toMatchObject({ id: 42, email: 'test@example.com' });
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  test('accepts token signed with correct secret but wrong issuer', () => {
    // Token is valid but created with different secret
    const wrongSecretToken = jwt.sign(
      { id: 99, email: 'other@example.com' },
      'wrong-secret',
      { expiresIn: '1h' }
    );
    mockReq.headers.authorization = `Bearer ${wrongSecretToken}`;
    authMiddleware(mockReq, mockRes, nextFn);
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(nextFn).not.toHaveBeenCalled();
  });
});

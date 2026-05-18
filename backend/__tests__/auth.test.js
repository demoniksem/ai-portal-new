const jwt = require('jsonwebtoken');

// Mock auth middleware — replicates the logic from src/index.js
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
    req.user = decoded;
    next();
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
};

describe('Auth Middleware', () => {
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
      process.env.JWT_SECRET || 'test-secret',
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
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
    mockReq.headers.authorization = `Bearer ${validToken}`;
    authMiddleware(mockReq, mockRes, nextFn);
    expect(nextFn).toHaveBeenCalled();
    expect(mockReq.user).toMatchObject({ id: 42, email: 'test@example.com' });
    expect(mockRes.status).not.toHaveBeenCalled();
  });
});

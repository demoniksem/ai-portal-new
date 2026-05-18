'use strict';

describe('CORS Middleware (src/middleware/cors.js)', () => {
  let corsMiddleware;
  let mockReq;
  let mockRes;
  let nextFn;

  beforeEach(() => {
    mockReq = { headers: {}, method: 'GET' };
    mockRes = {
      header: jest.fn().mockReturnThis(),
      sendStatus: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };
    nextFn = jest.fn();
  });

  afterEach(() => {
    jest.resetModules();
    delete process.env.ALLOWED_ORIGINS;
  });

  test('sets CORS headers for allowed origin', async () => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000,https://example.com';
    await jest.isolateModules(async () => {
      ({ corsMiddleware } = require('../../src/middleware/cors'));
      mockReq.headers.origin = 'http://localhost:3000';
      corsMiddleware(mockReq, mockRes, nextFn);
    });

    expect(mockRes.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:3000');
    expect(mockRes.header).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    expect(mockRes.header).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    expect(mockRes.header).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
    expect(mockRes.header).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(mockRes.header).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(mockRes.header).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
    expect(mockRes.header).toHaveBeenCalledWith('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    expect(nextFn).toHaveBeenCalled();
  });

  test('does not set Access-Control-Allow-Origin for disallowed origin', async () => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
    await jest.isolateModules(async () => {
      ({ corsMiddleware } = require('../../src/middleware/cors'));
      mockReq.headers.origin = 'http://evil.com';
      corsMiddleware(mockReq, mockRes, nextFn);
    });

    expect(mockRes.header).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://evil.com');
    expect(mockRes.header).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(nextFn).toHaveBeenCalled();
  });

  test('does not set origin header when none present', async () => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
    await jest.isolateModules(async () => {
      ({ corsMiddleware } = require('../../src/middleware/cors'));
      mockReq.headers.origin = undefined;
      corsMiddleware(mockReq, mockRes, nextFn);
    });

    expect(mockRes.header).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', expect.anything());
    expect(nextFn).toHaveBeenCalled();
  });

  test('handles OPTIONS preflight request', async () => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
    await jest.isolateModules(async () => {
      ({ corsMiddleware } = require('../../src/middleware/cors'));
      mockReq.headers.origin = 'http://localhost:3000';
      mockReq.method = 'OPTIONS';
      corsMiddleware(mockReq, mockRes, nextFn);
    });

    expect(mockRes.sendStatus).toHaveBeenCalledWith(204);
    expect(nextFn).not.toHaveBeenCalled();
  });

  test('allows multiple origins when configured', async () => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000,https://myapp.com,https://staging.app';
    await jest.isolateModules(async () => {
      ({ corsMiddleware } = require('../../src/middleware/cors'));
      mockReq.headers.origin = 'https://staging.app';
      corsMiddleware(mockReq, mockRes, nextFn);
    });

    expect(mockRes.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://staging.app');
    expect(nextFn).toHaveBeenCalled();
  });
});

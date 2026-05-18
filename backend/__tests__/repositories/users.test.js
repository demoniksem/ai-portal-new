'use strict';

jest.mock('../../src/config', () => ({
  pool: { query: jest.fn() },
}));

const { pool } = require('../../src/config');
const { UsersRepository } = require('../../src/repositories/users');

describe('UsersRepository', () => {
  let repo;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new UsersRepository();
  });

  describe('findByEmail', () => {
    test('returns user when found', async () => {
      const user = { id: 1, email: 'test@example.com', username: 'testuser', password_hash: 'hash' };
      pool.query.mockResolvedValue({ rows: [user] });

      const result = await repo.findByEmail('test@example.com');

      expect(result).toEqual(user);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT id, email, username, password_hash FROM users WHERE email = $1',
        ['test@example.com']
      );
    });

    test('returns null when user not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await repo.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    test('returns user when found', async () => {
      const user = { id: 1, email: 'test@example.com', username: 'testuser' };
      pool.query.mockResolvedValue({ rows: [user] });

      const result = await repo.findById(1);

      expect(result).toEqual(user);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT id, email, username FROM users WHERE id = $1',
        [1]
      );
    });

    test('returns null when user not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await repo.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    test('creates user and returns created record', async () => {
      const created = { id: 1, email: 'new@example.com', username: 'newuser' };
      pool.query.mockResolvedValue({ rows: [created] });

      const result = await repo.create({
        email: 'new@example.com',
        passwordHash: 'hashedpassword',
        username: 'newuser',
      });

      expect(result).toEqual(created);
      expect(pool.query).toHaveBeenCalledWith(
        'INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING id, email, username',
        ['new@example.com', 'hashedpassword', 'newuser']
      );
    });

    test('creates user with null username when not provided', async () => {
      const created = { id: 1, email: 'new@example.com', username: null };
      pool.query.mockResolvedValue({ rows: [created] });

      await repo.create({
        email: 'new@example.com',
        passwordHash: 'hashedpassword',
        username: null,
      });

      expect(pool.query).toHaveBeenCalledWith(
        'INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING id, email, username',
        ['new@example.com', 'hashedpassword', null]
      );
    });
  });

  describe('getAISettings', () => {
    test('returns ai settings when found', async () => {
      const settings = { provider: 'openrouter', api_key: 'key123', model: 'qwen', temperature: 0.7, max_tokens: 4000 };
      pool.query.mockResolvedValue({ rows: [settings] });

      const result = await repo.getAISettings(1);

      expect(result).toEqual(settings);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT provider, api_key, model, temperature, max_tokens FROM ai_settings WHERE user_id = $1',
        [1]
      );
    });

    test('returns null when no settings found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await repo.getAISettings(999);

      expect(result).toBeNull();
    });
  });

  describe('upsertAISettings', () => {
    test('upserts ai settings and returns result', async () => {
      const upserted = { provider: 'openai', model: 'gpt-4', temperature: 0.5, max_tokens: 8000 };
      pool.query.mockResolvedValue({ rows: [upserted] });

      const result = await repo.upsertAISettings({
        userId: 1,
        provider: 'openai',
        apiKey: 'newkey',
        model: 'gpt-4',
        temperature: 0.5,
        maxTokens: 8000,
      });

      expect(result).toEqual(upserted);
    });
  });
});

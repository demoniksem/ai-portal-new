'use strict';

// Mock pool at the config level — required by UsersRepository
const mockQuery = jest.fn();
jest.mock('../src/config', () => ({
  pool: { query: mockQuery },
}));

const { UsersRepository } = require('../src/repositories/users');

describe('UsersRepository', () => {
  let repo;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new UsersRepository();
  });

  describe('findByEmail', () => {
    test('returns user when found', async () => {
      const user = { id: 1, email: 'test@example.com', username: 'test', password_hash: 'hash' };
      mockQuery.mockResolvedValue({ rows: [user] });

      const result = await repo.findByEmail('test@example.com');

      expect(result).toEqual(user);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id, email, username, password_hash FROM users WHERE email = $1',
        ['test@example.com']
      );
    });

    test('returns null when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await repo.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    test('returns user when found', async () => {
      const user = { id: 5, email: 'user@example.com', username: 'user' };
      mockQuery.mockResolvedValue({ rows: [user] });

      const result = await repo.findById(5);

      expect(result).toEqual(user);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id, email, username FROM users WHERE id = $1',
        [5]
      );
    });

    test('returns null when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await repo.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    test('inserts user and returns created row', async () => {
      const created = { id: 10, email: 'new@example.com', username: 'newuser' };
      mockQuery.mockResolvedValue({ rows: [created] });

      const result = await repo.create({ email: 'new@example.com', passwordHash: 'hashedpass', username: 'newuser' });

      expect(result).toEqual(created);
      expect(mockQuery).toHaveBeenCalledWith(
        'INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING id, email, username',
        ['new@example.com', 'hashedpass', 'newuser']
      );
    });

    test('inserts user with null username', async () => {
      const created = { id: 11, email: 'anon@example.com', username: null };
      mockQuery.mockResolvedValue({ rows: [created] });

      const result = await repo.create({ email: 'anon@example.com', passwordHash: 'hash' });

      expect(result).toEqual(created);
      expect(mockQuery).toHaveBeenCalledWith(
        'INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING id, email, username',
        ['anon@example.com', 'hash', null]
      );
    });
  });

  describe('getAISettings', () => {
    test('returns AI settings when found', async () => {
      const settings = { provider: 'openrouter', api_key: 'sk-xxx', model: 'qwen', temperature: 0.7, max_tokens: 4000 };
      mockQuery.mockResolvedValue({ rows: [settings] });

      const result = await repo.getAISettings(1);

      expect(result).toEqual(settings);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT provider, api_key, model, temperature, max_tokens FROM ai_settings WHERE user_id = $1',
        [1]
      );
    });

    test('returns null when no AI settings exist', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await repo.getAISettings(999);

      expect(result).toBeNull();
    });
  });

  describe('upsertAISettings', () => {
    test('upserts settings and returns result', async () => {
      const upserted = { provider: 'openai', model: 'gpt-4o', temperature: 0.5, max_tokens: 8000 };
      mockQuery.mockResolvedValue({ rows: [upserted] });

      const result = await repo.upsertAISettings({
        userId: 1,
        provider: 'openai',
        apiKey: 'sk-xxx',
        model: 'gpt-4o',
        temperature: 0.5,
        maxTokens: 8000,
      });

      expect(result).toEqual(upserted);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });
});

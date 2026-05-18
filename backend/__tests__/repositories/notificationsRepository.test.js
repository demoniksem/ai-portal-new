'use strict';

// Test the NotificationsRepository with mocked pool
jest.mock('../../src/config', () => ({
  pool: {
    query: jest.fn(),
  },
}));

const { pool } = require('../../src/config');
const { NotificationsRepository } = require('../../src/repositories/notifications');

describe('NotificationsRepository (src/repositories/notifications.js)', () => {
  let repo;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new NotificationsRepository();
  });

  describe('ensureTable', () => {
    test('creates notifications table if not exists', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await repo.ensureTable();

      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS notifications'));
    });
  });

  describe('findByUserId', () => {
    test('returns notifications ordered by created_at desc with limit', async () => {
      const notifications = [
        { id: 2, user_id: 5, title: 'Second', read: false },
        { id: 1, user_id: 5, title: 'First', read: true },
      ];
      pool.query.mockResolvedValue({ rows: notifications });

      const result = await repo.findByUserId(5, { limit: 50 });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM notifications WHERE user_id = $1'),
        [5, 50]
      );
      expect(result).toEqual(notifications);
    });

    test('uses default limit of 50', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await repo.findByUserId(5);

      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [5, 50]);
    });
  });

  describe('create', () => {
    test('inserts notification and returns created row', async () => {
      const created = { id: 10, user_id: 3, title: 'New!', message: 'Content', read: false };
      pool.query.mockResolvedValue({ rows: [created] });

      const result = await repo.create({ userId: 3, title: 'New!', message: 'Content' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        [3, 'New!', 'Content']
      );
      expect(result).toEqual(created);
    });
  });

  describe('markRead', () => {
    test('marks notification as read and returns it', async () => {
      const notification = { id: 7, user_id: 2, title: 'Test', read: true };
      pool.query.mockResolvedValue({ rows: [notification] });

      const result = await repo.markRead(7, 2);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE notifications SET read = true'),
        [7, 2]
      );
      expect(result).toEqual(notification);
    });

    test('returns null when notification not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await repo.markRead(999, 1);

      expect(result).toBeNull();
    });
  });
});

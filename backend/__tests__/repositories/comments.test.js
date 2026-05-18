'use strict';

jest.mock('../../src/config', () => ({
  pool: { query: jest.fn() },
}));

const { pool } = require('../../src/config');
const { CommentsRepository } = require('../../src/repositories/comments');

describe('CommentsRepository', () => {
  let repo;

  beforeEach(() => {
    // Only clear calls — don't reset implementations (they're set per-test)
    pool.query.mockClear();
    repo = new CommentsRepository();
  });

  describe('ensureTable', () => {
    test('creates comments table if not exists', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await repo.ensureTable();

      expect(pool.query).toHaveBeenCalled();
      expect(pool.query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS comments');
    });
  });

  describe('findByPageId', () => {
    test('returns comments with user info ordered by created_at asc', async () => {
      const comments = [
        { id: 1, page_id: 1, user_id: 1, text: 'First', email: 'a@test.com', username: 'user1' },
        { id: 2, page_id: 1, user_id: 2, text: 'Second', email: 'b@test.com', username: 'user2' },
      ];
      pool.query
        .mockResolvedValueOnce({ rows: [] })   // ensureTable
        .mockResolvedValueOnce({ rows: comments }); // SELECT

      const result = await repo.findByPageId(1);

      expect(result).toEqual(comments);
    });

    test('returns empty array when no comments', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] })   // ensureTable
        .mockResolvedValueOnce({ rows: [] });  // SELECT

      const result = await repo.findByPageId(1);

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    test('creates comment and returns it', async () => {
      const comment = { id: 1, page_id: 1, user_id: 1, text: 'New comment' };
      pool.query
        .mockResolvedValueOnce({ rows: [] })   // ensureTable
        .mockResolvedValueOnce({ rows: [comment] }); // INSERT

      const result = await repo.create({ pageId: 1, userId: 1, text: 'New comment' });

      expect(result).toEqual(comment);
    });
  });

  describe('update', () => {
    test('updates comment and returns it when found', async () => {
      const updated = { id: 1, text: 'Updated text' };
      // update() only calls pool.query once (no ensureTable)
      pool.query.mockResolvedValueOnce({ rows: [updated] });

      const result = await repo.update(1, { text: 'Updated text', userId: 1 });

      expect(result).toEqual(updated);
    });

    test('returns null when comment not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.update(999, { text: 'Updated', userId: 1 });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    test('returns true when comment deleted', async () => {
      // delete() only calls pool.query once (no ensureTable)
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await repo.delete(1, 1);

      expect(result).toBe(true);
    });

    test('returns false when comment not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.delete(999, 1);

      expect(result).toBe(false);
    });
  });
});

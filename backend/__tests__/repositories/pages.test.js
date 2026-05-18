'use strict';

jest.mock('../../src/config', () => ({
  pool: { query: jest.fn() },
}));

const { pool } = require('../../src/config');
const { PagesRepository } = require('../../src/repositories/pages');

describe('PagesRepository', () => {
  let repo;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PagesRepository();
  });

  describe('findAll', () => {
    test('returns all pages ordered by created_at desc', async () => {
      const pages = [
        { id: 2, title: 'Page 2' },
        { id: 1, title: 'Page 1' },
      ];
      pool.query.mockResolvedValue({ rows: pages });

      const result = await repo.findAll();

      expect(result).toEqual(pages);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM pages WHERE deleted_at IS NULL ORDER BY created_at DESC',
        []
      );
    });

    test('filters by spaceId when provided', async () => {
      const pages = [{ id: 1, title: 'Space Page', space_id: 5 }];
      pool.query.mockResolvedValue({ rows: pages });

      const result = await repo.findAll({ spaceId: 5 });

      expect(result).toEqual(pages);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM pages WHERE deleted_at IS NULL AND space_id = $1 ORDER BY created_at DESC',
        [5]
      );
    });
  });

  describe('findById', () => {
    test('returns page when found', async () => {
      const page = { id: 1, title: 'Test Page' };
      pool.query.mockResolvedValue({ rows: [page] });

      const result = await repo.findById(1);

      expect(result).toEqual(page);
    });

    test('returns null when not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await repo.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    test('creates page with object content and serializes it to JSON string', async () => {
      const created = { id: 1, title: 'New Page', content: '{"text":"Hello"}', space_id: 1 };
      pool.query.mockResolvedValue({ rows: [created] });

      const result = await repo.create({
        title: 'New Page',
        content: { text: 'Hello' },
        spaceId: 1,
        acl: { read: 'all' },
        createdBy: 1,
      });

      expect(result).toEqual(created);
      expect(pool.query).toHaveBeenCalledWith(
        'INSERT INTO pages (title, content, space_id, acl, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        ['New Page', '{"text":"Hello"}', 1, '{"read":"all"}', 1]
      );
    });

    test('creates page with string content unchanged', async () => {
      const created = { id: 1, title: 'Page', content: 'plain text content', space_id: 1 };
      pool.query.mockResolvedValue({ rows: [created] });

      await repo.create({
        title: 'Page',
        content: 'plain text content',
        spaceId: 1,
        createdBy: 1,
      });

      expect(pool.query).toHaveBeenCalledWith(
        'INSERT INTO pages (title, content, space_id, acl, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        ['Page', 'plain text content', 1, '{}', 1]
      );
    });

    test('uses empty object for missing content and acl', async () => {
      const created = { id: 1, title: 'Page', content: '{}', space_id: 1 };
      pool.query.mockResolvedValue({ rows: [created] });

      await repo.create({ title: 'Page', spaceId: 1, createdBy: 1 });

      expect(pool.query).toHaveBeenCalledWith(
        'INSERT INTO pages (title, content, space_id, acl, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        ['Page', '{}', 1, '{}', 1]
      );
    });
  });

  describe('update', () => {
    test('updates page and returns updated record', async () => {
      const existing = { id: 1, title: 'Old Title', content: '{}', acl: '{}' };
      const updated = { id: 1, title: 'New Title', content: '{}', acl: '{}' };
      pool.query
        .mockResolvedValueOnce({ rows: [existing] }) // findById in update()
        .mockResolvedValueOnce({ rows: [updated] });   // actual update

      const result = await repo.update(1, { title: 'New Title' });

      expect(result).toEqual(updated);
    });

    test('returns null when page does not exist', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await repo.update(999, { title: 'New Title' });

      expect(result).toBeNull();
    });

    test('preserves existing fields when not provided in update', async () => {
      const existing = { id: 1, title: 'Old', content: '{"text":"old"}', acl: '{"write":1}' };
      const updated = { id: 1, title: 'Old', content: '{"text":"old"}', acl: '{"write":1}' };
      pool.query
        .mockResolvedValueOnce({ rows: [existing] })
        .mockResolvedValueOnce({ rows: [updated] });

      await repo.update(1, {});

      expect(pool.query).toHaveBeenLastCalledWith(
        'UPDATE pages SET title = $1, content = $2, acl = $3 WHERE id = $4 AND deleted_at IS NULL RETURNING *',
        ['Old', '{"text":"old"}', '{"write":1}', 1]
      );
    });
  });

  describe('softDelete', () => {
    test('sets deleted_at and returns the page', async () => {
      const deleted = { id: 1, title: 'Deleted Page', deleted_at: new Date() };
      pool.query.mockResolvedValue({ rows: [deleted] });

      const result = await repo.softDelete(1);

      expect(result).toEqual(deleted);
      expect(pool.query).toHaveBeenCalledWith(
        'UPDATE pages SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *',
        [1]
      );
    });

    test('returns null when page does not exist', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await repo.softDelete(999);

      expect(result).toBeNull();
    });
  });

  describe('restore', () => {
    test('clears deleted_at and returns the restored page', async () => {
      const restored = { id: 1, title: 'Restored Page', deleted_at: null };
      pool.query.mockResolvedValue({ rows: [restored] });

      const result = await repo.restore(1);

      expect(result).toEqual(restored);
      expect(pool.query).toHaveBeenCalledWith(
        'UPDATE pages SET deleted_at = NULL WHERE id = $1 RETURNING *',
        [1]
      );
    });

    test('returns null when page does not exist', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await repo.restore(999);

      expect(result).toBeNull();
    });
  });
});

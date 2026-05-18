'use strict';

const mockQuery = jest.fn();
jest.mock('../src/config', () => ({
  pool: { query: mockQuery },
}));

const { PagesRepository } = require('../src/repositories/pages');

describe('PagesRepository', () => {
  let repo;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PagesRepository();
  });

  describe('findAll', () => {
    test('returns all non-deleted pages ordered by created_at desc', async () => {
      const pages = [{ id: 1, title: 'Page A' }, { id: 2, title: 'Page B' }];
      mockQuery.mockResolvedValue({ rows: pages });

      const result = await repo.findAll();

      expect(result).toEqual(pages);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM pages WHERE deleted_at IS NULL ORDER BY created_at DESC',
        []
      );
    });

    test('filters by spaceId when provided', async () => {
      const pages = [{ id: 1, title: 'Page A', space_id: 5 }];
      mockQuery.mockResolvedValue({ rows: pages });

      const result = await repo.findAll({ spaceId: 5 });

      expect(result).toEqual(pages);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM pages WHERE deleted_at IS NULL AND space_id = $1 ORDER BY created_at DESC',
        [5]
      );
    });

    test('returns empty array when no pages exist', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await repo.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    test('returns page when found (non-deleted)', async () => {
      const page = { id: 3, title: 'Page 3', content: '{}' };
      mockQuery.mockResolvedValue({ rows: [page] });

      const result = await repo.findById(3);

      expect(result).toEqual(page);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM pages WHERE id = $1 AND deleted_at IS NULL',
        [3]
      );
    });

    test('returns null when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await repo.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    test('inserts page and returns created row', async () => {
      const created = { id: 10, title: 'New Page', content: '{}', space_id: 1 };
      mockQuery.mockResolvedValue({ rows: [created] });

      const result = await repo.create({
        title: 'New Page',
        content: { read: 'all' },
        spaceId: 1,
        acl: { read: 'all' },
        createdBy: 42,
      });

      expect(result).toEqual(created);
      // Verify the query was called with correct values (params may vary by serialization)
      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO pages');
      expect(params[0]).toBe('New Page'); // title
      expect(params[2]).toBe(1);         // spaceId
      expect(params[4]).toBe(42);         // createdBy
    });

    test('stringifies non-string content', async () => {
      const created = { id: 11, title: 'Page', content: '{"text":"hello"}' };
      mockQuery.mockResolvedValue({ rows: [created] });

      await repo.create({ title: 'Page', content: { text: 'hello' }, spaceId: 1, createdBy: 1 });

      const call = mockQuery.mock.calls[0];
      expect(call[1][1]).toBe('{"text":"hello"}'); // content
    });

    test('uses empty object string for undefined content', async () => {
      const created = { id: 12, title: 'Page', content: '{}' };
      mockQuery.mockResolvedValue({ rows: [created] });

      await repo.create({ title: 'Page', spaceId: 1, createdBy: 1 });

      const call = mockQuery.mock.calls[0];
      expect(call[1][1]).toBe('{}');
    });

    test('uses empty object string for undefined acl', async () => {
      const created = { id: 13, title: 'Page', content: '{}' };
      mockQuery.mockResolvedValue({ rows: [created] });

      await repo.create({ title: 'Page', spaceId: 1, createdBy: 1, acl: undefined });

      const call = mockQuery.mock.calls[0];
      expect(call[1][3]).toBe('{}'); // acl
    });
  });

  describe('update', () => {
    test('updates and returns the updated page', async () => {
      const existing = { id: 5, title: 'Old Title', content: '{}', acl: '{}' };
      const updated = { id: 5, title: 'New Title', content: '{}', acl: '{}' };
      mockQuery
        .mockResolvedValueOnce({ rows: [existing] }) // findById in update
        .mockResolvedValueOnce({ rows: [updated] }); // UPDATE

      const result = await repo.update(5, { title: 'New Title' });

      expect(result).toEqual(updated);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    test('returns null when page to update does not exist', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await repo.update(999, { title: 'New Title' });

      expect(result).toBeNull();
    });

    test('preserves existing fields when not provided in update', async () => {
      const existing = { id: 5, title: 'Old Title', content: '{"old":"content"}', acl: '{}' };
      const updated = { id: 5, title: 'Old Title', content: '{"old":"content"}', acl: '{}' };
      mockQuery
        .mockResolvedValueOnce({ rows: [existing] })
        .mockResolvedValueOnce({ rows: [updated] });

      await repo.update(5, {});

      const updateCall = mockQuery.mock.calls[1];
      expect(updateCall[1][0]).toBe('Old Title');       // title unchanged
      expect(updateCall[1][1]).toBe('{"old":"content"}'); // content unchanged
    });
  });

  describe('softDelete', () => {
    test('sets deleted_at and returns the page', async () => {
      const deleted = { id: 7, title: 'Deleted Page', deleted_at: new Date() };
      mockQuery.mockResolvedValue({ rows: [deleted] });

      const result = await repo.softDelete(7);

      expect(result).toEqual(deleted);
      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE pages SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *',
        [7]
      );
    });

    test('returns null when page to delete does not exist', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await repo.softDelete(999);

      expect(result).toBeNull();
    });
  });

  describe('restore', () => {
    test('clears deleted_at and returns the restored page', async () => {
      const restored = { id: 7, title: 'Restored Page', deleted_at: null };
      mockQuery.mockResolvedValue({ rows: [restored] });

      const result = await repo.restore(7);

      expect(result).toEqual(restored);
      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE pages SET deleted_at = NULL WHERE id = $1 RETURNING *',
        [7]
      );
    });

    test('returns null when page does not exist', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await repo.restore(999);

      expect(result).toBeNull();
    });
  });
});

'use strict';

const mockQuery = jest.fn();
jest.mock('../src/config', () => ({
  pool: { query: mockQuery },
}));

const { SpacesRepository } = require('../src/repositories/spaces');

describe('SpacesRepository', () => {
  let repo;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SpacesRepository();
  });

  describe('findAll', () => {
    test('returns all spaces ordered by created_at desc', async () => {
      const spaces = [{ id: 1, name: 'Space A', slug: 'space-a' }];
      mockQuery.mockResolvedValue({ rows: spaces });

      const result = await repo.findAll();

      expect(result).toEqual(spaces);
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][0]).toBe('SELECT * FROM spaces ORDER BY created_at DESC');
    });

    test('returns empty array when no spaces exist', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await repo.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    test('returns space when found', async () => {
      const space = { id: 3, name: 'Space 3', slug: 'space-3' };
      mockQuery.mockResolvedValue({ rows: [space] });

      const result = await repo.findById(3);

      expect(result).toEqual(space);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM spaces WHERE id = $1',
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
    test('inserts space and returns created row', async () => {
      const created = { id: 10, name: 'My Space', slug: 'my-space' };
      mockQuery.mockResolvedValue({ rows: [created] });

      const result = await repo.create({ name: 'My Space', slug: 'my-space', createdBy: 42 });

      expect(result).toEqual(created);
      expect(mockQuery).toHaveBeenCalledWith(
        'INSERT INTO spaces (name, slug, created_by) VALUES ($1, $2, $3) RETURNING *',
        ['My Space', 'my-space', 42]
      );
    });
  });

  describe('findBySlug', () => {
    test('returns space when found by slug', async () => {
      const space = { id: 5, name: 'Space', slug: 'space' };
      mockQuery.mockResolvedValue({ rows: [space] });

      const result = await repo.findBySlug('space');

      expect(result).toEqual(space);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM spaces WHERE slug = $1',
        ['space']
      );
    });

    test('returns null when slug not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await repo.findBySlug('non-existent');

      expect(result).toBeNull();
    });
  });
});

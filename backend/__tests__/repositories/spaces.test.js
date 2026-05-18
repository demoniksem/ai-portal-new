'use strict';

jest.mock('../../src/config', () => ({
  pool: { query: jest.fn() },
}));

// Import after mocking
const { pool } = require('../../src/config');
const { SpacesRepository } = require('../../src/repositories/spaces');

describe('SpacesRepository', () => {
  let repo;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SpacesRepository();
  });

  describe('findAll', () => {
    test('returns all spaces ordered by created_at desc', async () => {
      const spaces = [
        { id: 2, name: 'Space 2', slug: 'space-2' },
        { id: 1, name: 'Space 1', slug: 'space-1' },
      ];
      pool.query.mockResolvedValue({ rows: spaces });

      const result = await repo.findAll();

      expect(result).toEqual(spaces);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM spaces ORDER BY created_at DESC'
      );
    });
  });

  describe('findById', () => {
    test('returns space when found', async () => {
      const space = { id: 1, name: 'Space 1', slug: 'space-1' };
      pool.query.mockResolvedValue({ rows: [space] });

      const result = await repo.findById(1);

      expect(result).toEqual(space);
    });

    test('returns null when not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await repo.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    test('creates space and returns created record', async () => {
      const created = { id: 1, name: 'New Space', slug: 'new-space', created_by: 1 };
      pool.query.mockResolvedValue({ rows: [created] });

      const result = await repo.create({ name: 'New Space', slug: 'new-space', createdBy: 1 });

      expect(result).toEqual(created);
      expect(pool.query).toHaveBeenCalledWith(
        'INSERT INTO spaces (name, slug, created_by) VALUES ($1, $2, $3) RETURNING *',
        ['New Space', 'new-space', 1]
      );
    });
  });

  describe('findBySlug', () => {
    test('returns space when found by slug', async () => {
      const space = { id: 1, name: 'Space 1', slug: 'space-1' };
      pool.query.mockResolvedValue({ rows: [space] });

      const result = await repo.findBySlug('space-1');

      expect(result).toEqual(space);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM spaces WHERE slug = $1',
        ['space-1']
      );
    });

    test('returns null when slug not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await repo.findBySlug('nonexistent');

      expect(result).toBeNull();
    });
  });
});

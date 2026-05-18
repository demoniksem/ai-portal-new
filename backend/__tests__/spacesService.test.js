'use strict';

describe('SpacesService', () => {
  let spacesService;
  let mockFindAll;
  let mockCreate;

  beforeEach(() => {
    jest.resetModules();

    jest.doMock('../src/config', () => ({
      pool: { query: jest.fn() },
    }));

    mockFindAll = jest.fn();
    mockCreate = jest.fn();
    jest.doMock('../src/repositories/spaces', () => ({
      SpacesRepository: jest.fn().mockImplementation(() => ({
        findAll: mockFindAll,
        findById: jest.fn(),
        create: mockCreate,
        findBySlug: jest.fn(),
      })),
    }));

    const { SpacesService } = require('../src/services/spacesService');
    spacesService = new SpacesService();
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('getAllSpaces', () => {
    test('returns all spaces', async () => {
      const spaces = [
        { id: 1, name: 'Space A', slug: 'space-a' },
        { id: 2, name: 'Space B', slug: 'space-b' },
      ];
      mockFindAll.mockResolvedValue(spaces);

      const result = await spacesService.getAllSpaces();

      expect(result).toEqual(spaces);
      expect(mockFindAll).toHaveBeenCalledTimes(1);
    });

    test('returns empty array when no spaces exist', async () => {
      mockFindAll.mockResolvedValue([]);

      const result = await spacesService.getAllSpaces();

      expect(result).toEqual([]);
    });
  });

  describe('createSpace', () => {
    test('creates a new space successfully', async () => {
      const spaceData = { id: 1, name: 'My Space', slug: 'my-space' };
      mockCreate.mockResolvedValue(spaceData);

      const result = await spacesService.createSpace({ name: 'My Space', slug: 'my-space' }, 42);

      expect(result).toEqual({ space: spaceData });
      expect(mockCreate).toHaveBeenCalledWith({ name: 'My Space', slug: 'my-space', createdBy: 42 });
    });

    test('returns error 409 on duplicate slug (DB constraint violation)', async () => {
      const pgError = new Error('duplicate key');
      pgError.code = '23505';
      mockCreate.mockRejectedValue(pgError);

      const result = await spacesService.createSpace({ name: 'My Space', slug: 'my-space' }, 42);

      expect(result).toEqual({ error: 'Space with this slug already exists', status: 409 });
    });

    test('re-throws non-23505 errors', async () => {
      const pgError = new Error('connection refused');
      pgError.code = 'ECONNREFUSED';
      mockCreate.mockRejectedValue(pgError);

      await expect(
        spacesService.createSpace({ name: 'My Space', slug: 'my-space' }, 42)
      ).rejects.toThrow('connection refused');
    });
  });
});

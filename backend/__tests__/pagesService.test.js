'use strict';

jest.mock('../src/utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

describe('PagesService', () => {
  let pagesService;
  let mockFindAll;
  let mockFindById;
  let mockCreate;
  let mockUpdate;
  let mockSoftDelete;
  let mockRestore;
  let mockMeiliIndex;
  let mockCreateVersion;
  let mockGetVersions;
  let mockGetVersion;
  let mockRollbackToVersion;

  beforeEach(() => {
    jest.resetModules();

    mockMeiliIndex = {
      addDocuments: jest.fn(),
      updateDocuments: jest.fn(),
      deleteDocument: jest.fn(),
    };

    jest.doMock('../src/config', () => ({
      pool: { query: jest.fn() },
      meiliClient: {
        index: jest.fn().mockReturnValue(mockMeiliIndex),
      },
    }));

    mockFindAll = jest.fn();
    mockFindById = jest.fn();
    mockCreate = jest.fn();
    mockUpdate = jest.fn();
    mockSoftDelete = jest.fn();
    mockRestore = jest.fn();
    mockCreateVersion = jest.fn();
    mockGetVersions = jest.fn();
    mockGetVersion = jest.fn();
    mockRollbackToVersion = jest.fn();

    jest.doMock('../src/repositories/pages', () => ({
      PagesRepository: jest.fn().mockImplementation(() => ({
        findAll: mockFindAll,
        findById: mockFindById,
        create: mockCreate,
        update: mockUpdate,
        softDelete: mockSoftDelete,
        restore: mockRestore,
      })),
    }));

    jest.doMock('../src/repositories/pageVersions', () => ({
      PageVersionsRepository: jest.fn().mockImplementation(() => ({
        createVersion: mockCreateVersion,
        getVersions: mockGetVersions,
        getVersion: mockGetVersion,
        rollbackToVersion: mockRollbackToVersion,
      })),
    }));

    const { PagesService } = require('../src/services/pagesService');
    pagesService = new PagesService();
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('getAllPages', () => {
    test('returns all pages when no filter', async () => {
      const pages = [
        { id: 1, title: 'Page A', space_id: 1 },
        { id: 2, title: 'Page B', space_id: 2 },
      ];
      mockFindAll.mockResolvedValue(pages);

      const result = await pagesService.getAllPages();

      expect(result).toEqual(pages);
      expect(mockFindAll).toHaveBeenCalledWith({});
    });

    test('returns pages filtered by spaceId', async () => {
      const pages = [{ id: 1, title: 'Page A', space_id: 1 }];
      mockFindAll.mockResolvedValue(pages);

      const result = await pagesService.getAllPages({ spaceId: 1 });

      expect(result).toEqual(pages);
      expect(mockFindAll).toHaveBeenCalledWith({ spaceId: 1 });
    });
  });

  describe('getPageById', () => {
    test('returns the page when found', async () => {
      const page = { id: 5, title: 'Page 5', content: '{}' };
      mockFindById.mockResolvedValue(page);

      const result = await pagesService.getPageById(5);

      expect(result).toEqual(page);
      expect(mockFindById).toHaveBeenCalledWith(5);
    });

    test('returns null when page not found', async () => {
      mockFindById.mockResolvedValue(null);

      const result = await pagesService.getPageById(999);

      expect(result).toBeNull();
    });
  });

  describe('createPage', () => {
    test('creates a page and indexes it in MeiliSearch', async () => {
      const created = { id: 10, title: 'New Page', content: '{}', space_id: 1 };
      mockCreate.mockResolvedValue(created);
      mockMeiliIndex.addDocuments.mockResolvedValue({ taskUid: 1 });

      const result = await pagesService.createPage(
        { title: 'New Page', content: {}, spaceId: 1 },
        42
      );

      expect(result).toEqual(created);
      expect(mockCreate).toHaveBeenCalledWith({
        title: 'New Page',
        content: {},
        spaceId: 1,
        acl: undefined,
        createdBy: 42,
      });
      expect(mockMeiliIndex.addDocuments).toHaveBeenCalledWith([
        { id: 10, title: 'New Page', content: '{}', spaceId: 1 },
      ]);
    });

    test('creates page even if MeiliSearch indexing fails (graceful degradation)', async () => {
      const created = { id: 11, title: 'Page', content: '{}', space_id: 1 };
      mockCreate.mockResolvedValue(created);
      mockMeiliIndex.addDocuments.mockRejectedValue(new Error('Meili down'));

      // Should not throw — error is caught and logged
      const result = await pagesService.createPage(
        { title: 'Page', spaceId: 1 },
        42
      );

      expect(result).toEqual(created);
    });
  });

  describe('updatePage', () => {
    test('auto-saves a version before updating, then re-indexes in MeiliSearch', async () => {
      const currentPage = { id: 5, title: 'Old Title', content: '{}' };
      const updated = { id: 5, title: 'Updated Title', content: '{}' };
      mockFindById.mockResolvedValue(currentPage);
      mockCreateVersion.mockResolvedValue({ id: 99, page_id: 5, title: 'Old Title', content: '{}' });
      mockUpdate.mockResolvedValue(updated);
      mockMeiliIndex.updateDocuments.mockResolvedValue({ taskUid: 2 });

      const result = await pagesService.updatePage(5, { title: 'Updated Title' }, 42);

      expect(result).toEqual(updated);
      expect(mockCreateVersion).toHaveBeenCalledWith(5, {
        title: 'Old Title',
        content: '{}',
        createdBy: 42,
      });
      expect(mockUpdate).toHaveBeenCalledWith(5, { title: 'Updated Title' });
      expect(mockMeiliIndex.updateDocuments).toHaveBeenCalledWith([
        { id: 5, title: 'Updated Title', content: '{}' },
      ]);
    });

    test('returns error 404 when page not found', async () => {
      mockFindById.mockResolvedValue(null);

      const result = await pagesService.updatePage(999, { title: 'New Title' }, 42);

      expect(result).toEqual({ error: 'Page not found', status: 404 });
    });

    test('re-indexes even if MeiliSearch update fails (graceful degradation)', async () => {
      const currentPage = { id: 5, title: 'Old', content: '{}' };
      const updated = { id: 5, title: 'Updated', content: '{}' };
      mockFindById.mockResolvedValue(currentPage);
      mockCreateVersion.mockResolvedValue({ id: 99, page_id: 5, title: 'Old', content: '{}' });
      mockUpdate.mockResolvedValue(updated);
      mockMeiliIndex.updateDocuments.mockRejectedValue(new Error('Meili error'));

      const result = await pagesService.updatePage(5, { title: 'Updated' }, 42);

      expect(result).toEqual(updated);
    });
  });

  describe('deletePage (soft delete)', () => {
    test('soft-deletes a page and removes it from MeiliSearch index', async () => {
      const deleted = { id: 7, title: 'Deleted Page', deleted_at: new Date() };
      mockSoftDelete.mockResolvedValue(deleted);
      mockMeiliIndex.deleteDocument.mockResolvedValue({ taskUid: 3 });

      const result = await pagesService.deletePage(7);

      expect(result).toEqual({ message: 'Page deleted (soft)', page: deleted });
      expect(mockSoftDelete).toHaveBeenCalledWith(7);
      expect(mockMeiliIndex.deleteDocument).toHaveBeenCalledWith(7);
    });

    test('returns error 404 when page not found', async () => {
      mockSoftDelete.mockResolvedValue(null);

      const result = await pagesService.deletePage(999);

      expect(result).toEqual({ error: 'Page not found', status: 404 });
    });

    test('deletes even if MeiliSearch removal fails (graceful degradation)', async () => {
      const deleted = { id: 7, title: 'Deleted Page', deleted_at: new Date() };
      mockSoftDelete.mockResolvedValue(deleted);
      mockMeiliIndex.deleteDocument.mockRejectedValue(new Error('Meili error'));

      const result = await pagesService.deletePage(7);

      expect(result).toEqual({ message: 'Page deleted (soft)', page: deleted });
    });
  });

  describe('restorePage', () => {
    test('restores a soft-deleted page and re-indexes it in MeiliSearch', async () => {
      const restored = { id: 7, title: 'Restored Page', deleted_at: null };
      mockRestore.mockResolvedValue(restored);
      mockMeiliIndex.updateDocuments.mockResolvedValue({ taskUid: 4 });

      const result = await pagesService.restorePage(7);

      expect(result).toEqual(restored);
      expect(mockRestore).toHaveBeenCalledWith(7);
      expect(mockMeiliIndex.updateDocuments).toHaveBeenCalledWith([
        { id: 7, title: 'Restored Page', content: '{}' },
      ]);
    });

    test('returns error 404 when page not found or not deleted', async () => {
      mockRestore.mockResolvedValue(null);

      const result = await pagesService.restorePage(999);

      expect(result).toEqual({ error: 'Page not found or not deleted', status: 404 });
    });
  });

  describe('getVersions', () => {
    test('returns all versions for a page', async () => {
      const versions = [
        { id: 1, page_id: 5, title: 'v1', content: '{}' },
        { id: 2, page_id: 5, title: 'v2', content: '{}' },
      ];
      mockGetVersions.mockResolvedValue(versions);

      const result = await pagesService.getVersions(5);

      expect(result).toEqual(versions);
      expect(mockGetVersions).toHaveBeenCalledWith(5);
    });
  });

  describe('getVersion', () => {
    test('returns a specific version', async () => {
      const version = { id: 99, page_id: 5, title: 'v1', content: '{}' };
      mockGetVersion.mockResolvedValue(version);

      const result = await pagesService.getVersion(99);

      expect(result).toEqual(version);
      expect(mockGetVersion).toHaveBeenCalledWith(99);
    });

    test('returns null when version not found', async () => {
      mockGetVersion.mockResolvedValue(null);

      const result = await pagesService.getVersion(999);

      expect(result).toBeNull();
    });
  });

  describe('rollbackToVersion', () => {
    test('saves current state as version, rolls back, and re-indexes', async () => {
      const version = { id: 1, page_id: 5, title: 'Old Version', content: '{"text":"old"}' };
      const currentPage = { id: 5, title: 'Current', content: '{"text":"current"}' };
      const rolledBack = { id: 5, title: 'Old Version', content: '{"text":"old"}' };

      mockGetVersion.mockResolvedValue(version);
      mockFindById.mockResolvedValue(currentPage);
      mockCreateVersion.mockResolvedValue({ id: 100, page_id: 5, title: 'Current', content: '{"text":"current"}' });
      mockRollbackToVersion.mockResolvedValue(rolledBack);
      mockMeiliIndex.updateDocuments.mockResolvedValue({ taskUid: 5 });

      const result = await pagesService.rollbackToVersion(1, 42);

      expect(result).toEqual(rolledBack);
      expect(mockCreateVersion).toHaveBeenCalledWith(5, {
        title: 'Current',
        content: '{"text":"current"}',
        createdBy: 42,
      });
      expect(mockRollbackToVersion).toHaveBeenCalledWith(1);
    });

    test('returns error 404 when version not found', async () => {
      mockGetVersion.mockResolvedValue(null);

      const result = await pagesService.rollbackToVersion(999, 42);

      expect(result).toEqual({ error: 'Version not found', status: 404 });
    });
  });
});

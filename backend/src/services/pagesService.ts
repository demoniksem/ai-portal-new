import { PagesRepository, PageRow } from '../repositories/pages';
import { PageVersionsRepository, PageVersionDetailRow } from '../repositories/pageVersions';
import { meiliClient } from '../config';
import logger from '../utils/logger';

class PagesService {
  pagesRepo: PagesRepository;
  versionsRepo: PageVersionsRepository;

  constructor() {
    this.pagesRepo = new PagesRepository();
    this.versionsRepo = new PageVersionsRepository();
  }

  async getAllPages(opts?: { spaceId?: number; includeDeleted?: boolean }): Promise<PageRow[]> {
    return this.pagesRepo.findAll(opts || {});
  }

  async getPageById(id: number): Promise<PageRow | null> {
    return this.pagesRepo.findById(id);
  }

  async createPage(data: { title: string; content?: any; spaceId: number; parentId?: number | null; acl?: any }, userId: number): Promise<PageRow> {
    const page = await this.pagesRepo.create({ title: data.title, content: data.content, spaceId: data.spaceId, parentId: data.parentId, acl: data.acl, createdBy: userId });

    try {
      await meiliClient.index('pages').addDocuments([
        { id: page.id, title: data.title, content: JSON.stringify(data.content || {}), spaceId: data.spaceId },
      ]);
    } catch (e: any) {
      logger.error({ msg: 'Meili index error', error: e.message });
    }

    return page;
  }

  async updatePage(id: number, updates: { title?: string; content?: any; parentId?: number | null; acl?: any }, userId: number): Promise<PageRow | { error: string; status: number }> {
    const currentPage = await this.pagesRepo.findById(id);
    if (!currentPage) return { error: 'Page not found', status: 404 };

    await this.versionsRepo.createVersion(id, {
      title: currentPage.title,
      content: currentPage.content,
      createdBy: userId,
    });

    const page = await this.pagesRepo.update(id, updates);
    if (!page) return { error: 'Page not found', status: 404 };

    try {
      await meiliClient.index('pages').updateDocuments([
        { id, title: page.title, content: typeof page.content === 'string' ? page.content : JSON.stringify(page.content || {}), spaceId: page.space_id },
      ]);
    } catch (e: any) {
      logger.error({ msg: 'Meili update error', error: e.message });
    }

    return page;
  }

  async deletePage(id: number): Promise<{ message: string; page: PageRow } | { error: string; status: number }> {
    const page = await this.pagesRepo.softDelete(id);
    if (!page) return { error: 'Page not found', status: 404 };

    try {
      await meiliClient.index('pages').deleteDocument(id);
    } catch (e: any) {
      logger.error({ msg: 'Meili delete error', error: e.message });
    }

    return { message: 'Page deleted (soft)', page };
  }

  async restorePage(id: number): Promise<PageRow | { error: string; status: number }> {
    const page = await this.pagesRepo.restore(id);
    if (!page) return { error: 'Page not found or not deleted', status: 404 };

    try {
      await meiliClient.index('pages').updateDocuments([
        { id: page.id, title: page.title, content: typeof page.content === 'string' ? page.content : JSON.stringify(page.content || {}), spaceId: page.space_id },
      ]);
    } catch (e: any) {
      logger.error({ msg: 'Meili restore index error', error: e.message });
    }

    return page;
  }

  async getVersions(pageId: number): Promise<PageVersionDetailRow[]> {
    return this.versionsRepo.getVersions(pageId);
  }

  async getVersion(versionId: number): Promise<PageVersionDetailRow | null> {
    return this.versionsRepo.getVersion(versionId);
  }

  async rollbackToVersion(versionId: number, userId: number): Promise<PageRow | { error: string; status: number }> {
    const version = await this.versionsRepo.getVersion(versionId);
    if (!version) return { error: 'Version not found', status: 404 };

    const currentPage = await this.pagesRepo.findById(version.page_id);
    if (currentPage) {
      await this.versionsRepo.createVersion(version.page_id, {
        title: currentPage.title,
        content: currentPage.content,
        createdBy: userId,
      });
    }

    const page = await this.versionsRepo.rollbackToVersion(versionId);
    if (!page) return { error: 'Rollback failed', status: 500 };

    try {
      await meiliClient.index('pages').updateDocuments([
        { id: page.id, title: page.title, content: typeof page.content === 'string' ? page.content : JSON.stringify(page.content || {}), spaceId: page.space_id },
      ]);
    } catch (e: any) {
      logger.error({ msg: 'Meili rollback update error', error: e.message });
    }

    return page;
  }

  async getAttachments(pageId: number) {
    return this.pagesRepo.findAttachments(pageId);
  }

  async addAttachment(data: { pageId: number; filename: string; filePath: string; fileSize?: number; mimeType?: string; uploadedBy: number }) {
    return this.pagesRepo.addAttachment(data);
  }

  async deleteAttachment(id: number) {
    return this.pagesRepo.deleteAttachment(id);
  }

  async getChildren(parentId: number) {
    return this.pagesRepo.getChildren(parentId);
  }

  async getRootPages(spaceId: number) {
    return this.pagesRepo.getRootPages(spaceId);
  }
}

export { PagesService };
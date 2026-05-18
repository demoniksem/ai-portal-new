"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PagesService = void 0;
const pages_1 = require("../repositories/pages");
const pageVersions_1 = require("../repositories/pageVersions");
const config_1 = require("../config");
const logger_1 = __importDefault(require("../utils/logger"));
class PagesService {
    constructor() {
        this.pagesRepo = new pages_1.PagesRepository();
        this.versionsRepo = new pageVersions_1.PageVersionsRepository();
    }
    async getAllPages(opts) {
        return this.pagesRepo.findAll(opts || {});
    }
    async getPageById(id) {
        return this.pagesRepo.findById(id);
    }
    async createPage(data, userId) {
        const page = await this.pagesRepo.create({ title: data.title, content: data.content, spaceId: data.spaceId, parentId: data.parentId, acl: data.acl, createdBy: userId });
        try {
            await config_1.meiliClient.index('pages').addDocuments([
                { id: page.id, title: data.title, content: JSON.stringify(data.content || {}), spaceId: data.spaceId },
            ]);
        }
        catch (e) {
            logger_1.default.error({ msg: 'Meili index error', error: e.message });
        }
        return page;
    }
    async updatePage(id, updates, userId) {
        const currentPage = await this.pagesRepo.findById(id);
        if (!currentPage)
            return { error: 'Page not found', status: 404 };
        await this.versionsRepo.createVersion(id, {
            title: currentPage.title,
            content: currentPage.content,
            createdBy: userId,
        });
        const page = await this.pagesRepo.update(id, updates);
        if (!page)
            return { error: 'Page not found', status: 404 };
        try {
            await config_1.meiliClient.index('pages').updateDocuments([
                { id, title: page.title, content: typeof page.content === 'string' ? page.content : JSON.stringify(page.content || {}), spaceId: page.space_id },
            ]);
        }
        catch (e) {
            logger_1.default.error({ msg: 'Meili update error', error: e.message });
        }
        return page;
    }
    async deletePage(id) {
        const page = await this.pagesRepo.softDelete(id);
        if (!page)
            return { error: 'Page not found', status: 404 };
        try {
            await config_1.meiliClient.index('pages').deleteDocument(id);
        }
        catch (e) {
            logger_1.default.error({ msg: 'Meili delete error', error: e.message });
        }
        return { message: 'Page deleted (soft)', page };
    }
    async restorePage(id) {
        const page = await this.pagesRepo.restore(id);
        if (!page)
            return { error: 'Page not found or not deleted', status: 404 };
        try {
            await config_1.meiliClient.index('pages').updateDocuments([
                { id: page.id, title: page.title, content: typeof page.content === 'string' ? page.content : JSON.stringify(page.content || {}), spaceId: page.space_id },
            ]);
        }
        catch (e) {
            logger_1.default.error({ msg: 'Meili restore index error', error: e.message });
        }
        return page;
    }
    async getVersions(pageId) {
        return this.versionsRepo.getVersions(pageId);
    }
    async getVersion(versionId) {
        return this.versionsRepo.getVersion(versionId);
    }
    async rollbackToVersion(versionId, userId) {
        const version = await this.versionsRepo.getVersion(versionId);
        if (!version)
            return { error: 'Version not found', status: 404 };
        const currentPage = await this.pagesRepo.findById(version.page_id);
        if (currentPage) {
            await this.versionsRepo.createVersion(version.page_id, {
                title: currentPage.title,
                content: currentPage.content,
                createdBy: userId,
            });
        }
        const page = await this.versionsRepo.rollbackToVersion(versionId);
        if (!page)
            return { error: 'Rollback failed', status: 500 };
        try {
            await config_1.meiliClient.index('pages').updateDocuments([
                { id: page.id, title: page.title, content: typeof page.content === 'string' ? page.content : JSON.stringify(page.content || {}), spaceId: page.space_id },
            ]);
        }
        catch (e) {
            logger_1.default.error({ msg: 'Meili rollback update error', error: e.message });
        }
        return page;
    }
    async getAttachments(pageId) {
        return this.pagesRepo.findAttachments(pageId);
    }
    async addAttachment(data) {
        return this.pagesRepo.addAttachment(data);
    }
    async deleteAttachment(id) {
        return this.pagesRepo.deleteAttachment(id);
    }
    async getChildren(parentId) {
        return this.pagesRepo.getChildren(parentId);
    }
    async getRootPages(spaceId) {
        return this.pagesRepo.getRootPages(spaceId);
    }
}
exports.PagesService = PagesService;
//# sourceMappingURL=pagesService.js.map
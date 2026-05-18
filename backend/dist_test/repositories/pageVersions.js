'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageVersionsRepository = void 0;
const config_1 = require("../config");
class PageVersionsRepository {
    async createVersion(pageId, data) {
        const contentStr = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
        const result = await config_1.pool.query('INSERT INTO page_versions (page_id, title, content, created_by) VALUES ($1, $2, $3, $4) RETURNING *', [pageId, data.title, contentStr, data.createdBy]);
        return result.rows[0];
    }
    async getVersions(pageId) {
        const result = await config_1.pool.query('SELECT pv.*, u.username as created_by_username FROM page_versions pv LEFT JOIN users u ON u.id = pv.created_by WHERE pv.page_id = $1 ORDER BY pv.created_at DESC', [pageId]);
        return result.rows;
    }
    async getVersion(versionId) {
        const result = await config_1.pool.query('SELECT pv.*, u.username as created_by_username FROM page_versions pv LEFT JOIN users u ON u.id = pv.created_by WHERE pv.id = $1', [versionId]);
        return result.rows[0] || null;
    }
    async rollbackToVersion(versionId) {
        const version = await this.getVersion(versionId);
        if (!version)
            return null;
        const contentStr = typeof version.content === 'string' ? version.content : JSON.stringify(version.content);
        const result = await config_1.pool.query('UPDATE pages SET title = $1, content = $2 WHERE id = $3 RETURNING *', [version.title, contentStr, version.page_id]);
        return result.rows[0];
    }
}
exports.PageVersionsRepository = PageVersionsRepository;
//# sourceMappingURL=pageVersions.js.map
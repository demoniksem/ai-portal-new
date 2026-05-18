'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.PagesRepository = void 0;
const config_1 = require("../config");
class PagesRepository {
    async findAll(opts) {
        let query = 'SELECT * FROM pages WHERE 1=1';
        const params = [];
        if (!opts?.includeDeleted) {
            query += ' AND deleted_at IS NULL';
        }
        if (opts?.spaceId) {
            query += ' AND space_id = $' + (params.length + 1);
            params.push(opts.spaceId);
        }
        query += ' ORDER BY created_at DESC';
        const result = await config_1.pool.query(query, params);
        return result.rows;
    }
    async findById(id) {
        const result = await config_1.pool.query('SELECT * FROM pages WHERE id = $1 AND deleted_at IS NULL', [id]);
        return result.rows[0] || null;
    }
    async create(data) {
        const contentStr = data.content !== undefined
            ? (typeof data.content === 'string' ? data.content : JSON.stringify(data.content))
            : '{}';
        const aclStr = data.acl !== undefined
            ? (typeof data.acl === 'string' ? data.acl : JSON.stringify(data.acl))
            : '{}';
        const result = await config_1.pool.query('INSERT INTO pages (title, content, space_id, parent_id, acl, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [data.title, contentStr, data.spaceId, data.parentId ?? null, aclStr, data.createdBy]);
        return result.rows[0];
    }
    async update(id, data) {
        const existing = await this.findById(id);
        if (!existing)
            return null;
        const updatedTitle = data.title !== undefined ? data.title : existing.title;
        const updatedContent = data.content !== undefined ? data.content : existing.content;
        const updatedParentId = data.parentId !== undefined ? data.parentId : existing.parent_id;
        const updatedAcl = data.acl !== undefined ? data.acl : existing.acl;
        const contentStr = typeof updatedContent === 'string' ? updatedContent : JSON.stringify(updatedContent);
        const aclStr = typeof updatedAcl === 'string' ? updatedAcl : JSON.stringify(updatedAcl);
        const result = await config_1.pool.query('UPDATE pages SET title = $1, content = $2, parent_id = $3, acl = $4, updated_at = NOW() WHERE id = $5 AND deleted_at IS NULL RETURNING *', [updatedTitle, contentStr, updatedParentId, aclStr, id]);
        return result.rows[0];
    }
    async softDelete(id) {
        const result = await config_1.pool.query('UPDATE pages SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *', [id]);
        return result.rows[0] || null;
    }
    async restore(id) {
        const result = await config_1.pool.query('UPDATE pages SET deleted_at = NULL WHERE id = $1 RETURNING *', [id]);
        return result.rows[0] || null;
    }
    async getChildren(parentId) {
        const result = await config_1.pool.query('SELECT * FROM pages WHERE parent_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC', [parentId]);
        return result.rows;
    }
    async getRootPages(spaceId) {
        const result = await config_1.pool.query('SELECT * FROM pages WHERE space_id = $1 AND parent_id IS NULL AND deleted_at IS NULL ORDER BY created_at ASC', [spaceId]);
        return result.rows;
    }
    // --- Version methods ---
    async createVersion(data) {
        const contentStr = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
        const result = await config_1.pool.query('INSERT INTO page_versions (page_id, title, content, created_by) VALUES ($1, $2, $3, $4) RETURNING *', [data.pageId, data.title, contentStr, data.createdBy]);
        return result.rows[0];
    }
    async getVersions(pageId) {
        const result = await config_1.pool.query('SELECT * FROM page_versions WHERE page_id = $1 ORDER BY created_at DESC', [pageId]);
        return result.rows;
    }
    async getVersion(versionId) {
        const result = await config_1.pool.query('SELECT * FROM page_versions WHERE id = $1', [versionId]);
        return result.rows[0] || null;
    }
    async rollbackToVersion(versionId) {
        const version = await this.getVersion(versionId);
        if (!version)
            return null;
        const contentStr = typeof version.content === 'string' ? version.content : JSON.stringify(version.content);
        const result = await config_1.pool.query('UPDATE pages SET title = $1, content = $2, updated_at = NOW() WHERE id = $3 RETURNING *', [version.title, contentStr, version.page_id]);
        return result.rows[0] || null;
    }
    // --- Attachment methods ---
    async findAttachments(pageId) {
        const result = await config_1.pool.query('SELECT * FROM page_attachments WHERE page_id = $1 ORDER BY uploaded_at DESC', [pageId]);
        return result.rows;
    }
    async addAttachment(data) {
        const result = await config_1.pool.query('INSERT INTO page_attachments (page_id, filename, file_path, file_size, mime_type, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [data.pageId, data.filename, data.filePath, data.fileSize ?? null, data.mimeType ?? null, data.uploadedBy]);
        return result.rows[0];
    }
    async deleteAttachment(id) {
        const result = await config_1.pool.query('DELETE FROM page_attachments WHERE id = $1', [id]);
        return (result.rowCount ?? 0) > 0;
    }
}
exports.PagesRepository = PagesRepository;
//# sourceMappingURL=pages.js.map
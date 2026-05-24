'use strict';

import { pool } from '../config';

interface PageRow {
  id: number;
  space_id: number;
  parent_id: number | null;
  title: string;
  content: any;
  acl: any;
  created_by: number;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
}

interface PageVersionRow {
  id: number;
  page_id: number;
  title: string;
  content: any;
  created_by: number;
  created_at: Date;
}

interface PageAttachmentRow {
  id: number;
  page_id: number;
  filename: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: number | null;
  created_at: Date;
}

class PagesRepository {
  async findAll(opts?: { spaceId?: number; includeDeleted?: boolean }): Promise<PageRow[]> {
    let query = 'SELECT * FROM pages WHERE 1=1';
    const params: any[] = [];
    if (!opts?.includeDeleted) {
      query += ' AND deleted_at IS NULL';
    }
    if (opts?.spaceId) {
      query += ' AND space_id = $' + (params.length + 1);
      params.push(opts.spaceId);
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query<PageRow>(query, params);
    return result.rows;
  }

  async findById(id: number): Promise<PageRow | null> {
    const result = await pool.query<PageRow>('SELECT * FROM pages WHERE id = $1 AND deleted_at IS NULL', [id]);
    return result.rows[0] || null;
  }

  async create(data: {
    title: string;
    content?: any;
    spaceId: number;
    parentId?: number | null;
    acl?: any;
    createdBy: number;
  }): Promise<PageRow> {
    const contentStr = data.content !== undefined
      ? (typeof data.content === 'string' ? data.content : JSON.stringify(data.content))
      : '{}';
    const aclStr = data.acl !== undefined
      ? (typeof data.acl === 'string' ? data.acl : JSON.stringify(data.acl))
      : '{}';

    const result = await pool.query<PageRow>(
      'INSERT INTO pages (title, content, space_id, parent_id, acl, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [data.title, contentStr, data.spaceId, data.parentId ?? null, aclStr, data.createdBy]
    );
    return result.rows[0];
  }

  async update(id: number, data: { title?: string; content?: any; parentId?: number | null; acl?: any }): Promise<PageRow | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updatedTitle = data.title !== undefined ? data.title : existing.title;
    const updatedContent = data.content !== undefined ? data.content : existing.content;
    const updatedParentId = data.parentId !== undefined ? data.parentId : existing.parent_id;
    const updatedAcl = data.acl !== undefined ? data.acl : existing.acl;

    const contentStr = typeof updatedContent === 'string' ? updatedContent : JSON.stringify(updatedContent);
    const aclStr = typeof updatedAcl === 'string' ? updatedAcl : JSON.stringify(updatedAcl);

    const result = await pool.query<PageRow>(
      'UPDATE pages SET title = $1, content = $2, parent_id = $3, acl = $4, updated_at = NOW() WHERE id = $5 AND deleted_at IS NULL RETURNING *',
      [updatedTitle, contentStr, updatedParentId, aclStr, id]
    );
    return result.rows[0];
  }

  async softDelete(id: number): Promise<PageRow | null> {
    const result = await pool.query<PageRow>(
      'UPDATE pages SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  async restore(id: number): Promise<PageRow | null> {
    const result = await pool.query<PageRow>(
      'UPDATE pages SET deleted_at = NULL WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  async getChildren(parentId: number): Promise<PageRow[]> {
    const result = await pool.query<PageRow>(
      'SELECT * FROM pages WHERE parent_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC',
      [parentId]
    );
    return result.rows;
  }

  async getRootPages(spaceId: number): Promise<PageRow[]> {
    const result = await pool.query<PageRow>(
      'SELECT * FROM pages WHERE space_id = $1 AND parent_id IS NULL AND deleted_at IS NULL ORDER BY created_at ASC',
      [spaceId]
    );
    return result.rows;
  }

  // --- Version methods ---

  async createVersion(data: { pageId: number; title: string; content: any; createdBy: number }): Promise<PageVersionRow> {
    const contentStr = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
    const result = await pool.query<PageVersionRow>(
      'INSERT INTO page_versions (page_id, title, content, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [data.pageId, data.title, contentStr, data.createdBy]
    );
    return result.rows[0];
  }

  async getVersions(pageId: number): Promise<PageVersionRow[]> {
    const result = await pool.query<PageVersionRow>(
      'SELECT * FROM page_versions WHERE page_id = $1 ORDER BY created_at DESC',
      [pageId]
    );
    return result.rows;
  }

  async getVersion(versionId: number): Promise<PageVersionRow | null> {
    const result = await pool.query<PageVersionRow>('SELECT * FROM page_versions WHERE id = $1', [versionId]);
    return result.rows[0] || null;
  }

  async rollbackToVersion(versionId: number): Promise<PageRow | null> {
    const version = await this.getVersion(versionId);
    if (!version) return null;
    const contentStr = typeof version.content === 'string' ? version.content : JSON.stringify(version.content);
    const result = await pool.query<PageRow>(
      'UPDATE pages SET title = $1, content = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [version.title, contentStr, version.page_id]
    );
    return result.rows[0] || null;
  }

  // --- Attachment methods ---

  async findAttachments(pageId: number): Promise<PageAttachmentRow[]> {
    const result = await pool.query<PageAttachmentRow>(
      'SELECT * FROM page_attachments WHERE page_id = $1 ORDER BY created_at DESC',
      [pageId]
    );
    return result.rows;
  }

  async addAttachment(data: {
    pageId: number;
    filename: string;
    filePath: string;
    fileSize?: number;
    mimeType?: string;
    uploadedBy: number;
  }): Promise<PageAttachmentRow> {
    const result = await pool.query<PageAttachmentRow>(
      'INSERT INTO page_attachments (page_id, filename, file_path, file_size, mime_type, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [data.pageId, data.filename, data.filePath, data.fileSize ?? null, data.mimeType ?? null, data.uploadedBy]
    );
    return result.rows[0];
  }

  async deleteAttachment(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM page_attachments WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

export { PagesRepository };
export type { PageRow, PageVersionRow, PageAttachmentRow };

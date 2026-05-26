'use strict';

import { pool } from '../config';

interface Space {
  id: number;
  name: string;
  slug: string;
  created_by: number | null;
  created_at: Date;
}

class SpacesRepository {
  async findAll(): Promise<Space[]> {
    const result = await pool.query<Space>('SELECT * FROM spaces ORDER BY created_at DESC');
    return result.rows;
  }

  async findById(id: number): Promise<Space | null> {
    const result = await pool.query<Space>('SELECT * FROM spaces WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async create(data: { name: string; slug: string; createdBy: number }): Promise<Space> {
    const result = await pool.query<Space>(
      'INSERT INTO spaces (name, slug, created_by) VALUES ($1, $2, $3) RETURNING *',
      [data.name, data.slug, data.createdBy]
    );
    return result.rows[0];
  }

  async findBySlug(slug: string): Promise<Space | null> {
    const result = await pool.query<Space>('SELECT * FROM spaces WHERE slug = $1', [slug]);
    return result.rows[0] || null;
  }

  async delete(id: number): Promise<'deleted' | 'not_found' | 'has_live_pages'> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const space = await client.query('SELECT 1 FROM spaces WHERE id = $1', [id]);
      if (space.rowCount === 0) {
        await client.query('ROLLBACK');
        return 'not_found';
      }
      // Refuse to delete a space that still holds live (non-deleted) pages.
      const live = await client.query(
        'SELECT 1 FROM pages WHERE space_id = $1 AND deleted_at IS NULL LIMIT 1',
        [id]
      );
      if ((live.rowCount ?? 0) > 0) {
        await client.query('ROLLBACK');
        return 'has_live_pages';
      }
      // Only soft-deleted page rows remain. Clear FK dependents that don't cascade
      // (page_versions, and the pages.parent_id self-reference) before removing the
      // rows. page_attachments has ON DELETE CASCADE, so it follows the pages delete.
      await client.query(
        'DELETE FROM page_versions WHERE page_id IN (SELECT id FROM pages WHERE space_id = $1)',
        [id]
      );
      await client.query('UPDATE pages SET parent_id = NULL WHERE space_id = $1', [id]);
      await client.query('DELETE FROM pages WHERE space_id = $1', [id]);
      await client.query('DELETE FROM spaces WHERE id = $1', [id]);
      await client.query('COMMIT');
      return 'deleted';
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

export { SpacesRepository };
export type { Space };
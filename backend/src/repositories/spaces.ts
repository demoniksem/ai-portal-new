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

  async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM spaces WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

export { SpacesRepository };
export type { Space };
'use strict';

import { pool } from '../config';
import { Pool } from 'pg';

interface CommentRow { id: number; page_id: number; user_id: number; text: string; created_at: Date; updated_at: Date; email?: string; username?: string; }

class CommentsRepository {
  async ensureTable(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        page_id INT REFERENCES pages(id),
        user_id INT REFERENCES users(id),
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
  }

  async findByPageId(pageId: number): Promise<CommentRow[]> {
    await this.ensureTable();
    const result = await pool.query<CommentRow>(
      `SELECT c.*, u.email, u.username
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.page_id = $1
       ORDER BY c.created_at ASC`,
      [pageId]
    );
    return result.rows;
  }

  async create(data: { pageId: number; userId: number; text: string }): Promise<CommentRow> {
    await this.ensureTable();
    const result = await pool.query<CommentRow>(
      'INSERT INTO comments (page_id, user_id, text, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [data.pageId, data.userId, data.text]
    );
    return result.rows[0];
  }

  async update(id: number, data: { text: string; userId: number }): Promise<CommentRow | null> {
    const result = await pool.query<CommentRow>(
      'UPDATE comments SET text = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
      [data.text, id, data.userId]
    );
    return result.rows[0] || null;
  }

  async delete(id: number, userId: number): Promise<boolean> {
    const result = await pool.query<{ id: number }>(
      'DELETE FROM comments WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    return result.rows.length > 0;
  }
}

export { CommentsRepository };
export type { CommentRow };
'use strict';

import { pool } from '../config';
import { Pool } from 'pg';

interface NotificationRow { id: number; user_id: number; title: string; message: string; read: boolean; created_at: Date; }

class NotificationsRepository {
  async ensureTable(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INT,
        title TEXT,
        message TEXT,
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
  }

  async findByUserId(userId: number, opts?: { limit?: number }): Promise<NotificationRow[]> {
    await this.ensureTable();
    const limit = opts?.limit ?? 50;
    const result = await pool.query<NotificationRow>(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    return result.rows;
  }

  async create(data: { userId: number; title: string; message: string }): Promise<NotificationRow> {
    await this.ensureTable();
    const result = await pool.query<NotificationRow>(
      'INSERT INTO notifications (user_id, title, message, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [data.userId, data.title, data.message]
    );
    return result.rows[0];
  }

  async markRead(id: number, userId: number): Promise<NotificationRow | null> {
    const result = await pool.query<NotificationRow>(
      'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    return result.rows[0] || null;
  }

  async markAllRead(userId: number): Promise<number> {
    await this.ensureTable();
    const result = await pool.query<NotificationRow>(
      'UPDATE notifications SET read = true WHERE user_id = $1 AND read = false RETURNING *',
      [userId]
    );
    return result.rowCount ?? 0;
  }

  async countUnread(userId: number): Promise<number> {
    await this.ensureTable();
    const result = await pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = false',
      [userId]
    );
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }
}

export { NotificationsRepository };
export type { NotificationRow };
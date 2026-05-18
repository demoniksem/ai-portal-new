'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsRepository = void 0;
const config_1 = require("../config");
class NotificationsRepository {
    async ensureTable() {
        await config_1.pool.query(`
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
    async findByUserId(userId, opts) {
        await this.ensureTable();
        const limit = opts?.limit ?? 50;
        const result = await config_1.pool.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [userId, limit]);
        return result.rows;
    }
    async create(data) {
        await this.ensureTable();
        const result = await config_1.pool.query('INSERT INTO notifications (user_id, title, message, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *', [data.userId, data.title, data.message]);
        return result.rows[0];
    }
    async markRead(id, userId) {
        const result = await config_1.pool.query('UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2 RETURNING *', [id, userId]);
        return result.rows[0] || null;
    }
    async markAllRead(userId) {
        await this.ensureTable();
        const result = await config_1.pool.query('UPDATE notifications SET read = true WHERE user_id = $1 AND read = false RETURNING *', [userId]);
        return result.rowCount ?? 0;
    }
    async countUnread(userId) {
        await this.ensureTable();
        const result = await config_1.pool.query('SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = false', [userId]);
        return parseInt(result.rows[0]?.count ?? '0', 10);
    }
}
exports.NotificationsRepository = NotificationsRepository;
//# sourceMappingURL=notifications.js.map
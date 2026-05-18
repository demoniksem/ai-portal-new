'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentsRepository = void 0;
const config_1 = require("../config");
class CommentsRepository {
    async ensureTable() {
        await config_1.pool.query(`
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
    async findByPageId(pageId) {
        await this.ensureTable();
        const result = await config_1.pool.query(`SELECT c.*, u.email, u.username
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.page_id = $1
       ORDER BY c.created_at ASC`, [pageId]);
        return result.rows;
    }
    async create(data) {
        await this.ensureTable();
        const result = await config_1.pool.query('INSERT INTO comments (page_id, user_id, text, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *', [data.pageId, data.userId, data.text]);
        return result.rows[0];
    }
    async update(id, data) {
        const result = await config_1.pool.query('UPDATE comments SET text = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *', [data.text, id, data.userId]);
        return result.rows[0] || null;
    }
    async delete(id, userId) {
        const result = await config_1.pool.query('DELETE FROM comments WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
        return result.rows.length > 0;
    }
}
exports.CommentsRepository = CommentsRepository;
//# sourceMappingURL=comments.js.map
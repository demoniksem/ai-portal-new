'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpacesRepository = void 0;
const config_1 = require("../config");
class SpacesRepository {
    async findAll() {
        const result = await config_1.pool.query('SELECT * FROM spaces ORDER BY created_at DESC');
        return result.rows;
    }
    async findById(id) {
        const result = await config_1.pool.query('SELECT * FROM spaces WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
    async create(data) {
        const result = await config_1.pool.query('INSERT INTO spaces (name, slug, created_by) VALUES ($1, $2, $3) RETURNING *', [data.name, data.slug, data.createdBy]);
        return result.rows[0];
    }
    async findBySlug(slug) {
        const result = await config_1.pool.query('SELECT * FROM spaces WHERE slug = $1', [slug]);
        return result.rows[0] || null;
    }
    async delete(id) {
        const result = await config_1.pool.query('DELETE FROM spaces WHERE id = $1', [id]);
        return (result.rowCount ?? 0) > 0;
    }
}
exports.SpacesRepository = SpacesRepository;
//# sourceMappingURL=spaces.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpacesService = void 0;
const spaces_1 = require("../repositories/spaces");
const config_1 = require("../config");
const spacesRepo = new spaces_1.SpacesRepository();
class SpacesService {
    async getAllSpaces() {
        return spacesRepo.findAll();
    }
    async createSpace(data, userId) {
        try {
            const space = await spacesRepo.create({ name: data.name, slug: data.slug, createdBy: userId });
            return { space };
        }
        catch (e) {
            if (e.code === '23505') {
                return { error: 'Space with this slug already exists', status: 409 };
            }
            throw e;
        }
    }
    async getSpaceById(id) {
        const space = await spacesRepo.findById(id);
        if (!space)
            return null;
        const [countResult, activeCountResult, recentResult] = await Promise.all([
            config_1.pool.query('SELECT COUNT(*) as count FROM pages WHERE space_id = $1', [id]),
            config_1.pool.query('SELECT COUNT(*) as count FROM pages WHERE space_id = $1 AND deleted_at IS NULL', [id]),
            config_1.pool.query('SELECT id, title, updated_at FROM pages WHERE space_id = $1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 5', [id]),
        ]);
        return {
            ...space,
            page_count: parseInt(countResult.rows[0]?.count ?? '0', 10),
            active_page_count: parseInt(activeCountResult.rows[0]?.count ?? '0', 10),
            recent_pages: recentResult.rows.map(r => ({
                id: r.id,
                title: r.title,
                updated_at: r.updated_at.toISOString(),
            })),
        };
    }
    async deleteSpace(id) {
        const deleted = await spacesRepo.delete(id);
        if (!deleted) {
            return { error: 'Space not found', status: 404 };
        }
        return { success: true };
    }
}
exports.SpacesService = SpacesService;
//# sourceMappingURL=spacesService.js.map
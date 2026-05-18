'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoardsRepository = void 0;
const config_1 = require("../config");
// ─── BoardsRepository ──────────────────────────────────────────────────────────
class BoardsRepository {
    // Boards
    async findAll(filters) {
        let query = 'SELECT * FROM boards WHERE 1=1';
        const params = [];
        if (filters?.spaceId) {
            params.push(filters.spaceId);
            query += ` AND space_id = $${params.length}`;
        }
        if (filters?.departmentId) {
            params.push(filters.departmentId);
            query += ` AND department_id = $${params.length}`;
        }
        query += ' ORDER BY created_at ASC';
        const result = await config_1.pool.query(query, params);
        return result.rows;
    }
    async findById(id) {
        const result = await config_1.pool.query('SELECT * FROM boards WHERE id = $1', [id]);
        return result.rows[0] ?? null;
    }
    async create(data) {
        const result = await config_1.pool.query(`INSERT INTO boards (space_id, department_id, name, description, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`, [data.spaceId ?? null, data.departmentId ?? null, data.name, data.description ?? null, data.createdBy ?? null]);
        return result.rows[0];
    }
    async update(id, data) {
        const fields = [];
        const vals = [];
        if (data.name !== undefined) {
            vals.push(data.name);
            fields.push(`name=$${vals.length}`);
        }
        if (data.description !== undefined) {
            vals.push(data.description);
            fields.push(`description=$${vals.length}`);
        }
        if (!fields.length)
            return this.findById(id);
        vals.push(id);
        const result = await config_1.pool.query(`UPDATE boards SET ${fields.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
        return result.rows[0] ?? null;
    }
    async delete(id) {
        const result = await config_1.pool.query('DELETE FROM boards WHERE id=$1', [id]);
        return (result.rowCount ?? 0) > 0;
    }
    // Columns
    async findColumnsByBoardId(boardId) {
        const result = await config_1.pool.query('SELECT * FROM board_columns WHERE board_id = $1 ORDER BY position ASC', [boardId]);
        return result.rows;
    }
    async findColumnById(id) {
        const result = await config_1.pool.query('SELECT * FROM board_columns WHERE id = $1', [id]);
        return result.rows[0] ?? null;
    }
    async createColumn(data) {
        const result = await config_1.pool.query(`INSERT INTO board_columns (board_id, name, position, wip_limit)
       VALUES ($1, $2, $3, $4) RETURNING *`, [data.boardId, data.name, data.position ?? 0, data.wipLimit ?? null]);
        return result.rows[0];
    }
    async updateColumn(id, data) {
        const fields = [];
        const vals = [];
        if (data.name !== undefined) {
            vals.push(data.name);
            fields.push(`name=$${vals.length}`);
        }
        if (data.wipLimit !== undefined) {
            vals.push(data.wipLimit);
            fields.push(`wip_limit=$${vals.length}`);
        }
        if (!fields.length)
            return this.findColumnById(id);
        vals.push(id);
        const result = await config_1.pool.query(`UPDATE board_columns SET ${fields.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
        return result.rows[0] ?? null;
    }
    async reorderColumn(id, position) {
        const result = await config_1.pool.query('UPDATE board_columns SET position = $1 WHERE id = $2 RETURNING *', [position, id]);
        return result.rows[0] ?? null;
    }
    async deleteColumn(id) {
        const result = await config_1.pool.query('DELETE FROM board_columns WHERE id=$1', [id]);
        return (result.rowCount ?? 0) > 0;
    }
    // Swimlanes
    async findSwimlanesByBoardId(boardId) {
        const result = await config_1.pool.query('SELECT * FROM swimlanes WHERE board_id = $1 ORDER BY position ASC', [boardId]);
        return result.rows;
    }
    async createSwimlane(data) {
        const result = await config_1.pool.query('INSERT INTO swimlanes (board_id, name, position) VALUES ($1, $2, $3) RETURNING *', [data.boardId, data.name, data.position ?? 0]);
        return result.rows[0];
    }
    async updateSwimlane(id, data) {
        const result = await config_1.pool.query('UPDATE swimlanes SET name = $1 WHERE id = $2 RETURNING *', [data.name, id]);
        return result.rows[0] ?? null;
    }
    async deleteSwimlane(id) {
        const result = await config_1.pool.query('DELETE FROM swimlanes WHERE id=$1', [id]);
        return (result.rowCount ?? 0) > 0;
    }
    // Labels
    async findLabelsByBoardId(boardId) {
        const result = await config_1.pool.query('SELECT * FROM labels WHERE board_id = $1 ORDER BY created_at ASC', [boardId]);
        return result.rows;
    }
    async createLabel(data) {
        const result = await config_1.pool.query('INSERT INTO labels (board_id, name, color) VALUES ($1, $2, $3) RETURNING *', [data.boardId, data.name, data.color ?? '#6b7280']);
        return result.rows[0];
    }
    async deleteLabel(id) {
        const result = await config_1.pool.query('DELETE FROM labels WHERE id=$1', [id]);
        return (result.rowCount ?? 0) > 0;
    }
    // Custom Field Definitions
    async findCustomFieldDefsByBoardId(boardId) {
        const result = await config_1.pool.query('SELECT * FROM custom_field_definitions WHERE board_id = $1 ORDER BY position ASC', [boardId]);
        return result.rows;
    }
    async createCustomFieldDef(data) {
        const result = await config_1.pool.query(`INSERT INTO custom_field_definitions (board_id, name, field_type, options, position)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`, [data.boardId, data.name, data.fieldType ?? 'text', JSON.stringify(data.options ?? []), data.position ?? 0]);
        return result.rows[0];
    }
    async updateCustomFieldDef(id, data) {
        const fields = [];
        const vals = [];
        if (data.name !== undefined) {
            vals.push(data.name);
            fields.push(`name=$${vals.length}`);
        }
        if (data.fieldType !== undefined) {
            vals.push(data.fieldType);
            fields.push(`field_type=$${vals.length}`);
        }
        if (data.options !== undefined) {
            vals.push(JSON.stringify(data.options));
            fields.push(`options=$${vals.length}`);
        }
        if (data.position !== undefined) {
            vals.push(data.position);
            fields.push(`position=$${vals.length}`);
        }
        if (!fields.length)
            return null;
        vals.push(id);
        const result = await config_1.pool.query(`UPDATE custom_field_definitions SET ${fields.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
        return result.rows[0] ?? null;
    }
    async deleteCustomFieldDef(id) {
        const result = await config_1.pool.query('DELETE FROM custom_field_definitions WHERE id=$1', [id]);
        return (result.rowCount ?? 0) > 0;
    }
    // Card Templates
    async findTemplatesByBoardId(boardId) {
        const result = await config_1.pool.query('SELECT * FROM card_templates WHERE board_id = $1 ORDER BY created_at ASC', [boardId]);
        return result.rows;
    }
    async findTemplateById(id) {
        const result = await config_1.pool.query('SELECT * FROM card_templates WHERE id = $1', [id]);
        return result.rows[0] ?? null;
    }
    async createTemplate(data) {
        const result = await config_1.pool.query(`INSERT INTO card_templates (board_id, name, description, type, title_template, description_template, fields)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`, [
            data.boardId, data.name, data.description ?? null, data.type ?? 'task',
            data.titleTemplate ?? null, data.descriptionTemplate ?? null, JSON.stringify(data.fields ?? {})
        ]);
        return result.rows[0];
    }
    async deleteTemplate(id) {
        const result = await config_1.pool.query('DELETE FROM card_templates WHERE id=$1', [id]);
        return (result.rowCount ?? 0) > 0;
    }
    // Board Membership
    async findMembersByBoardId(boardId) {
        const result = await config_1.pool.query(`SELECT ob.id, ob.user_id, ob.object_type, ob.role, ob.inherited, ob.created_at,
              u.email, u.full_name, u.avatar_url
       FROM object_roles ob
       JOIN rbac_users u ON ob.user_id = u.id
       WHERE ob.object_type = 'board' AND ob.object_id = $1
       ORDER BY ob.created_at ASC`, [boardId]);
        return result.rows;
    }
    async addBoardMember(data) {
        const result = await config_1.pool.query(`INSERT INTO object_roles (user_id, object_type, object_id, role)
       VALUES ($1, 'board', $2, $3)
       ON CONFLICT (user_id, object_type, object_id)
       DO UPDATE SET role = $3
       RETURNING *`, [data.userId, data.boardId, data.role ?? 'editor']);
        return result.rows[0];
    }
    async updateBoardMemberRole(memberId, role) {
        const result = await config_1.pool.query('UPDATE object_roles SET role = $1 WHERE id = $2 RETURNING *', [role, memberId]);
        return result.rows[0] ?? null;
    }
    async removeBoardMember(memberId) {
        const result = await config_1.pool.query('DELETE FROM object_roles WHERE id = $1 AND object_type = $2', [memberId, 'board']);
        return (result.rowCount ?? 0) > 0;
    }
}
exports.BoardsRepository = BoardsRepository;
//# sourceMappingURL=boards.js.map
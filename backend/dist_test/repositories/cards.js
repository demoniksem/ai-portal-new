"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardsRepository = void 0;
const config_1 = require("../config");
class CardsRepository {
    async findAll(opts) {
        let query = 'SELECT * FROM cards WHERE 1=1';
        const params = [];
        if (opts?.boardId) {
            params.push(opts.boardId);
            query += ` AND board_id = $${params.length}`;
        }
        if (opts?.columnId) {
            params.push(opts.columnId);
            query += ` AND column_id = $${params.length}`;
        }
        query += ' ORDER BY position ASC';
        const result = await config_1.pool.query(query, params);
        return result.rows;
    }
    async findById(id) {
        const result = await config_1.pool.query('SELECT * FROM cards WHERE id = $1', [id]);
        return result.rows[0] ?? null;
    }
    async findByIdWithRelations(id) {
        const card = await this.findById(id);
        if (!card)
            return null;
        const [assignees, labels] = await Promise.all([
            config_1.pool.query('SELECT user_id FROM card_assignees WHERE card_id = $1', [id]),
            config_1.pool.query('SELECT label_id FROM card_labels WHERE card_id = $1', [id]),
        ]);
        return {
            ...card,
            assignee_ids: assignees.rows.map(r => r.user_id),
            label_ids: labels.rows.map(r => r.label_id),
        };
    }
    async create(data) {
        const result = await config_1.pool.query(`INSERT INTO cards (board_id, column_id, title, type, description, priority, position, author_id, swimlane_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [data.boardId, data.columnId, data.title, data.type ?? 'task', data.description ?? null,
            data.priority ?? 'medium', data.position ?? 0, data.authorId ?? null, data.swimlaneId ?? null]);
        return result.rows[0];
    }
    async update(id, data) {
        const fields = [];
        const vals = [];
        let p = 0;
        if (data.title !== undefined) {
            vals.push(data.title);
            fields.push(`title=$${++p}`);
        }
        if (data.description !== undefined) {
            vals.push(data.description);
            fields.push(`description=$${++p}`);
        }
        if (data.type !== undefined) {
            vals.push(data.type);
            fields.push(`type=$${++p}`);
        }
        if (data.priority !== undefined) {
            vals.push(data.priority);
            fields.push(`priority=$${++p}`);
        }
        if (data.columnId !== undefined) {
            vals.push(data.columnId);
            fields.push(`column_id=$${++p}`);
        }
        if (data.swimlaneId !== undefined) {
            vals.push(data.swimlaneId);
            fields.push(`swimlane_id=$${++p}`);
        }
        if (data.position !== undefined) {
            vals.push(data.position);
            fields.push(`position=$${++p}`);
        }
        if (data.color !== undefined) {
            vals.push(data.color);
            fields.push(`color=$${++p}`);
        }
        if (data.coverImage !== undefined) {
            vals.push(data.coverImage);
            fields.push(`cover_image=$${++p}`);
        }
        if (data.archivedAt !== undefined) {
            vals.push(data.archivedAt);
            fields.push(`archived_at=$${++p}`);
        }
        if (data.startDate !== undefined) {
            vals.push(data.startDate);
            fields.push(`start_date=$${++p}`);
        }
        if (data.deadline !== undefined) {
            vals.push(data.deadline);
            fields.push(`deadline=$${++p}`);
        }
        if (data.estimate !== undefined) {
            vals.push(data.estimate);
            fields.push(`estimate=$${++p}`);
        }
        if (data.actual !== undefined) {
            vals.push(data.actual);
            fields.push(`actual=$${++p}`);
        }
        if (!fields.length)
            return this.findById(id);
        vals.push(id);
        const result = await config_1.pool.query(`UPDATE cards SET ${fields.join(',')} WHERE id=$${p + 1} RETURNING *`, vals);
        return result.rows[0] ?? null;
    }
    async delete(id) {
        const result = await config_1.pool.query('DELETE FROM cards WHERE id=$1', [id]);
        return (result.rowCount ?? 0) > 0;
    }
    async addAssignee(cardId, userId) {
        await config_1.pool.query('INSERT INTO card_assignees (card_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [cardId, userId]);
    }
    async removeAssignee(cardId, userId) {
        await config_1.pool.query('DELETE FROM card_assignees WHERE card_id=$1 AND user_id=$2', [cardId, userId]);
    }
    async setLabels(cardId, labelIds) {
        await config_1.pool.query('DELETE FROM card_labels WHERE card_id=$1', [cardId]);
        if (labelIds.length > 0) {
            const values = labelIds.map((lid, i) => `($1, $${i + 2})`).join(',');
            await config_1.pool.query(`INSERT INTO card_labels (card_id, label_id) VALUES ${values}`, [cardId, ...labelIds]);
        }
    }
    async addComment(cardId, authorId, content, mentions) {
        await config_1.pool.query('INSERT INTO card_comments (card_id, author_id, content, mentions) VALUES ($1,$2,$3,$4)', [cardId, authorId, content, JSON.stringify(mentions ?? [])]);
    }
    async logActivity(cardId, actorId, action, field, oldValue, newValue, metadata) {
        await config_1.pool.query('INSERT INTO card_activity_log (card_id, actor_id, action, field, old_value, new_value, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7)', [cardId, actorId, action, field ?? null, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, metadata ? JSON.stringify(metadata) : null]);
    }
    // Alias for delete (used by service)
    async deleteCard(id) {
        return this.delete(id);
    }
    // Labels
    async removeLabel(cardId, labelId) {
        await config_1.pool.query('DELETE FROM card_labels WHERE card_id=$1 AND label_id=$2', [cardId, labelId]);
    }
    // Assignees
    async setAssignees(cardId, userIds) {
        await config_1.pool.query('DELETE FROM card_assignees WHERE card_id=$1', [cardId]);
        if (userIds.length > 0) {
            const values = userIds.map((uid, i) => `($1, $${i + 2})`).join(',');
            await config_1.pool.query(`INSERT INTO card_assignees (card_id, user_id) VALUES ${values}`, [cardId, ...userIds]);
        }
    }
    // Custom Fields
    async setCardCustomFields(cardId, fields) {
        for (const [fieldId, value] of Object.entries(fields)) {
            await config_1.pool.query(`INSERT INTO card_custom_fields (card_id, field_id, value)
         VALUES ($1, $2, $3)
         ON CONFLICT (card_id, field_id) DO UPDATE SET value=$3, updated_at=NOW()`, [cardId, fieldId, JSON.stringify(value)]);
        }
    }
    // Checklists
    async createChecklist(cardId, title, position) {
        const result = await config_1.pool.query('INSERT INTO card_checklists (card_id, title, position) VALUES ($1, $2, $3) RETURNING *', [cardId, title, position ?? 0]);
        return result.rows[0];
    }
    async addChecklistItem(checklistId, text, position) {
        const result = await config_1.pool.query('INSERT INTO checklist_items (checklist_id, text, position) VALUES ($1, $2, $3) RETURNING *', [checklistId, text, position ?? 0]);
        return result.rows[0];
    }
    async updateChecklistItem(itemId, data) {
        const fields = [];
        const vals = [];
        if (data.text !== undefined) {
            vals.push(data.text);
            fields.push(`text=$${vals.length}`);
        }
        if (data.checked !== undefined) {
            vals.push(data.checked);
            fields.push(`checked=$${vals.length}`);
        }
        if (data.position !== undefined) {
            vals.push(data.position);
            fields.push(`position=$${vals.length}`);
        }
        if (!fields.length)
            return null;
        vals.push(itemId);
        const result = await config_1.pool.query(`UPDATE checklist_items SET ${fields.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
        return result.rows[0] ?? null;
    }
    async deleteChecklistItem(itemId) {
        await config_1.pool.query('DELETE FROM checklist_items WHERE id=$1', [itemId]);
    }
    // Comments — return row
    async addCommentRow(cardId, authorId, content, mentions) {
        const result = await config_1.pool.query('INSERT INTO card_comments (card_id, author_id, content, mentions) VALUES ($1,$2,$3,$4) RETURNING *', [cardId, authorId, content, JSON.stringify(mentions ?? [])]);
        return result.rows[0];
    }
    async findByAssignee(userId) {
        const result = await config_1.pool.query(`SELECT c.* FROM cards c
       INNER JOIN card_assignees ca ON ca.card_id = c.id
       WHERE ca.user_id = $1 AND c.archived_at IS NULL
       ORDER BY c.deadline ASC NULLS LAST, c.position ASC`, [userId]);
        return result.rows;
    }
    async findByDeadlineRange(start, end) {
        const result = await config_1.pool.query(`SELECT c.* FROM cards c
       INNER JOIN card_assignees ca ON ca.card_id = c.id
       WHERE c.deadline >= $1 AND c.deadline <= $2 AND c.archived_at IS NULL
       ORDER BY c.deadline ASC`, [start, end]);
        return result.rows;
    }
}
exports.CardsRepository = CardsRepository;
//# sourceMappingURL=cards.js.map
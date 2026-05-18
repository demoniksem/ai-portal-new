import { pool } from '../config';
import { QueryResult } from 'pg';

export interface CardRow {
  id: string;
  board_id: string;
  column_id: string;
  swimlane_id: string | null;
  type: string;
  title: string;
  description: string | null;
  priority: string;
  position: number;
  author_id: string | null;
  cover_image: string | null;
  color: string | null;
  archived_at: string | null;
  start_date: string | null;
  deadline: string | null;
  estimate: string | null;
  actual: string | null;
  created_at: string;
  updated_at: string;
}

export interface CardDetailRow extends CardRow {
  assignee_ids: string[];
  label_ids: string[];
}

export class CardsRepository {
  async findAll(opts?: { boardId?: string; columnId?: string }): Promise<CardRow[]> {
    let query = 'SELECT * FROM cards WHERE 1=1';
    const params: string[] = [];
    if (opts?.boardId) { params.push(opts.boardId); query += ` AND board_id = $${params.length}`; }
    if (opts?.columnId) { params.push(opts.columnId); query += ` AND column_id = $${params.length}`; }
    query += ' ORDER BY position ASC';
    const result: QueryResult = await pool.query(query, params);
    return result.rows as CardRow[];
  }

  async findById(id: string): Promise<CardRow | null> {
    const result: QueryResult = await pool.query('SELECT * FROM cards WHERE id = $1', [id]);
    return (result.rows[0] as CardRow) ?? null;
  }

  async findByIdWithRelations(id: string): Promise<CardDetailRow | null> {
    const card = await this.findById(id);
    if (!card) return null;
    const [assignees, labels] = await Promise.all([
      pool.query<{ user_id: string }>('SELECT user_id FROM card_assignees WHERE card_id = $1', [id]),
      pool.query<{ label_id: string }>('SELECT label_id FROM card_labels WHERE card_id = $1', [id]),
    ]);
    return {
      ...card,
      assignee_ids: assignees.rows.map(r => r.user_id),
      label_ids: labels.rows.map(r => r.label_id),
    };
  }

  async create(data: {
    boardId: string; columnId: string; title: string; type?: string; description?: string;
    priority?: string; position?: number; authorId?: string; swimlaneId?: string;
  }): Promise<CardRow> {
    const result: QueryResult = await pool.query(
      `INSERT INTO cards (board_id, column_id, title, type, description, priority, position, author_id, swimlane_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [data.boardId, data.columnId, data.title, data.type ?? 'task', data.description ?? null,
       data.priority ?? 'medium', data.position ?? 0, data.authorId ?? null, data.swimlaneId ?? null]
    );
    return result.rows[0] as CardRow;
  }

  async update(id: string, data: {
    title?: string; description?: string; type?: string; priority?: string;
    columnId?: string; swimlaneId?: string; position?: number; color?: string;
    coverImage?: string; archivedAt?: string | null; startDate?: string; deadline?: string;
    estimate?: number; actual?: number;
  }): Promise<CardRow | null> {
    const fields: string[] = []; const vals: any[] = []; let p = 0;
    if (data.title !== undefined) { vals.push(data.title); fields.push(`title=$${++p}`); }
    if (data.description !== undefined) { vals.push(data.description); fields.push(`description=$${++p}`); }
    if (data.type !== undefined) { vals.push(data.type); fields.push(`type=$${++p}`); }
    if (data.priority !== undefined) { vals.push(data.priority); fields.push(`priority=$${++p}`); }
    if (data.columnId !== undefined) { vals.push(data.columnId); fields.push(`column_id=$${++p}`); }
    if (data.swimlaneId !== undefined) { vals.push(data.swimlaneId); fields.push(`swimlane_id=$${++p}`); }
    if (data.position !== undefined) { vals.push(data.position); fields.push(`position=$${++p}`); }
    if (data.color !== undefined) { vals.push(data.color); fields.push(`color=$${++p}`); }
    if (data.coverImage !== undefined) { vals.push(data.coverImage); fields.push(`cover_image=$${++p}`); }
    if (data.archivedAt !== undefined) { vals.push(data.archivedAt); fields.push(`archived_at=$${++p}`); }
    if (data.startDate !== undefined) { vals.push(data.startDate); fields.push(`start_date=$${++p}`); }
    if (data.deadline !== undefined) { vals.push(data.deadline); fields.push(`deadline=$${++p}`); }
    if (data.estimate !== undefined) { vals.push(data.estimate); fields.push(`estimate=$${++p}`); }
    if (data.actual !== undefined) { vals.push(data.actual); fields.push(`actual=$${++p}`); }
    if (!fields.length) return this.findById(id);
    vals.push(id);
    const result: QueryResult = await pool.query(
      `UPDATE cards SET ${fields.join(',')} WHERE id=$${p+1} RETURNING *`,
      vals
    );
    return (result.rows[0] as CardRow) ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result: QueryResult = await pool.query('DELETE FROM cards WHERE id=$1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async addAssignee(cardId: string, userId: string): Promise<void> {
    await pool.query(
      'INSERT INTO card_assignees (card_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [cardId, userId]
    );
  }

  async removeAssignee(cardId: string, userId: string): Promise<void> {
    await pool.query('DELETE FROM card_assignees WHERE card_id=$1 AND user_id=$2', [cardId, userId]);
  }

  async setLabels(cardId: string, labelIds: string[]): Promise<void> {
    await pool.query('DELETE FROM card_labels WHERE card_id=$1', [cardId]);
    if (labelIds.length > 0) {
      const values = labelIds.map((lid, i) => `($1, $${i+2})`).join(',');
      await pool.query(`INSERT INTO card_labels (card_id, label_id) VALUES ${values}`, [cardId, ...labelIds]);
    }
  }

  async addComment(cardId: string, authorId: string, content: string, mentions?: string[]): Promise<void> {
    await pool.query(
      'INSERT INTO card_comments (card_id, author_id, content, mentions) VALUES ($1,$2,$3,$4)',
      [cardId, authorId, content, JSON.stringify(mentions ?? [])]
    );
  }

  async logActivity(cardId: string, actorId: string | null, action: string, field?: string, oldValue?: any, newValue?: any, metadata?: any): Promise<void> {
    await pool.query(
      'INSERT INTO card_activity_log (card_id, actor_id, action, field, old_value, new_value, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [cardId, actorId, action, field ?? null, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, metadata ? JSON.stringify(metadata) : null]
    );
  }

  // Alias for delete (used by service)
  async deleteCard(id: string): Promise<boolean> {
    return this.delete(id);
  }

  // Labels
  async removeLabel(cardId: string, labelId: string): Promise<void> {
    await pool.query('DELETE FROM card_labels WHERE card_id=$1 AND label_id=$2', [cardId, labelId]);
  }

  // Assignees
  async setAssignees(cardId: string, userIds: string[]): Promise<void> {
    await pool.query('DELETE FROM card_assignees WHERE card_id=$1', [cardId]);
    if (userIds.length > 0) {
      const values = userIds.map((uid, i) => `($1, $${i+2})`).join(',');
      await pool.query(`INSERT INTO card_assignees (card_id, user_id) VALUES ${values}`, [cardId, ...userIds]);
    }
  }

  // Custom Fields
  async setCardCustomFields(cardId: string, fields: Record<string, unknown>): Promise<void> {
    for (const [fieldId, value] of Object.entries(fields)) {
      await pool.query(
        `INSERT INTO card_custom_fields (card_id, field_id, value)
         VALUES ($1, $2, $3)
         ON CONFLICT (card_id, field_id) DO UPDATE SET value=$3, updated_at=NOW()`,
        [cardId, fieldId, JSON.stringify(value)]
      );
    }
  }

  // Checklists
  async createChecklist(cardId: string, title: string, position?: number): Promise<{ id: string; card_id: string; title: string; position: number }> {
    const result = await pool.query(
      'INSERT INTO card_checklists (card_id, title, position) VALUES ($1, $2, $3) RETURNING *',
      [cardId, title, position ?? 0]
    );
    return result.rows[0];
  }

  async addChecklistItem(checklistId: string, text: string, position?: number): Promise<{ id: string; checklist_id: string; text: string; checked: boolean; position: number }> {
    const result = await pool.query(
      'INSERT INTO checklist_items (checklist_id, text, position) VALUES ($1, $2, $3) RETURNING *',
      [checklistId, text, position ?? 0]
    );
    return result.rows[0];
  }

  async updateChecklistItem(itemId: string, data: { text?: string; checked?: boolean; position?: number }): Promise<{ id: string; checklist_id: string; text: string; checked: boolean; position: number } | null> {
    const fields: string[] = []; const vals: unknown[] = [];
    if (data.text !== undefined) { vals.push(data.text); fields.push(`text=$${vals.length}`); }
    if (data.checked !== undefined) { vals.push(data.checked); fields.push(`checked=$${vals.length}`); }
    if (data.position !== undefined) { vals.push(data.position); fields.push(`position=$${vals.length}`); }
    if (!fields.length) return null;
    vals.push(itemId);
    const result = await pool.query(
      `UPDATE checklist_items SET ${fields.join(',')} WHERE id=$${vals.length} RETURNING *`,
      vals
    );
    return result.rows[0] ?? null;
  }

  async deleteChecklistItem(itemId: string): Promise<void> {
    await pool.query('DELETE FROM checklist_items WHERE id=$1', [itemId]);
  }

  // Comments — return row
  async addCommentRow(cardId: string, authorId: string, content: string, mentions?: string[]): Promise<{ id: string; card_id: string; author_id: string; content: string }> {
    const result = await pool.query(
      'INSERT INTO card_comments (card_id, author_id, content, mentions) VALUES ($1,$2,$3,$4) RETURNING *',
      [cardId, authorId, content, JSON.stringify(mentions ?? [])]
    );
    return result.rows[0];
  }

  async findByAssignee(userId: string): Promise<CardRow[]> {
    const result: QueryResult = await pool.query(
      `SELECT c.* FROM cards c
       INNER JOIN card_assignees ca ON ca.card_id = c.id
       WHERE ca.user_id = $1 AND c.archived_at IS NULL
       ORDER BY c.deadline ASC NULLS LAST, c.position ASC`,
      [userId]
    );
    return result.rows as CardRow[];
  }

  async findByDeadlineRange(start: string, end: string): Promise<CardRow[]> {
    const result: QueryResult = await pool.query(
      `SELECT c.* FROM cards c
       INNER JOIN card_assignees ca ON ca.card_id = c.id
       WHERE c.deadline >= $1 AND c.deadline <= $2 AND c.archived_at IS NULL
       ORDER BY c.deadline ASC`,
      [start, end]
    );
    return result.rows as CardRow[];
  }
}

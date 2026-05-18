'use strict';

import { pool } from '../config';
import { QueryResult } from 'pg';

// ─── Board row types ──────────────────────────────────────────────────────────

export interface BoardRow {
  id: string;
  space_id: string | null;
  department_id: string | null;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface BoardColumnRow {
  id: string;
  board_id: string;
  name: string;
  position: number;
  wip_limit: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface SwimlaneRow {
  id: string;
  board_id: string;
  name: string;
  position: number;
  created_at: Date;
  updated_at: Date;
}

export interface LabelRow {
  id: string;
  board_id: string;
  name: string;
  color: string;
  created_at: Date;
}

export interface CustomFieldDefRow {
  id: string;
  board_id: string;
  name: string;
  field_type: string;
  options: unknown;
  position: number;
  created_at: Date;
}

export interface CardTemplateRow {
  id: string;
  board_id: string;
  name: string;
  description: string | null;
  type: string;
  title_template: string | null;
  description_template: string | null;
  fields: unknown;
  created_at: Date;
  updated_at: Date;
}

// ─── BoardsRepository ──────────────────────────────────────────────────────────

export class BoardsRepository {
  // Boards
  async findAll(filters?: { spaceId?: string; departmentId?: string }): Promise<BoardRow[]> {
    let query = 'SELECT * FROM boards WHERE 1=1';
    const params: string[] = [];
    if (filters?.spaceId) { params.push(filters.spaceId); query += ` AND space_id = $${params.length}`; }
    if (filters?.departmentId) { params.push(filters.departmentId); query += ` AND department_id = $${params.length}`; }
    query += ' ORDER BY created_at ASC';
    const result: QueryResult = await pool.query(query, params);
    return result.rows as BoardRow[];
  }

  async findById(id: string): Promise<BoardRow | null> {
    const result: QueryResult = await pool.query('SELECT * FROM boards WHERE id = $1', [id]);
    return (result.rows[0] as BoardRow) ?? null;
  }

  async create(data: {
    name: string;
    description?: string;
    spaceId?: string;
    departmentId?: string;
    createdBy?: string;
  }): Promise<BoardRow> {
    const result: QueryResult = await pool.query(
      `INSERT INTO boards (space_id, department_id, name, description, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.spaceId ?? null, data.departmentId ?? null, data.name, data.description ?? null, data.createdBy ?? null]
    );
    return result.rows[0] as BoardRow;
  }

  async update(id: string, data: { name?: string; description?: string }): Promise<BoardRow | null> {
    const fields: string[] = [];
    const vals: unknown[] = [];
    if (data.name !== undefined) { vals.push(data.name); fields.push(`name=$${vals.length}`); }
    if (data.description !== undefined) { vals.push(data.description); fields.push(`description=$${vals.length}`); }
    if (!fields.length) return this.findById(id);
    vals.push(id);
    const result: QueryResult = await pool.query(
      `UPDATE boards SET ${fields.join(',')} WHERE id=$${vals.length} RETURNING *`,
      vals
    );
    return (result.rows[0] as BoardRow) ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result: QueryResult = await pool.query('DELETE FROM boards WHERE id=$1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Columns
  async findColumnsByBoardId(boardId: string): Promise<BoardColumnRow[]> {
    const result: QueryResult = await pool.query(
      'SELECT * FROM board_columns WHERE board_id = $1 ORDER BY position ASC',
      [boardId]
    );
    return result.rows as BoardColumnRow[];
  }

  async findColumnById(id: string): Promise<BoardColumnRow | null> {
    const result: QueryResult = await pool.query('SELECT * FROM board_columns WHERE id = $1', [id]);
    return (result.rows[0] as BoardColumnRow) ?? null;
  }

  async createColumn(data: {
    boardId: string;
    name: string;
    position?: number;
    wipLimit?: number | null;
  }): Promise<BoardColumnRow> {
    const result: QueryResult = await pool.query(
      `INSERT INTO board_columns (board_id, name, position, wip_limit)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.boardId, data.name, data.position ?? 0, data.wipLimit ?? null]
    );
    return result.rows[0] as BoardColumnRow;
  }

  async updateColumn(id: string, data: { name?: string; wipLimit?: number | null }): Promise<BoardColumnRow | null> {
    const fields: string[] = [];
    const vals: unknown[] = [];
    if (data.name !== undefined) { vals.push(data.name); fields.push(`name=$${vals.length}`); }
    if (data.wipLimit !== undefined) { vals.push(data.wipLimit); fields.push(`wip_limit=$${vals.length}`); }
    if (!fields.length) return this.findColumnById(id);
    vals.push(id);
    const result: QueryResult = await pool.query(
      `UPDATE board_columns SET ${fields.join(',')} WHERE id=$${vals.length} RETURNING *`,
      vals
    );
    return (result.rows[0] as BoardColumnRow) ?? null;
  }

  async reorderColumn(id: string, position: number): Promise<BoardColumnRow | null> {
    const result: QueryResult = await pool.query(
      'UPDATE board_columns SET position = $1 WHERE id = $2 RETURNING *',
      [position, id]
    );
    return (result.rows[0] as BoardColumnRow) ?? null;
  }

  async deleteColumn(id: string): Promise<boolean> {
    const result: QueryResult = await pool.query('DELETE FROM board_columns WHERE id=$1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Swimlanes
  async findSwimlanesByBoardId(boardId: string): Promise<SwimlaneRow[]> {
    const result: QueryResult = await pool.query(
      'SELECT * FROM swimlanes WHERE board_id = $1 ORDER BY position ASC',
      [boardId]
    );
    return result.rows as SwimlaneRow[];
  }

  async createSwimlane(data: { boardId: string; name: string; position?: number }): Promise<SwimlaneRow> {
    const result: QueryResult = await pool.query(
      'INSERT INTO swimlanes (board_id, name, position) VALUES ($1, $2, $3) RETURNING *',
      [data.boardId, data.name, data.position ?? 0]
    );
    return result.rows[0] as SwimlaneRow;
  }

  async updateSwimlane(id: string, data: { name?: string }): Promise<SwimlaneRow | null> {
    const result: QueryResult = await pool.query(
      'UPDATE swimlanes SET name = $1 WHERE id = $2 RETURNING *',
      [data.name, id]
    );
    return (result.rows[0] as SwimlaneRow) ?? null;
  }

  async deleteSwimlane(id: string): Promise<boolean> {
    const result: QueryResult = await pool.query('DELETE FROM swimlanes WHERE id=$1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Labels
  async findLabelsByBoardId(boardId: string): Promise<LabelRow[]> {
    const result: QueryResult = await pool.query(
      'SELECT * FROM labels WHERE board_id = $1 ORDER BY created_at ASC',
      [boardId]
    );
    return result.rows as LabelRow[];
  }

  async createLabel(data: { boardId: string; name: string; color?: string }): Promise<LabelRow> {
    const result: QueryResult = await pool.query(
      'INSERT INTO labels (board_id, name, color) VALUES ($1, $2, $3) RETURNING *',
      [data.boardId, data.name, data.color ?? '#6b7280']
    );
    return result.rows[0] as LabelRow;
  }

  async deleteLabel(id: string): Promise<boolean> {
    const result: QueryResult = await pool.query('DELETE FROM labels WHERE id=$1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Custom Field Definitions
  async findCustomFieldDefsByBoardId(boardId: string): Promise<CustomFieldDefRow[]> {
    const result: QueryResult = await pool.query(
      'SELECT * FROM custom_field_definitions WHERE board_id = $1 ORDER BY position ASC',
      [boardId]
    );
    return result.rows as CustomFieldDefRow[];
  }

  async createCustomFieldDef(data: {
    boardId: string;
    name: string;
    fieldType?: string;
    options?: unknown[];
    position?: number;
  }): Promise<CustomFieldDefRow> {
    const result: QueryResult = await pool.query(
      `INSERT INTO custom_field_definitions (board_id, name, field_type, options, position)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.boardId, data.name, data.fieldType ?? 'text', JSON.stringify(data.options ?? []), data.position ?? 0]
    );
    return result.rows[0] as CustomFieldDefRow;
  }

  async updateCustomFieldDef(id: string, data: {
    name?: string;
    fieldType?: string;
    options?: unknown[];
    position?: number;
  }): Promise<CustomFieldDefRow | null> {
    const fields: string[] = [];
    const vals: unknown[] = [];
    if (data.name !== undefined) { vals.push(data.name); fields.push(`name=$${vals.length}`); }
    if (data.fieldType !== undefined) { vals.push(data.fieldType); fields.push(`field_type=$${vals.length}`); }
    if (data.options !== undefined) { vals.push(JSON.stringify(data.options)); fields.push(`options=$${vals.length}`); }
    if (data.position !== undefined) { vals.push(data.position); fields.push(`position=$${vals.length}`); }
    if (!fields.length) return null;
    vals.push(id);
    const result: QueryResult = await pool.query(
      `UPDATE custom_field_definitions SET ${fields.join(',')} WHERE id=$${vals.length} RETURNING *`,
      vals
    );
    return (result.rows[0] as CustomFieldDefRow) ?? null;
  }

  async deleteCustomFieldDef(id: string): Promise<boolean> {
    const result: QueryResult = await pool.query('DELETE FROM custom_field_definitions WHERE id=$1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Card Templates
  async findTemplatesByBoardId(boardId: string): Promise<CardTemplateRow[]> {
    const result: QueryResult = await pool.query(
      'SELECT * FROM card_templates WHERE board_id = $1 ORDER BY created_at ASC',
      [boardId]
    );
    return result.rows as CardTemplateRow[];
  }

  async findTemplateById(id: string): Promise<CardTemplateRow | null> {
    const result: QueryResult = await pool.query('SELECT * FROM card_templates WHERE id = $1', [id]);
    return (result.rows[0] as CardTemplateRow) ?? null;
  }

  async createTemplate(data: {
    boardId: string;
    name: string;
    description?: string;
    type?: string;
    titleTemplate?: string;
    descriptionTemplate?: string;
    fields?: unknown;
  }): Promise<CardTemplateRow> {
    const result: QueryResult = await pool.query(
      `INSERT INTO card_templates (board_id, name, description, type, title_template, description_template, fields)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        data.boardId, data.name, data.description ?? null, data.type ?? 'task',
        data.titleTemplate ?? null, data.descriptionTemplate ?? null, JSON.stringify(data.fields ?? {})
      ]
    );
    return result.rows[0] as CardTemplateRow;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const result: QueryResult = await pool.query('DELETE FROM card_templates WHERE id=$1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Board Membership
  async findMembersByBoardId(boardId: string): Promise<unknown[]> {
    const result: QueryResult = await pool.query(
      `SELECT ob.id, ob.user_id, ob.object_type, ob.role, ob.inherited, ob.created_at,
              u.email, u.full_name, u.avatar_url
       FROM object_roles ob
       JOIN rbac_users u ON ob.user_id = u.id
       WHERE ob.object_type = 'board' AND ob.object_id = $1
       ORDER BY ob.created_at ASC`,
      [boardId]
    );
    return result.rows;
  }

  async addBoardMember(data: { boardId: string; userId: string; role?: string }): Promise<unknown> {
    const result: QueryResult = await pool.query(
      `INSERT INTO object_roles (user_id, object_type, object_id, role)
       VALUES ($1, 'board', $2, $3)
       ON CONFLICT (user_id, object_type, object_id)
       DO UPDATE SET role = $3
       RETURNING *`,
      [data.userId, data.boardId, data.role ?? 'editor']
    );
    return result.rows[0];
  }

  async updateBoardMemberRole(memberId: string, role: string): Promise<unknown | null> {
    const result: QueryResult = await pool.query(
      'UPDATE object_roles SET role = $1 WHERE id = $2 RETURNING *',
      [role, memberId]
    );
    return result.rows[0] ?? null;
  }

  async removeBoardMember(memberId: string): Promise<boolean> {
    const result: QueryResult = await pool.query(
      'DELETE FROM object_roles WHERE id = $1 AND object_type = $2',
      [memberId, 'board']
    );
    return (result.rowCount ?? 0) > 0;
  }
}

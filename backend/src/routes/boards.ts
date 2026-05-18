'use strict';

import { Router, Request, Response, NextFunction } from 'express';
import { BoardsRepository } from '../repositories/boards';
import { CardsRepository } from '../repositories/cards';
import { pool } from '../config';
import { authMiddleware, validate } from '../middleware';
import {
  createBoardSchema, updateBoardSchema,
  createColumnSchema, updateColumnSchema, reorderColumnSchema,
  createSwimlaneSchema, updateSwimlaneSchema,
  createCardSchema, updateCardSchema,
  createLabelSchema, setCardLabelsSchema,
  setCardAssigneesSchema,
  createCustomFieldSchema, updateCustomFieldSchema, setCardCustomFieldsSchema,
  createChecklistSchema, updateChecklistSchema,
  createChecklistItemSchema, updateChecklistItemSchema,
  createCardCommentSchema, updateCardCommentSchema,
  addReactionSchema,
  createCardRelationSchema,
  createCardTemplateSchema,
  addBoardMemberSchema, updateBoardMemberRoleSchema,
} from '../schemas/boards';

const router: Router = Router();
const boardsRepo = new BoardsRepository();
const cardsRepo = new CardsRepository();

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Params = Record<string, string>;

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return ((req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next)
  ) as any;
}

function uuid(name: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const val = (req.params as Params)[name];
    if (val && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
      _res.status(400).json({ error: `${name} must be a valid UUID` });
      return;
    }
    next();
  };
}

function strParam(val: unknown): string {
  return Array.isArray(val) ? (val[0] as string) : (val as string);
}

// ─── Boards ───────────────────────────────────────────────────────────────────

// GET /api/boards
router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string>;
  const boards = await boardsRepo.findAll({
    spaceId: q.spaceId || undefined,
    departmentId: q.departmentId || undefined,
  });
  res.json(boards);
}));

// POST /api/boards
router.post('/', authMiddleware, validate(createBoardSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { name: string; description?: string; spaceId?: string; departmentId?: string };
  const userId = strParam((req as unknown as { user: { id: string } }).user.id);
  const board = await boardsRepo.create({ ...body, createdBy: userId });
  res.status(201).json(board);
}));

// GET /api/boards/:boardId
router.get('/:boardId', authMiddleware, uuid('boardId'), asyncHandler(async (req: Request, res: Response) => {
  const id = (req.params as Params).boardId;
  const board = await boardsRepo.findById(id);
  if (!board) { res.status(404).json({ error: 'Board not found' }); return; }
  const [columns, swimlanes, cards] = await Promise.all([
    boardsRepo.findColumnsByBoardId(id),
    boardsRepo.findSwimlanesByBoardId(id),
    cardsRepo.findAll({ boardId: id }),
  ]);
  res.json({ ...board, columns, swimlanes, cards });
}));

// PATCH /api/boards/:boardId
router.patch('/:boardId', authMiddleware, uuid('boardId'), validate(updateBoardSchema), asyncHandler(async (req: Request, res: Response) => {
  const board = await boardsRepo.update((req.params as Params).boardId, req.body as { name?: string; description?: string });
  if (!board) { res.status(404).json({ error: 'Board not found' }); return; }
  res.json(board);
}));

// DELETE /api/boards/:boardId
router.delete('/:boardId', authMiddleware, uuid('boardId'), asyncHandler(async (req: Request, res: Response) => {
  const deleted = await boardsRepo.delete((req.params as Params).boardId);
  if (!deleted) { res.status(404).json({ error: 'Board not found' }); return; }
  res.json({ deleted: true });
}));

// ─── Columns ──────────────────────────────────────────────────────────────────

// POST /api/boards/:boardId/columns
router.post('/:boardId/columns', authMiddleware, uuid('boardId'), validate(createColumnSchema), asyncHandler(async (req: Request, res: Response) => {
  const boardId = (req.params as Params).boardId;
  const board = await boardsRepo.findById(boardId);
  if (!board) { res.status(404).json({ error: 'Board not found' }); return; }
  const body = req.body as { name: string; position?: number; wipLimit?: number | null };
  const column = await boardsRepo.createColumn({ boardId, name: body.name, position: body.position, wipLimit: body.wipLimit });
  res.status(201).json(column);
}));

// GET /api/columns/:columnId
router.get('/columns/:columnId', authMiddleware, uuid('columnId'), asyncHandler(async (req: Request, res: Response) => {
  const id = (req.params as Params).columnId;
  const col = await boardsRepo.findColumnById(id);
  if (!col) { res.status(404).json({ error: 'Column not found' }); return; }
  const cards = await cardsRepo.findAll({ columnId: id });
  res.json({ ...col, cards });
}));

// PATCH /api/columns/:columnId
router.patch('/columns/:columnId', authMiddleware, uuid('columnId'), validate(updateColumnSchema), asyncHandler(async (req: Request, res: Response) => {
  const col = await boardsRepo.updateColumn((req.params as Params).columnId, req.body as { name?: string; wipLimit?: number | null });
  if (!col) { res.status(404).json({ error: 'Column not found' }); return; }
  res.json(col);
}));

// PATCH /api/columns/:columnId/position
router.patch('/columns/:columnId/position', authMiddleware, uuid('columnId'), validate(reorderColumnSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { position: number };
  const col = await boardsRepo.reorderColumn((req.params as Params).columnId, body.position);
  if (!col) { res.status(404).json({ error: 'Column not found' }); return; }
  res.json(col);
}));

// DELETE /api/columns/:columnId
router.delete('/columns/:columnId', authMiddleware, uuid('columnId'), asyncHandler(async (req: Request, res: Response) => {
  const deleted = await boardsRepo.deleteColumn((req.params as Params).columnId);
  if (!deleted) { res.status(404).json({ error: 'Column not found' }); return; }
  res.json({ deleted: true });
}));

// ─── Swimlanes ────────────────────────────────────────────────────────────────

// POST /api/boards/:boardId/swimlanes
router.post('/:boardId/swimlanes', authMiddleware, uuid('boardId'), validate(createSwimlaneSchema), asyncHandler(async (req: Request, res: Response) => {
  const boardId = (req.params as Params).boardId;
  const board = await boardsRepo.findById(boardId);
  if (!board) { res.status(404).json({ error: 'Board not found' }); return; }
  const body = req.body as { name: string; position?: number };
  const lane = await boardsRepo.createSwimlane({ boardId, name: body.name, position: body.position });
  res.status(201).json(lane);
}));

// GET /api/swimlanes/:id
router.get('/swimlanes/:id', authMiddleware, uuid('id'), asyncHandler(async (req: Request, res: Response) => {
  const result = await pool.query('SELECT * FROM swimlanes WHERE id = $1', [(req.params as Params).id]);
  if (!result.rows[0]) { res.status(404).json({ error: 'Swimlane not found' }); return; }
  res.json(result.rows[0]);
}));

// PATCH /api/swimlanes/:id
router.patch('/swimlanes/:id', authMiddleware, uuid('id'), validate(updateSwimlaneSchema), asyncHandler(async (req: Request, res: Response) => {
  const lane = await boardsRepo.updateSwimlane((req.params as Params).id, req.body as { name?: string });
  if (!lane) { res.status(404).json({ error: 'Swimlane not found' }); return; }
  res.json(lane);
}));

// DELETE /api/swimlanes/:id
router.delete('/swimlanes/:id', authMiddleware, uuid('id'), asyncHandler(async (req: Request, res: Response) => {
  const deleted = await boardsRepo.deleteSwimlane((req.params as Params).id);
  if (!deleted) { res.status(404).json({ error: 'Swimlane not found' }); return; }
  res.json({ deleted: true });
}));

// ─── Cards ────────────────────────────────────────────────────────────────────

// GET /api/boards/:boardId/cards
router.get('/:boardId/cards', authMiddleware, uuid('boardId'), asyncHandler(async (req: Request, res: Response) => {
  const cards = await cardsRepo.findAll({ boardId: (req.params as Params).boardId });
  res.json(cards);
}));

// POST /api/cards
router.post('/cards', authMiddleware, validate(createCardSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = strParam((req as unknown as { user: { id: string } }).user.id);
  const body = req.body as {
    boardId: string; columnId: string; swimlaneId?: string; type?: string;
    title: string; description?: string; priority?: string; position?: number;
    startDate?: string; deadline?: string; estimate?: number; color?: string; coverImage?: string;
  };
  const card = await cardsRepo.create({
    boardId: body.boardId,
    columnId: body.columnId,
    title: body.title,
    type: body.type,
    description: body.description,
    priority: body.priority,
    position: body.position,
    authorId: userId,
    swimlaneId: body.swimlaneId,
  });
  res.status(201).json(card);
}));

// GET /api/cards/:cardId
router.get('/cards/:cardId', authMiddleware, uuid('cardId'), asyncHandler(async (req: Request, res: Response) => {
  const card = await cardsRepo.findByIdWithRelations((req.params as Params).cardId);
  if (!card) { res.status(404).json({ error: 'Card not found' }); return; }
  res.json(card);
}));

// PATCH /api/cards/:cardId
router.patch('/cards/:cardId', authMiddleware, uuid('cardId'), validate(updateCardSchema), asyncHandler(async (req: Request, res: Response) => {
  const card = await cardsRepo.update((req.params as Params).cardId, req.body as Parameters<typeof cardsRepo.update>[1]);
  if (!card) { res.status(404).json({ error: 'Card not found' }); return; }
  res.json(card);
}));

// DELETE /api/cards/:cardId
router.delete('/cards/:cardId', authMiddleware, uuid('cardId'), asyncHandler(async (req: Request, res: Response) => {
  const deleted = await cardsRepo.deleteCard((req.params as Params).cardId);
  if (!deleted) { res.status(404).json({ error: 'Card not found' }); return; }
  res.json({ deleted: true });
}));

// POST /api/cards/:cardId/archive
router.post('/cards/:cardId/archive', authMiddleware, uuid('cardId'), asyncHandler(async (req: Request, res: Response) => {
  const card = await cardsRepo.update((req.params as Params).cardId, { archivedAt: new Date().toISOString() });
  if (!card) { res.status(404).json({ error: 'Card not found' }); return; }
  res.json(card);
}));

// POST /api/cards/:cardId/restore
router.post('/cards/:cardId/restore', authMiddleware, uuid('cardId'), asyncHandler(async (req: Request, res: Response) => {
  const card = await cardsRepo.update((req.params as Params).cardId, { archivedAt: null });
  if (!card) { res.status(404).json({ error: 'Card not found' }); return; }
  res.json(card);
}));

// ─── Card Labels ───────────────────────────────────────────────────────────────

// POST /api/cards/:cardId/labels
router.post('/cards/:cardId/labels', authMiddleware, uuid('cardId'), validate(setCardLabelsSchema), asyncHandler(async (req: Request, res: Response) => {
  const cardId = (req.params as Params).cardId;
  const card = await cardsRepo.findById(cardId);
  if (!card) { res.status(404).json({ error: 'Card not found' }); return; }
  const body = req.body as { labelIds: string[] };
  await cardsRepo.setLabels(cardId, body.labelIds);
  res.json({ success: true });
}));

// DELETE /api/cards/:cardId/labels/:labelId
router.delete('/cards/:cardId/labels/:labelId', authMiddleware, uuid('cardId'), uuid('labelId'), asyncHandler(async (req: Request, res: Response) => {
  const p = req.params as Params;
  await cardsRepo.removeLabel(p.cardId, p.labelId);
  res.json({ deleted: true });
}));

// ─── Card Assignees ────────────────────────────────────────────────────────────

// PUT /api/cards/:cardId/assignees
router.put('/cards/:cardId/assignees', authMiddleware, uuid('cardId'), validate(setCardAssigneesSchema), asyncHandler(async (req: Request, res: Response) => {
  const cardId = (req.params as Params).cardId;
  const card = await cardsRepo.findById(cardId);
  if (!card) { res.status(404).json({ error: 'Card not found' }); return; }
  const body = req.body as { userIds: string[] };
  await cardsRepo.setAssignees(cardId, body.userIds);
  res.json({ success: true });
}));

// POST /api/cards/:cardId/assignees
router.post('/cards/:cardId/assignees', authMiddleware, uuid('cardId'), asyncHandler(async (req: Request, res: Response) => {
  const cardId = (req.params as Params).cardId;
  const { userId } = req.body as { userId: string };
  if (!userId) { res.status(400).json({ error: 'userId is required' }); return; }
  await cardsRepo.addAssignee(cardId, userId);
  res.json({ success: true });
}));

// DELETE /api/cards/:cardId/assignees/:userId
router.delete('/cards/:cardId/assignees/:userId', authMiddleware, uuid('cardId'), asyncHandler(async (req: Request, res: Response) => {
  const p = req.params as Params;
  await cardsRepo.removeAssignee(p.cardId, p.userId);
  res.json({ deleted: true });
}));

// ─── Custom Fields ────────────────────────────────────────────────────────────

// POST /api/boards/:boardId/custom-fields
router.post('/:boardId/custom-fields', authMiddleware, uuid('boardId'), validate(createCustomFieldSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { name: string; fieldType?: string; options?: unknown[]; position?: number };
  const field = await boardsRepo.createCustomFieldDef({ boardId: (req.params as Params).boardId, ...body });
  res.status(201).json(field);
}));

// GET /api/boards/:boardId/custom-fields
router.get('/:boardId/custom-fields', authMiddleware, uuid('boardId'), asyncHandler(async (req: Request, res: Response) => {
  const fields = await boardsRepo.findCustomFieldDefsByBoardId((req.params as Params).boardId);
  res.json(fields);
}));

// PATCH /api/custom-fields/:id
router.patch('/custom-fields/:id', authMiddleware, uuid('id'), validate(updateCustomFieldSchema), asyncHandler(async (req: Request, res: Response) => {
  const field = await boardsRepo.updateCustomFieldDef((req.params as Params).id, req.body as Parameters<typeof boardsRepo.updateCustomFieldDef>[1]);
  if (!field) { res.status(404).json({ error: 'Custom field not found' }); return; }
  res.json(field);
}));

// DELETE /api/custom-fields/:id
router.delete('/custom-fields/:id', authMiddleware, uuid('id'), asyncHandler(async (req: Request, res: Response) => {
  const deleted = await boardsRepo.deleteCustomFieldDef((req.params as Params).id);
  if (!deleted) { res.status(404).json({ error: 'Custom field not found' }); return; }
  res.json({ deleted: true });
}));

// PUT /api/cards/:cardId/custom-fields
router.put('/cards/:cardId/custom-fields', authMiddleware, uuid('cardId'), validate(setCardCustomFieldsSchema), asyncHandler(async (req: Request, res: Response) => {
  const cardId = (req.params as Params).cardId;
  const card = await cardsRepo.findById(cardId);
  if (!card) { res.status(404).json({ error: 'Card not found' }); return; }
  const body = req.body as { fields: Record<string, unknown> };
  await cardsRepo.setCardCustomFields(cardId, body.fields);
  res.json({ success: true });
}));

// GET /api/cards/:cardId/custom-fields
router.get('/cards/:cardId/custom-fields', authMiddleware, uuid('cardId'), asyncHandler(async (req: Request, res: Response) => {
  const result = await pool.query('SELECT * FROM card_custom_fields WHERE card_id = $1', [(req.params as Params).cardId]);
  res.json(result.rows);
}));

// ─── Checklists ───────────────────────────────────────────────────────────────

// POST /api/cards/:cardId/checklists
router.post('/cards/:cardId/checklists', authMiddleware, uuid('cardId'), validate(createChecklistSchema), asyncHandler(async (req: Request, res: Response) => {
  const cardId = (req.params as Params).cardId;
  const card = await cardsRepo.findById(cardId);
  if (!card) { res.status(404).json({ error: 'Card not found' }); return; }
  const body = req.body as { title?: string; position?: number };
  const result = await cardsRepo.createChecklist(cardId, body.title ?? 'Checklist', body.position);
  res.status(201).json(result);
}));

// GET /api/checklists/:checklistId
router.get('/checklists/:checklistId', authMiddleware, uuid('checklistId'), asyncHandler(async (req: Request, res: Response) => {
  const id = (req.params as Params).checklistId;
  const result = await pool.query('SELECT * FROM card_checklists WHERE id = $1', [id]);
  if (!result.rows[0]) { res.status(404).json({ error: 'Checklist not found' }); return; }
  const items = await pool.query('SELECT * FROM checklist_items WHERE checklist_id = $1 ORDER BY position ASC', [id]);
  res.json({ ...result.rows[0], items: items.rows });
}));

// PATCH /api/checklists/:checklistId
router.patch('/checklists/:checklistId', authMiddleware, uuid('checklistId'), validate(updateChecklistSchema), asyncHandler(async (req: Request, res: Response) => {
  const id = (req.params as Params).checklistId;
  const body = req.body as { title?: string; position?: number };
  const fields: string[] = []; const vals: unknown[] = [];
  if (body.title !== undefined) { vals.push(body.title); fields.push(`title=$${vals.length}`); }
  if (body.position !== undefined) { vals.push(body.position); fields.push(`position=$${vals.length}`); }
  if (!fields.length) { res.status(400).json({ error: 'No fields to update' }); return; }
  vals.push(id);
  const result = await pool.query(`UPDATE card_checklists SET ${fields.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
  if (!result.rows[0]) { res.status(404).json({ error: 'Checklist not found' }); return; }
  res.json(result.rows[0]);
}));

// DELETE /api/checklists/:checklistId
router.delete('/checklists/:checklistId', authMiddleware, uuid('checklistId'), asyncHandler(async (req: Request, res: Response) => {
  await pool.query('DELETE FROM card_checklists WHERE id = $1', [(req.params as Params).checklistId]);
  res.json({ deleted: true });
}));

// POST /api/checklists/:checklistId/items
router.post('/checklists/:checklistId/items', authMiddleware, uuid('checklistId'), validate(createChecklistItemSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { text: string; position?: number };
  const result = await cardsRepo.addChecklistItem((req.params as Params).checklistId, body.text, body.position);
  res.status(201).json(result);
}));

// PATCH /api/checklist-items/:itemId
router.patch('/checklist-items/:itemId', authMiddleware, uuid('itemId'), validate(updateChecklistItemSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { text?: string; checked?: boolean; position?: number };
  const result = await cardsRepo.updateChecklistItem((req.params as Params).itemId, body);
  if (!result) { res.status(404).json({ error: 'Checklist item not found' }); return; }
  res.json(result);
}));

// DELETE /api/checklist-items/:itemId
router.delete('/checklist-items/:itemId', authMiddleware, uuid('itemId'), asyncHandler(async (req: Request, res: Response) => {
  await cardsRepo.deleteChecklistItem((req.params as Params).itemId);
  res.json({ deleted: true });
}));

// ─── Comments ──────────────────────────────────────────────────────────────────

// POST /api/cards/:cardId/comments
router.post('/cards/:cardId/comments', authMiddleware, uuid('cardId'), validate(createCardCommentSchema), asyncHandler(async (req: Request, res: Response) => {
  const cardId = (req.params as Params).cardId;
  const card = await cardsRepo.findById(cardId);
  if (!card) { res.status(404).json({ error: 'Card not found' }); return; }
  const userId = strParam((req as unknown as { user: { id: string } }).user.id);
  const body = req.body as { content: string; mentions?: { userId: string; offset: number; length: number }[] };
  const result = await cardsRepo.addCommentRow(cardId, userId, body.content, body.mentions?.map(m => m.userId));
  res.status(201).json(result);
}));

// GET /api/cards/:cardId/comments
router.get('/cards/:cardId/comments', authMiddleware, uuid('cardId'), asyncHandler(async (req: Request, res: Response) => {
  const result = await pool.query(
    `SELECT cc.*, u.username, u.email
     FROM card_comments cc
     LEFT JOIN rbac_users u ON cc.author_id = u.id
     WHERE cc.card_id = $1
     ORDER BY cc.created_at ASC`,
    [(req.params as Params).cardId]
  );
  res.json(result.rows);
}));

// PATCH /api/comments/:commentId
router.patch('/comments/:commentId', authMiddleware, uuid('commentId'), validate(updateCardCommentSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { content: string };
  const result = await pool.query(
    'UPDATE card_comments SET content = $1 WHERE id = $2 RETURNING *',
    [body.content, (req.params as Params).commentId]
  );
  if (!result.rows[0]) { res.status(404).json({ error: 'Comment not found' }); return; }
  res.json(result.rows[0]);
}));

// DELETE /api/comments/:commentId
router.delete('/comments/:commentId', authMiddleware, uuid('commentId'), asyncHandler(async (req: Request, res: Response) => {
  const result = await pool.query('DELETE FROM card_comments WHERE id = $1 RETURNING id', [(req.params as Params).commentId]);
  if (!result.rows[0]) { res.status(404).json({ error: 'Comment not found' }); return; }
  res.json({ deleted: true });
}));

// ─── Reactions ────────────────────────────────────────────────────────────────

// POST /api/comments/:commentId/reactions
router.post('/comments/:commentId/reactions', authMiddleware, uuid('commentId'), validate(addReactionSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = strParam((req as unknown as { user: { id: string } }).user.id);
  const body = req.body as { emoji?: string };
  await pool.query(
    'INSERT INTO card_reactions (comment_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [(req.params as Params).commentId, userId, body.emoji ?? '👍']
  );
  res.json({ success: true });
}));

// DELETE /api/comments/:commentId/reactions
router.delete('/comments/:commentId/reactions', authMiddleware, uuid('commentId'), asyncHandler(async (req: Request, res: Response) => {
  const userId = strParam((req as unknown as { user: { id: string } }).user.id);
  const { emoji } = req.body as { emoji?: string };
  if (emoji) {
    await pool.query('DELETE FROM card_reactions WHERE comment_id = $1 AND user_id = $2 AND emoji = $3',
      [(req.params as Params).commentId, userId, emoji]);
  } else {
    await pool.query('DELETE FROM card_reactions WHERE comment_id = $1 AND user_id = $2',
      [(req.params as Params).commentId, userId]);
  }
  res.json({ deleted: true });
}));

// GET /api/comments/:commentId/reactions
router.get('/comments/:commentId/reactions', authMiddleware, uuid('commentId'), asyncHandler(async (req: Request, res: Response) => {
  const result = await pool.query(
    `SELECT cr.*, u.username FROM card_reactions cr
     LEFT JOIN rbac_users u ON cr.user_id = u.id
     WHERE cr.comment_id = $1`,
    [(req.params as Params).commentId]
  );
  res.json(result.rows);
}));

// ─── Card Relations ───────────────────────────────────────────────────────────

// GET /api/cards/:cardId/relations
router.get('/cards/:cardId/relations', authMiddleware, uuid('cardId'), asyncHandler(async (req: Request, res: Response) => {
  const result = await pool.query(
    `SELECT cr.*, c.title as target_title, c.type as target_type
     FROM card_relations cr
     JOIN cards c ON cr.target_card_id = c.id
     WHERE cr.card_id = $1`,
    [(req.params as Params).cardId]
  );
  res.json(result.rows);
}));

// POST /api/cards/:cardId/relations
router.post('/cards/:cardId/relations', authMiddleware, uuid('cardId'), validate(createCardRelationSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { targetCardId: string; relationType: string };
  const result = await pool.query(
    `INSERT INTO card_relations (card_id, target_card_id, relation_type)
     VALUES ($1, $2, $3) RETURNING *`,
    [(req.params as Params).cardId, body.targetCardId, body.relationType]
  );
  res.status(201).json(result.rows[0]);
}));

// DELETE /api/cards/:cardId/relations/:relationId
router.delete('/cards/:cardId/relations/:relationId', authMiddleware, uuid('cardId'), asyncHandler(async (req: Request, res: Response) => {
  const p = req.params as Params;
  await pool.query('DELETE FROM card_relations WHERE id = $1 AND card_id = $2', [p.relationId, p.cardId]);
  res.json({ deleted: true });
}));

// ─── Activity Log ─────────────────────────────────────────────────────────────

// GET /api/cards/:cardId/activity
router.get('/cards/:cardId/activity', authMiddleware, uuid('cardId'), asyncHandler(async (req: Request, res: Response) => {
  const result = await pool.query(
    `SELECT cal.*, u.username FROM card_activity_log cal
     LEFT JOIN rbac_users u ON cal.actor_id = u.id
     WHERE cal.card_id = $1
     ORDER BY cal.created_at ASC`,
    [(req.params as Params).cardId]
  );
  res.json(result.rows);
}));

// ─── Templates ────────────────────────────────────────────────────────────────

// GET /api/boards/:boardId/templates
router.get('/:boardId/templates', authMiddleware, uuid('boardId'), asyncHandler(async (req: Request, res: Response) => {
  const templates = await boardsRepo.findTemplatesByBoardId((req.params as Params).boardId);
  res.json(templates);
}));

// POST /api/boards/:boardId/templates
router.post('/:boardId/templates', authMiddleware, uuid('boardId'), validate(createCardTemplateSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { name: string; description?: string; type?: string; titleTemplate?: string; descriptionTemplate?: string; fields?: unknown };
  const template = await boardsRepo.createTemplate({ boardId: (req.params as Params).boardId, name: body.name, description: body.description, type: body.type, titleTemplate: body.titleTemplate, descriptionTemplate: body.descriptionTemplate, fields: body.fields });
  res.status(201).json(template);
}));

// DELETE /api/templates/:templateId
router.delete('/templates/:templateId', authMiddleware, uuid('templateId'), asyncHandler(async (req: Request, res: Response) => {
  const deleted = await boardsRepo.deleteTemplate((req.params as Params).templateId);
  if (!deleted) { res.status(404).json({ error: 'Template not found' }); return; }
  res.json({ deleted: true });
}));

// ─── Labels ───────────────────────────────────────────────────────────────────

// POST /api/boards/:boardId/labels
router.post('/:boardId/labels', authMiddleware, uuid('boardId'), validate(createLabelSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { name: string; color?: string };
  const label = await boardsRepo.createLabel({ boardId: (req.params as Params).boardId, name: body.name, color: body.color });
  res.status(201).json(label);
}));

// GET /api/boards/:boardId/labels
router.get('/:boardId/labels', authMiddleware, uuid('boardId'), asyncHandler(async (req: Request, res: Response) => {
  const labels = await boardsRepo.findLabelsByBoardId((req.params as Params).boardId);
  res.json(labels);
}));

// DELETE /api/labels/:labelId
router.delete('/labels/:labelId', authMiddleware, uuid('labelId'), asyncHandler(async (req: Request, res: Response) => {
  const deleted = await boardsRepo.deleteLabel((req.params as Params).labelId);
  if (!deleted) { res.status(404).json({ error: 'Label not found' }); return; }
  res.json({ deleted: true });
}));

// ─── Attachments ──────────────────────────────────────────────────────────────

// GET /api/cards/:cardId/attachments
router.get('/cards/:cardId/attachments', authMiddleware, uuid('cardId'), asyncHandler(async (req: Request, res: Response) => {
  const result = await pool.query('SELECT * FROM card_attachments WHERE card_id = $1 ORDER BY created_at ASC', [(req.params as Params).cardId]);
  res.json(result.rows);
}));

// POST /api/cards/:cardId/attachments
router.post('/cards/:cardId/attachments', authMiddleware, uuid('cardId'), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { filename: string; url: string; mimeType?: string; sizeBytes?: number };
  if (!body.filename || !body.url) { res.status(400).json({ error: 'filename and url are required' }); return; }
  const userId = strParam((req as unknown as { user: { id: string } }).user.id);
  const result = await pool.query(
    `INSERT INTO card_attachments (card_id, filename, url, mime_type, size_bytes, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [(req.params as Params).cardId, body.filename, body.url, body.mimeType ?? null, body.sizeBytes ?? null, userId]
  );
  res.status(201).json(result.rows[0]);
}));

// DELETE /api/attachments/:attachmentId
router.delete('/attachments/:attachmentId', authMiddleware, uuid('attachmentId'), asyncHandler(async (req: Request, res: Response) => {
  await pool.query('DELETE FROM card_attachments WHERE id = $1', [(req.params as Params).attachmentId]);
  res.json({ deleted: true });
}));

// ─── Board Membership ───────────────────────────────────────────────────────────

// GET /api/boards/:boardId/members
router.get('/:boardId/members', authMiddleware, uuid('boardId'), asyncHandler(async (req: Request, res: Response) => {
  const boardId = (req.params as Params).boardId;
  const board = await boardsRepo.findById(boardId);
  if (!board) { res.status(404).json({ error: 'Board not found' }); return; }
  const members = await boardsRepo.findMembersByBoardId(boardId);
  res.json(members);
}));

// POST /api/boards/:boardId/members
router.post('/:boardId/members', authMiddleware, uuid('boardId'), validate(addBoardMemberSchema), asyncHandler(async (req: Request, res: Response) => {
  const boardId = (req.params as Params).boardId;
  const board = await boardsRepo.findById(boardId);
  if (!board) { res.status(404).json({ error: 'Board not found' }); return; }
  const body = req.body as { userId: string; role?: string };
  const member = await boardsRepo.addBoardMember({ boardId, userId: body.userId, role: body.role });
  res.status(201).json(member);
}));

// PATCH /api/boards/:boardId/members/:memberId
router.patch('/:boardId/members/:memberId', authMiddleware, uuid('boardId'), uuid('memberId'), validate(updateBoardMemberRoleSchema), asyncHandler(async (req: Request, res: Response) => {
  const p = req.params as Params;
  const body = req.body as { role: string };
  const member = await boardsRepo.updateBoardMemberRole(p.memberId, body.role);
  if (!member) { res.status(404).json({ error: 'Board member not found' }); return; }
  res.json(member);
}));

// DELETE /api/boards/:boardId/members/:memberId
router.delete('/:boardId/members/:memberId', authMiddleware, uuid('boardId'), uuid('memberId'), asyncHandler(async (req: Request, res: Response) => {
  const p = req.params as Params;
  const removed = await boardsRepo.removeBoardMember(p.memberId);
  if (!removed) { res.status(404).json({ error: 'Board member not found' }); return; }
  res.json({ deleted: true });
}));

export default router;

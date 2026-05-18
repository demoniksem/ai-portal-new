'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const boards_1 = require("../repositories/boards");
const cards_1 = require("../repositories/cards");
const config_1 = require("../config");
const middleware_1 = require("../middleware");
const boards_2 = require("../schemas/boards");
const router = (0, express_1.Router)();
const boardsRepo = new boards_1.BoardsRepository();
const cardsRepo = new cards_1.CardsRepository();
function asyncHandler(fn) {
    return ((req, res, next) => fn(req, res, next).catch(next));
}
function uuid(name) {
    return (req, _res, next) => {
        const val = req.params[name];
        if (val && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
            _res.status(400).json({ error: `${name} must be a valid UUID` });
            return;
        }
        next();
    };
}
function strParam(val) {
    return Array.isArray(val) ? val[0] : val;
}
// ─── Boards ───────────────────────────────────────────────────────────────────
// GET /api/boards
router.get('/', middleware_1.authMiddleware, asyncHandler(async (req, res) => {
    const q = req.query;
    const boards = await boardsRepo.findAll({
        spaceId: q.spaceId || undefined,
        departmentId: q.departmentId || undefined,
    });
    res.json(boards);
}));
// POST /api/boards
router.post('/', middleware_1.authMiddleware, (0, middleware_1.validate)(boards_2.createBoardSchema), asyncHandler(async (req, res) => {
    const body = req.body;
    const userId = strParam(req.user.id);
    const board = await boardsRepo.create({ ...body, createdBy: userId });
    res.status(201).json(board);
}));
// GET /api/boards/:boardId
router.get('/:boardId', middleware_1.authMiddleware, uuid('boardId'), asyncHandler(async (req, res) => {
    const id = req.params.boardId;
    const board = await boardsRepo.findById(id);
    if (!board) {
        res.status(404).json({ error: 'Board not found' });
        return;
    }
    const [columns, swimlanes, cards] = await Promise.all([
        boardsRepo.findColumnsByBoardId(id),
        boardsRepo.findSwimlanesByBoardId(id),
        cardsRepo.findAll({ boardId: id }),
    ]);
    res.json({ ...board, columns, swimlanes, cards });
}));
// PATCH /api/boards/:boardId
router.patch('/:boardId', middleware_1.authMiddleware, uuid('boardId'), (0, middleware_1.validate)(boards_2.updateBoardSchema), asyncHandler(async (req, res) => {
    const board = await boardsRepo.update(req.params.boardId, req.body);
    if (!board) {
        res.status(404).json({ error: 'Board not found' });
        return;
    }
    res.json(board);
}));
// DELETE /api/boards/:boardId
router.delete('/:boardId', middleware_1.authMiddleware, uuid('boardId'), asyncHandler(async (req, res) => {
    const deleted = await boardsRepo.delete(req.params.boardId);
    if (!deleted) {
        res.status(404).json({ error: 'Board not found' });
        return;
    }
    res.json({ deleted: true });
}));
// ─── Columns ──────────────────────────────────────────────────────────────────
// POST /api/boards/:boardId/columns
router.post('/:boardId/columns', middleware_1.authMiddleware, uuid('boardId'), (0, middleware_1.validate)(boards_2.createColumnSchema), asyncHandler(async (req, res) => {
    const boardId = req.params.boardId;
    const board = await boardsRepo.findById(boardId);
    if (!board) {
        res.status(404).json({ error: 'Board not found' });
        return;
    }
    const body = req.body;
    const column = await boardsRepo.createColumn({ boardId, name: body.name, position: body.position, wipLimit: body.wipLimit });
    res.status(201).json(column);
}));
// GET /api/columns/:columnId
router.get('/columns/:columnId', middleware_1.authMiddleware, uuid('columnId'), asyncHandler(async (req, res) => {
    const id = req.params.columnId;
    const col = await boardsRepo.findColumnById(id);
    if (!col) {
        res.status(404).json({ error: 'Column not found' });
        return;
    }
    const cards = await cardsRepo.findAll({ columnId: id });
    res.json({ ...col, cards });
}));
// PATCH /api/columns/:columnId
router.patch('/columns/:columnId', middleware_1.authMiddleware, uuid('columnId'), (0, middleware_1.validate)(boards_2.updateColumnSchema), asyncHandler(async (req, res) => {
    const col = await boardsRepo.updateColumn(req.params.columnId, req.body);
    if (!col) {
        res.status(404).json({ error: 'Column not found' });
        return;
    }
    res.json(col);
}));
// PATCH /api/columns/:columnId/position
router.patch('/columns/:columnId/position', middleware_1.authMiddleware, uuid('columnId'), (0, middleware_1.validate)(boards_2.reorderColumnSchema), asyncHandler(async (req, res) => {
    const body = req.body;
    const col = await boardsRepo.reorderColumn(req.params.columnId, body.position);
    if (!col) {
        res.status(404).json({ error: 'Column not found' });
        return;
    }
    res.json(col);
}));
// DELETE /api/columns/:columnId
router.delete('/columns/:columnId', middleware_1.authMiddleware, uuid('columnId'), asyncHandler(async (req, res) => {
    const deleted = await boardsRepo.deleteColumn(req.params.columnId);
    if (!deleted) {
        res.status(404).json({ error: 'Column not found' });
        return;
    }
    res.json({ deleted: true });
}));
// ─── Swimlanes ────────────────────────────────────────────────────────────────
// POST /api/boards/:boardId/swimlanes
router.post('/:boardId/swimlanes', middleware_1.authMiddleware, uuid('boardId'), (0, middleware_1.validate)(boards_2.createSwimlaneSchema), asyncHandler(async (req, res) => {
    const boardId = req.params.boardId;
    const board = await boardsRepo.findById(boardId);
    if (!board) {
        res.status(404).json({ error: 'Board not found' });
        return;
    }
    const body = req.body;
    const lane = await boardsRepo.createSwimlane({ boardId, name: body.name, position: body.position });
    res.status(201).json(lane);
}));
// GET /api/swimlanes/:id
router.get('/swimlanes/:id', middleware_1.authMiddleware, uuid('id'), asyncHandler(async (req, res) => {
    const result = await config_1.pool.query('SELECT * FROM swimlanes WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) {
        res.status(404).json({ error: 'Swimlane not found' });
        return;
    }
    res.json(result.rows[0]);
}));
// PATCH /api/swimlanes/:id
router.patch('/swimlanes/:id', middleware_1.authMiddleware, uuid('id'), (0, middleware_1.validate)(boards_2.updateSwimlaneSchema), asyncHandler(async (req, res) => {
    const lane = await boardsRepo.updateSwimlane(req.params.id, req.body);
    if (!lane) {
        res.status(404).json({ error: 'Swimlane not found' });
        return;
    }
    res.json(lane);
}));
// DELETE /api/swimlanes/:id
router.delete('/swimlanes/:id', middleware_1.authMiddleware, uuid('id'), asyncHandler(async (req, res) => {
    const deleted = await boardsRepo.deleteSwimlane(req.params.id);
    if (!deleted) {
        res.status(404).json({ error: 'Swimlane not found' });
        return;
    }
    res.json({ deleted: true });
}));
// ─── Cards ────────────────────────────────────────────────────────────────────
// GET /api/boards/:boardId/cards
router.get('/:boardId/cards', middleware_1.authMiddleware, uuid('boardId'), asyncHandler(async (req, res) => {
    const cards = await cardsRepo.findAll({ boardId: req.params.boardId });
    res.json(cards);
}));
// POST /api/cards
router.post('/cards', middleware_1.authMiddleware, (0, middleware_1.validate)(boards_2.createCardSchema), asyncHandler(async (req, res) => {
    const userId = strParam(req.user.id);
    const body = req.body;
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
router.get('/cards/:cardId', middleware_1.authMiddleware, uuid('cardId'), asyncHandler(async (req, res) => {
    const card = await cardsRepo.findByIdWithRelations(req.params.cardId);
    if (!card) {
        res.status(404).json({ error: 'Card not found' });
        return;
    }
    res.json(card);
}));
// PATCH /api/cards/:cardId
router.patch('/cards/:cardId', middleware_1.authMiddleware, uuid('cardId'), (0, middleware_1.validate)(boards_2.updateCardSchema), asyncHandler(async (req, res) => {
    const card = await cardsRepo.update(req.params.cardId, req.body);
    if (!card) {
        res.status(404).json({ error: 'Card not found' });
        return;
    }
    res.json(card);
}));
// DELETE /api/cards/:cardId
router.delete('/cards/:cardId', middleware_1.authMiddleware, uuid('cardId'), asyncHandler(async (req, res) => {
    const deleted = await cardsRepo.deleteCard(req.params.cardId);
    if (!deleted) {
        res.status(404).json({ error: 'Card not found' });
        return;
    }
    res.json({ deleted: true });
}));
// POST /api/cards/:cardId/archive
router.post('/cards/:cardId/archive', middleware_1.authMiddleware, uuid('cardId'), asyncHandler(async (req, res) => {
    const card = await cardsRepo.update(req.params.cardId, { archivedAt: new Date().toISOString() });
    if (!card) {
        res.status(404).json({ error: 'Card not found' });
        return;
    }
    res.json(card);
}));
// POST /api/cards/:cardId/restore
router.post('/cards/:cardId/restore', middleware_1.authMiddleware, uuid('cardId'), asyncHandler(async (req, res) => {
    const card = await cardsRepo.update(req.params.cardId, { archivedAt: null });
    if (!card) {
        res.status(404).json({ error: 'Card not found' });
        return;
    }
    res.json(card);
}));
// ─── Card Labels ───────────────────────────────────────────────────────────────
// POST /api/cards/:cardId/labels
router.post('/cards/:cardId/labels', middleware_1.authMiddleware, uuid('cardId'), (0, middleware_1.validate)(boards_2.setCardLabelsSchema), asyncHandler(async (req, res) => {
    const cardId = req.params.cardId;
    const card = await cardsRepo.findById(cardId);
    if (!card) {
        res.status(404).json({ error: 'Card not found' });
        return;
    }
    const body = req.body;
    await cardsRepo.setLabels(cardId, body.labelIds);
    res.json({ success: true });
}));
// DELETE /api/cards/:cardId/labels/:labelId
router.delete('/cards/:cardId/labels/:labelId', middleware_1.authMiddleware, uuid('cardId'), uuid('labelId'), asyncHandler(async (req, res) => {
    const p = req.params;
    await cardsRepo.removeLabel(p.cardId, p.labelId);
    res.json({ deleted: true });
}));
// ─── Card Assignees ────────────────────────────────────────────────────────────
// PUT /api/cards/:cardId/assignees
router.put('/cards/:cardId/assignees', middleware_1.authMiddleware, uuid('cardId'), (0, middleware_1.validate)(boards_2.setCardAssigneesSchema), asyncHandler(async (req, res) => {
    const cardId = req.params.cardId;
    const card = await cardsRepo.findById(cardId);
    if (!card) {
        res.status(404).json({ error: 'Card not found' });
        return;
    }
    const body = req.body;
    await cardsRepo.setAssignees(cardId, body.userIds);
    res.json({ success: true });
}));
// POST /api/cards/:cardId/assignees
router.post('/cards/:cardId/assignees', middleware_1.authMiddleware, uuid('cardId'), asyncHandler(async (req, res) => {
    const cardId = req.params.cardId;
    const { userId } = req.body;
    if (!userId) {
        res.status(400).json({ error: 'userId is required' });
        return;
    }
    await cardsRepo.addAssignee(cardId, userId);
    res.json({ success: true });
}));
// DELETE /api/cards/:cardId/assignees/:userId
router.delete('/cards/:cardId/assignees/:userId', middleware_1.authMiddleware, uuid('cardId'), asyncHandler(async (req, res) => {
    const p = req.params;
    await cardsRepo.removeAssignee(p.cardId, p.userId);
    res.json({ deleted: true });
}));
// ─── Custom Fields ────────────────────────────────────────────────────────────
// POST /api/boards/:boardId/custom-fields
router.post('/:boardId/custom-fields', middleware_1.authMiddleware, uuid('boardId'), (0, middleware_1.validate)(boards_2.createCustomFieldSchema), asyncHandler(async (req, res) => {
    const body = req.body;
    const field = await boardsRepo.createCustomFieldDef({ boardId: req.params.boardId, ...body });
    res.status(201).json(field);
}));
// GET /api/boards/:boardId/custom-fields
router.get('/:boardId/custom-fields', middleware_1.authMiddleware, uuid('boardId'), asyncHandler(async (req, res) => {
    const fields = await boardsRepo.findCustomFieldDefsByBoardId(req.params.boardId);
    res.json(fields);
}));
// PATCH /api/custom-fields/:id
router.patch('/custom-fields/:id', middleware_1.authMiddleware, uuid('id'), (0, middleware_1.validate)(boards_2.updateCustomFieldSchema), asyncHandler(async (req, res) => {
    const field = await boardsRepo.updateCustomFieldDef(req.params.id, req.body);
    if (!field) {
        res.status(404).json({ error: 'Custom field not found' });
        return;
    }
    res.json(field);
}));
// DELETE /api/custom-fields/:id
router.delete('/custom-fields/:id', middleware_1.authMiddleware, uuid('id'), asyncHandler(async (req, res) => {
    const deleted = await boardsRepo.deleteCustomFieldDef(req.params.id);
    if (!deleted) {
        res.status(404).json({ error: 'Custom field not found' });
        return;
    }
    res.json({ deleted: true });
}));
// PUT /api/cards/:cardId/custom-fields
router.put('/cards/:cardId/custom-fields', middleware_1.authMiddleware, uuid('cardId'), (0, middleware_1.validate)(boards_2.setCardCustomFieldsSchema), asyncHandler(async (req, res) => {
    const cardId = req.params.cardId;
    const card = await cardsRepo.findById(cardId);
    if (!card) {
        res.status(404).json({ error: 'Card not found' });
        return;
    }
    const body = req.body;
    await cardsRepo.setCardCustomFields(cardId, body.fields);
    res.json({ success: true });
}));
// GET /api/cards/:cardId/custom-fields
router.get('/cards/:cardId/custom-fields', middleware_1.authMiddleware, uuid('cardId'), asyncHandler(async (req, res) => {
    const result = await config_1.pool.query('SELECT * FROM card_custom_fields WHERE card_id = $1', [req.params.cardId]);
    res.json(result.rows);
}));
// ─── Checklists ───────────────────────────────────────────────────────────────
// POST /api/cards/:cardId/checklists
router.post('/cards/:cardId/checklists', middleware_1.authMiddleware, uuid('cardId'), (0, middleware_1.validate)(boards_2.createChecklistSchema), asyncHandler(async (req, res) => {
    const cardId = req.params.cardId;
    const card = await cardsRepo.findById(cardId);
    if (!card) {
        res.status(404).json({ error: 'Card not found' });
        return;
    }
    const body = req.body;
    const result = await cardsRepo.createChecklist(cardId, body.title ?? 'Checklist', body.position);
    res.status(201).json(result);
}));
// GET /api/checklists/:checklistId
router.get('/checklists/:checklistId', middleware_1.authMiddleware, uuid('checklistId'), asyncHandler(async (req, res) => {
    const id = req.params.checklistId;
    const result = await config_1.pool.query('SELECT * FROM card_checklists WHERE id = $1', [id]);
    if (!result.rows[0]) {
        res.status(404).json({ error: 'Checklist not found' });
        return;
    }
    const items = await config_1.pool.query('SELECT * FROM checklist_items WHERE checklist_id = $1 ORDER BY position ASC', [id]);
    res.json({ ...result.rows[0], items: items.rows });
}));
// PATCH /api/checklists/:checklistId
router.patch('/checklists/:checklistId', middleware_1.authMiddleware, uuid('checklistId'), (0, middleware_1.validate)(boards_2.updateChecklistSchema), asyncHandler(async (req, res) => {
    const id = req.params.checklistId;
    const body = req.body;
    const fields = [];
    const vals = [];
    if (body.title !== undefined) {
        vals.push(body.title);
        fields.push(`title=$${vals.length}`);
    }
    if (body.position !== undefined) {
        vals.push(body.position);
        fields.push(`position=$${vals.length}`);
    }
    if (!fields.length) {
        res.status(400).json({ error: 'No fields to update' });
        return;
    }
    vals.push(id);
    const result = await config_1.pool.query(`UPDATE card_checklists SET ${fields.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
    if (!result.rows[0]) {
        res.status(404).json({ error: 'Checklist not found' });
        return;
    }
    res.json(result.rows[0]);
}));
// DELETE /api/checklists/:checklistId
router.delete('/checklists/:checklistId', middleware_1.authMiddleware, uuid('checklistId'), asyncHandler(async (req, res) => {
    await config_1.pool.query('DELETE FROM card_checklists WHERE id = $1', [req.params.checklistId]);
    res.json({ deleted: true });
}));
// POST /api/checklists/:checklistId/items
router.post('/checklists/:checklistId/items', middleware_1.authMiddleware, uuid('checklistId'), (0, middleware_1.validate)(boards_2.createChecklistItemSchema), asyncHandler(async (req, res) => {
    const body = req.body;
    const result = await cardsRepo.addChecklistItem(req.params.checklistId, body.text, body.position);
    res.status(201).json(result);
}));
// PATCH /api/checklist-items/:itemId
router.patch('/checklist-items/:itemId', middleware_1.authMiddleware, uuid('itemId'), (0, middleware_1.validate)(boards_2.updateChecklistItemSchema), asyncHandler(async (req, res) => {
    const body = req.body;
    const result = await cardsRepo.updateChecklistItem(req.params.itemId, body);
    if (!result) {
        res.status(404).json({ error: 'Checklist item not found' });
        return;
    }
    res.json(result);
}));
// DELETE /api/checklist-items/:itemId
router.delete('/checklist-items/:itemId', middleware_1.authMiddleware, uuid('itemId'), asyncHandler(async (req, res) => {
    await cardsRepo.deleteChecklistItem(req.params.itemId);
    res.json({ deleted: true });
}));
// ─── Comments ──────────────────────────────────────────────────────────────────
// POST /api/cards/:cardId/comments
router.post('/cards/:cardId/comments', middleware_1.authMiddleware, uuid('cardId'), (0, middleware_1.validate)(boards_2.createCardCommentSchema), asyncHandler(async (req, res) => {
    const cardId = req.params.cardId;
    const card = await cardsRepo.findById(cardId);
    if (!card) {
        res.status(404).json({ error: 'Card not found' });
        return;
    }
    const userId = strParam(req.user.id);
    const body = req.body;
    const result = await cardsRepo.addCommentRow(cardId, userId, body.content, body.mentions?.map(m => m.userId));
    res.status(201).json(result);
}));
// GET /api/cards/:cardId/comments
router.get('/cards/:cardId/comments', middleware_1.authMiddleware, uuid('cardId'), asyncHandler(async (req, res) => {
    const result = await config_1.pool.query(`SELECT cc.*, u.username, u.email
     FROM card_comments cc
     LEFT JOIN rbac_users u ON cc.author_id = u.id
     WHERE cc.card_id = $1
     ORDER BY cc.created_at ASC`, [req.params.cardId]);
    res.json(result.rows);
}));
// PATCH /api/comments/:commentId
router.patch('/comments/:commentId', middleware_1.authMiddleware, uuid('commentId'), (0, middleware_1.validate)(boards_2.updateCardCommentSchema), asyncHandler(async (req, res) => {
    const body = req.body;
    const result = await config_1.pool.query('UPDATE card_comments SET content = $1 WHERE id = $2 RETURNING *', [body.content, req.params.commentId]);
    if (!result.rows[0]) {
        res.status(404).json({ error: 'Comment not found' });
        return;
    }
    res.json(result.rows[0]);
}));
// DELETE /api/comments/:commentId
router.delete('/comments/:commentId', middleware_1.authMiddleware, uuid('commentId'), asyncHandler(async (req, res) => {
    const result = await config_1.pool.query('DELETE FROM card_comments WHERE id = $1 RETURNING id', [req.params.commentId]);
    if (!result.rows[0]) {
        res.status(404).json({ error: 'Comment not found' });
        return;
    }
    res.json({ deleted: true });
}));
// ─── Reactions ────────────────────────────────────────────────────────────────
// POST /api/comments/:commentId/reactions
router.post('/comments/:commentId/reactions', middleware_1.authMiddleware, uuid('commentId'), (0, middleware_1.validate)(boards_2.addReactionSchema), asyncHandler(async (req, res) => {
    const userId = strParam(req.user.id);
    const body = req.body;
    await config_1.pool.query('INSERT INTO card_reactions (comment_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [req.params.commentId, userId, body.emoji ?? '👍']);
    res.json({ success: true });
}));
// DELETE /api/comments/:commentId/reactions
router.delete('/comments/:commentId/reactions', middleware_1.authMiddleware, uuid('commentId'), asyncHandler(async (req, res) => {
    const userId = strParam(req.user.id);
    const { emoji } = req.body;
    if (emoji) {
        await config_1.pool.query('DELETE FROM card_reactions WHERE comment_id = $1 AND user_id = $2 AND emoji = $3', [req.params.commentId, userId, emoji]);
    }
    else {
        await config_1.pool.query('DELETE FROM card_reactions WHERE comment_id = $1 AND user_id = $2', [req.params.commentId, userId]);
    }
    res.json({ deleted: true });
}));
// GET /api/comments/:commentId/reactions
router.get('/comments/:commentId/reactions', middleware_1.authMiddleware, uuid('commentId'), asyncHandler(async (req, res) => {
    const result = await config_1.pool.query(`SELECT cr.*, u.username FROM card_reactions cr
     LEFT JOIN rbac_users u ON cr.user_id = u.id
     WHERE cr.comment_id = $1`, [req.params.commentId]);
    res.json(result.rows);
}));
// ─── Card Relations ───────────────────────────────────────────────────────────
// GET /api/cards/:cardId/relations
router.get('/cards/:cardId/relations', middleware_1.authMiddleware, uuid('cardId'), asyncHandler(async (req, res) => {
    const result = await config_1.pool.query(`SELECT cr.*, c.title as target_title, c.type as target_type
     FROM card_relations cr
     JOIN cards c ON cr.target_card_id = c.id
     WHERE cr.card_id = $1`, [req.params.cardId]);
    res.json(result.rows);
}));
// POST /api/cards/:cardId/relations
router.post('/cards/:cardId/relations', middleware_1.authMiddleware, uuid('cardId'), (0, middleware_1.validate)(boards_2.createCardRelationSchema), asyncHandler(async (req, res) => {
    const body = req.body;
    const result = await config_1.pool.query(`INSERT INTO card_relations (card_id, target_card_id, relation_type)
     VALUES ($1, $2, $3) RETURNING *`, [req.params.cardId, body.targetCardId, body.relationType]);
    res.status(201).json(result.rows[0]);
}));
// DELETE /api/cards/:cardId/relations/:relationId
router.delete('/cards/:cardId/relations/:relationId', middleware_1.authMiddleware, uuid('cardId'), asyncHandler(async (req, res) => {
    const p = req.params;
    await config_1.pool.query('DELETE FROM card_relations WHERE id = $1 AND card_id = $2', [p.relationId, p.cardId]);
    res.json({ deleted: true });
}));
// ─── Activity Log ─────────────────────────────────────────────────────────────
// GET /api/cards/:cardId/activity
router.get('/cards/:cardId/activity', middleware_1.authMiddleware, uuid('cardId'), asyncHandler(async (req, res) => {
    const result = await config_1.pool.query(`SELECT cal.*, u.username FROM card_activity_log cal
     LEFT JOIN rbac_users u ON cal.actor_id = u.id
     WHERE cal.card_id = $1
     ORDER BY cal.created_at ASC`, [req.params.cardId]);
    res.json(result.rows);
}));
// ─── Templates ────────────────────────────────────────────────────────────────
// GET /api/boards/:boardId/templates
router.get('/:boardId/templates', middleware_1.authMiddleware, uuid('boardId'), asyncHandler(async (req, res) => {
    const templates = await boardsRepo.findTemplatesByBoardId(req.params.boardId);
    res.json(templates);
}));
// POST /api/boards/:boardId/templates
router.post('/:boardId/templates', middleware_1.authMiddleware, uuid('boardId'), (0, middleware_1.validate)(boards_2.createCardTemplateSchema), asyncHandler(async (req, res) => {
    const body = req.body;
    const template = await boardsRepo.createTemplate({ boardId: req.params.boardId, name: body.name, description: body.description, type: body.type, titleTemplate: body.titleTemplate, descriptionTemplate: body.descriptionTemplate, fields: body.fields });
    res.status(201).json(template);
}));
// DELETE /api/templates/:templateId
router.delete('/templates/:templateId', middleware_1.authMiddleware, uuid('templateId'), asyncHandler(async (req, res) => {
    const deleted = await boardsRepo.deleteTemplate(req.params.templateId);
    if (!deleted) {
        res.status(404).json({ error: 'Template not found' });
        return;
    }
    res.json({ deleted: true });
}));
// ─── Labels ───────────────────────────────────────────────────────────────────
// POST /api/boards/:boardId/labels
router.post('/:boardId/labels', middleware_1.authMiddleware, uuid('boardId'), (0, middleware_1.validate)(boards_2.createLabelSchema), asyncHandler(async (req, res) => {
    const body = req.body;
    const label = await boardsRepo.createLabel({ boardId: req.params.boardId, name: body.name, color: body.color });
    res.status(201).json(label);
}));
// GET /api/boards/:boardId/labels
router.get('/:boardId/labels', middleware_1.authMiddleware, uuid('boardId'), asyncHandler(async (req, res) => {
    const labels = await boardsRepo.findLabelsByBoardId(req.params.boardId);
    res.json(labels);
}));
// DELETE /api/labels/:labelId
router.delete('/labels/:labelId', middleware_1.authMiddleware, uuid('labelId'), asyncHandler(async (req, res) => {
    const deleted = await boardsRepo.deleteLabel(req.params.labelId);
    if (!deleted) {
        res.status(404).json({ error: 'Label not found' });
        return;
    }
    res.json({ deleted: true });
}));
// ─── Attachments ──────────────────────────────────────────────────────────────
// GET /api/cards/:cardId/attachments
router.get('/cards/:cardId/attachments', middleware_1.authMiddleware, uuid('cardId'), asyncHandler(async (req, res) => {
    const result = await config_1.pool.query('SELECT * FROM card_attachments WHERE card_id = $1 ORDER BY created_at ASC', [req.params.cardId]);
    res.json(result.rows);
}));
// POST /api/cards/:cardId/attachments
router.post('/cards/:cardId/attachments', middleware_1.authMiddleware, uuid('cardId'), asyncHandler(async (req, res) => {
    const body = req.body;
    if (!body.filename || !body.url) {
        res.status(400).json({ error: 'filename and url are required' });
        return;
    }
    const userId = strParam(req.user.id);
    const result = await config_1.pool.query(`INSERT INTO card_attachments (card_id, filename, url, mime_type, size_bytes, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [req.params.cardId, body.filename, body.url, body.mimeType ?? null, body.sizeBytes ?? null, userId]);
    res.status(201).json(result.rows[0]);
}));
// DELETE /api/attachments/:attachmentId
router.delete('/attachments/:attachmentId', middleware_1.authMiddleware, uuid('attachmentId'), asyncHandler(async (req, res) => {
    await config_1.pool.query('DELETE FROM card_attachments WHERE id = $1', [req.params.attachmentId]);
    res.json({ deleted: true });
}));
// ─── Board Membership ───────────────────────────────────────────────────────────
// GET /api/boards/:boardId/members
router.get('/:boardId/members', middleware_1.authMiddleware, uuid('boardId'), asyncHandler(async (req, res) => {
    const boardId = req.params.boardId;
    const board = await boardsRepo.findById(boardId);
    if (!board) {
        res.status(404).json({ error: 'Board not found' });
        return;
    }
    const members = await boardsRepo.findMembersByBoardId(boardId);
    res.json(members);
}));
// POST /api/boards/:boardId/members
router.post('/:boardId/members', middleware_1.authMiddleware, uuid('boardId'), (0, middleware_1.validate)(boards_2.addBoardMemberSchema), asyncHandler(async (req, res) => {
    const boardId = req.params.boardId;
    const board = await boardsRepo.findById(boardId);
    if (!board) {
        res.status(404).json({ error: 'Board not found' });
        return;
    }
    const body = req.body;
    const member = await boardsRepo.addBoardMember({ boardId, userId: body.userId, role: body.role });
    res.status(201).json(member);
}));
// PATCH /api/boards/:boardId/members/:memberId
router.patch('/:boardId/members/:memberId', middleware_1.authMiddleware, uuid('boardId'), uuid('memberId'), (0, middleware_1.validate)(boards_2.updateBoardMemberRoleSchema), asyncHandler(async (req, res) => {
    const p = req.params;
    const body = req.body;
    const member = await boardsRepo.updateBoardMemberRole(p.memberId, body.role);
    if (!member) {
        res.status(404).json({ error: 'Board member not found' });
        return;
    }
    res.json(member);
}));
// DELETE /api/boards/:boardId/members/:memberId
router.delete('/:boardId/members/:memberId', middleware_1.authMiddleware, uuid('boardId'), uuid('memberId'), asyncHandler(async (req, res) => {
    const p = req.params;
    const removed = await boardsRepo.removeBoardMember(p.memberId);
    if (!removed) {
        res.status(404).json({ error: 'Board member not found' });
        return;
    }
    res.json({ deleted: true });
}));
exports.default = router;
//# sourceMappingURL=boards.js.map
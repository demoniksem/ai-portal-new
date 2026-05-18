"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cardsService_1 = require("../services/cardsService");
const router = (0, express_1.Router)();
const cardsService = new cardsService_1.CardsService();
// asyncHandler mirrors the pattern used in boards.ts
function asyncHandler(fn) {
    return ((req, res, next) => fn(req, res, next).catch(next));
}
// Helpers
const str = (v) => Array.isArray(v) ? v[0] : v;
// ============ CARDS ============
// GET /api/cards
router.get('/', asyncHandler(async (req, res) => {
    const cards = await cardsService.getCards({
        boardId: str(req.query.boardId),
        columnId: str(req.query.columnId),
    });
    res.json({ cards });
}));
// GET /api/cards/:id
router.get('/:id', asyncHandler(async (req, res) => {
    const card = await cardsService.getCardById(req.params.id);
    if (!card) {
        res.status(404).json({ error: 'Card not found' });
        return;
    }
    res.json(card);
}));
// POST /api/cards
router.post('/', asyncHandler(async (req, res) => {
    const { boardId, columnId, title, type, description, priority, position, authorId, swimlaneId } = req.body;
    if (!boardId || !columnId || !title) {
        res.status(400).json({ error: 'boardId, columnId and title are required' });
        return;
    }
    const card = await cardsService.createCard({
        boardId, columnId, title, type, description, priority, position, authorId, swimlaneId,
    });
    res.status(201).json(card);
}));
// PUT /api/cards/:id
router.put('/:id', asyncHandler(async (req, res) => {
    const card = await cardsService.updateCard(req.params.id, req.body);
    if (!card) {
        res.status(404).json({ error: 'Card not found' });
        return;
    }
    res.json(card);
}));
// PATCH /api/cards/:id/position — drag-drop reorder
router.patch('/:id/position', asyncHandler(async (req, res) => {
    const { columnId, swimlaneId, position } = req.body;
    const card = await cardsService.updateCard(req.params.id, { columnId, swimlaneId, position });
    if (!card) {
        res.status(404).json({ error: 'Card not found' });
        return;
    }
    res.json(card);
}));
// DELETE /api/cards/:id
router.delete('/:id', asyncHandler(async (req, res) => {
    const result = await cardsService.deleteCard(req.params.id);
    if (!result) {
        res.status(404).json({ error: 'Card not found' });
        return;
    }
    res.json({ success: true });
}));
exports.default = router;
//# sourceMappingURL=cards.js.map
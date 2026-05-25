import { Router, Request, Response, NextFunction } from 'express';
import { CardsService } from '../services/cardsService';
import { authMiddleware, requirePermission } from '../middleware';

const router: Router = Router();
const cardsService = new CardsService();

// asyncHandler mirrors the pattern used in boards.ts
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return ((req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next)
  ) as unknown as ReturnType<typeof router.get>;
}

// Helpers
const str = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

// ============ CARDS ============

// GET /api/cards
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const cards = await cardsService.getCards({
    boardId: str(req.query.boardId as string | string[]),
    columnId: str(req.query.columnId as string | string[]),
  });
  res.json({ cards });
}));

// GET /api/cards/:id
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const card = await cardsService.getCardById(req.params.id as string);
  if (!card) { res.status(404).json({ error: 'Card not found' }); return; }
  res.json(card);
}));

// POST /api/cards
router.post('/', authMiddleware, requirePermission('card.create'), asyncHandler(async (req: Request, res: Response) => {
  const { boardId, columnId, title, type, description, priority, position, authorId, swimlaneId } = req.body;
  if (!boardId || !columnId || !title) {
    res.status(400).json({ error: 'boardId, columnId and title are required' }); return;
  }
  const card = await cardsService.createCard({
    boardId, columnId, title, type, description, priority, position, authorId, swimlaneId,
  });
  res.status(201).json(card);
}));

// PUT /api/cards/:id
router.put('/:id', authMiddleware, requirePermission('card.update'), asyncHandler(async (req: Request, res: Response) => {
  const card = await cardsService.updateCard(req.params.id as string, req.body);
  if (!card) { res.status(404).json({ error: 'Card not found' }); return; }
  res.json(card);
}));

// PATCH /api/cards/:id/position — drag-drop reorder
router.patch('/:id/position', asyncHandler(async (req: Request, res: Response) => {
  const { columnId, swimlaneId, position } = req.body;
  const card = await cardsService.updateCard(req.params.id as string, { columnId, swimlaneId, position });
  if (!card) { res.status(404).json({ error: 'Card not found' }); return; }
  res.json(card);
}));

// DELETE /api/cards/:id
router.delete('/:id', authMiddleware, requirePermission('card.delete'), asyncHandler(async (req: Request, res: Response) => {
  const result = await cardsService.deleteCard(req.params.id as string);
  if (!result) { res.status(404).json({ error: 'Card not found' }); return; }
  res.json({ success: true });
}));

export default router;

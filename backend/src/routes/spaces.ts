import { Router, Response, Request, RequestHandler } from 'express';
import { logger } from '../config/logger';
import { SpacesService } from '../services/spacesService';
import { authMiddleware, validate } from '../middleware';
import { createSpaceSchema } from '../schemas';

const router: Router = Router();
const spacesService = new SpacesService();

interface CreateSpaceBody {
  name: string;
  slug: string;
}

// GET /api/spaces
const getSpacesHandler: RequestHandler = async (req, res) => {
  try {
    const spaces = await spacesService.getAllSpaces();
    res.json(spaces);
  } catch (e) {
    logger.error({ msg: 'Spaces GET error', error: (e as Error).message, requestId: (req as unknown as { requestId?: string }).requestId });
    res.status(500).json({ error: 'Failed to fetch spaces' });
  }
};

// POST /api/spaces
const createSpaceHandler: RequestHandler = async (req, res) => {
  try {
    const { name, slug } = req.body as unknown as CreateSpaceBody;
    const userId = (req as unknown as { user: { id: number } }).user.id;
    const result = await spacesService.createSpace({ name, slug }, userId);

    if ('error' in result) {
      res.status((result.status as number) ?? 500).json({ error: result.error });
      return;
    }

    res.status(201).json(result.space);
  } catch (e) {
    logger.error({ msg: 'Spaces POST error', error: (e as Error).message, requestId: (req as unknown as { requestId?: string }).requestId });
    res.status(500).json({ error: 'Failed to create space' });
  }
};

// GET /api/spaces/:id
const getSpaceHandler: RequestHandler = async (req, res) => {
  try {
    const id = parseInt((req as unknown as { params: { id: string } }).params.id);
    const space = await spacesService.getSpaceById(id);
    if (!space) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }
    res.json(space);
  } catch (e) {
    logger.error({ msg: 'Space GET error', error: (e as Error).message, requestId: (req as unknown as { requestId?: string }).requestId });
    res.status(500).json({ error: 'Failed to fetch space' });
  }
};

// DELETE /api/spaces/:id
const deleteSpaceHandler: RequestHandler = async (req, res) => {
  try {
    const id = parseInt((req as unknown as { params: { id: string } }).params.id);
    const result = await spacesService.deleteSpace(id);
    if ('error' in result) {
      res.status((result.status as number) ?? 500).json({ error: result.error });
      return;
    }
    res.json({ deleted: true });
  } catch (e) {
    logger.error({ msg: 'Space DELETE error', error: (e as Error).message, requestId: (req as unknown as { requestId?: string }).requestId });
    res.status(500).json({ error: 'Failed to delete space' });
  }
};

router.get('/', authMiddleware, getSpacesHandler);
router.post('/', authMiddleware, validate(createSpaceSchema), createSpaceHandler);
router.get('/:id', authMiddleware, getSpaceHandler);
router.delete('/:id', authMiddleware, deleteSpaceHandler);

export default router;

import { Router, RequestHandler } from 'express';
import { logger } from '../config/logger';
import { SearchService } from '../services/searchService';
import { authMiddleware } from '../middleware/rbac';
import { validateQuery, querySchemas } from '../middleware/validation';

const searchService = new SearchService();
const router: Router = Router();

const searchHandler: RequestHandler = async (req, res) => {
  try {
    const { q, spaceId, limit, offset, highlight } = req.query as unknown as {
      q: string;
      spaceId?: string;
      limit?: number;
      offset?: number;
      highlight?: boolean;
    };
    if (!q) return res.status(400).json({ error: 'Search query required' });

    const result = await searchService.search({ query: q, spaceId, limit, offset, highlight });
    if ('error' in result) return res.status(result.status ?? 500).json({ error: result.error });
    return res.json(result);
  } catch (e) {
    logger.error({ msg: 'Search error', error: (e as Error).message, stack: (e as Error).stack, requestId: (req as unknown as { requestId?: string }).requestId });
    return res.status(500).json({ error: 'Search failed' });
  }
};

const autocompleteHandler: RequestHandler = async (req, res) => {
  try {
    const { q: query, limit } = req.query as unknown as { q: string; limit?: number };
    if (!query) return res.status(400).json({ error: 'Query required' });
    const result = await searchService.autocomplete(query, limit ?? 5);
    return res.json(result);
  } catch (e) {
    logger.error({ msg: 'Autocomplete error', error: (e as Error).message });
    return res.status(500).json({ error: 'Autocomplete failed' });
  }
};

router.get('/', authMiddleware, validateQuery(querySchemas.search), searchHandler);
router.get('/autocomplete', authMiddleware, validateQuery(querySchemas.autocomplete), autocompleteHandler);

export default router;

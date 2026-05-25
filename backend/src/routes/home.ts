'use strict';

import { Router, Request, Response } from 'express';
import { pool } from '../config';
import { logger } from '../config/logger';
import { authMiddleware } from '../middleware';
import { CardsRepository, CardRow } from '../repositories/cards';
import { NotificationsRepository } from '../repositories/notifications';
import { homeEvents } from '../utils/events';

const router: Router = Router();
const cardsRepo = new CardsRepository();
const notificationsRepo = new NotificationsRepository();

// Apply auth to all routes
router.use(authMiddleware);

// ============ MY TASKS ============
// GET /api/home/my-cards — cards assigned to the authenticated user
router.get('/my-cards', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const cards = await cardsRepo.findByAssignee(userId);
    // Enrich with board/column info
    const enriched = await Promise.all(cards.map(async (card: CardRow) => {
      const [boardRow, columnRow] = await Promise.all([
        pool.query<{ name: string }>('SELECT name FROM boards WHERE id = $1', [card.board_id]).then(r => r.rows[0]),
        pool.query<{ name: string }>('SELECT name FROM board_columns WHERE id = $1', [card.column_id]).then(r => r.rows[0]),
      ]);
      return {
        ...card,
        boardName: boardRow?.name ?? 'Unknown Board',
        columnName: columnRow?.name ?? 'Unknown Column',
      };
    }));
    res.json({ cards: enriched });
  } catch (e) {
    logger.error({ msg: 'Home my-cards error', error: (e as Error).message, requestId: (req as any).requestId });
    res.status(500).json({ error: (e as Error).message });
  }
});

// ============ ACTIVITY FEED ============
// GET /api/home/activity — recent card changes across boards the user can access
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const limit = parseInt((req.query.limit as string) || '30', 10);
    const result = await pool.query<{
      id: string;
      card_id: string;
      actor_id: string;
      action: string;
      field: string | null;
      old_value: string | null;
      new_value: string | null;
      metadata: string | null;
      created_at: Date;
      card_title: string;
      board_name: string;
      username: string;
    }>(
      `SELECT
         cal.id, cal.card_id, cal.actor_id, cal.action, cal.field,
         cal.old_value, cal.new_value, cal.metadata, cal.created_at,
         c.title AS card_title,
         b.name AS board_name,
         u.username
       FROM card_activity_log cal
       INNER JOIN cards c ON c.id = cal.card_id
       INNER JOIN boards b ON b.id = c.board_id
       LEFT JOIN rbac_users u ON u.id = cal.actor_id
       WHERE b.created_by = $1
          OR c.id IN (
              SELECT ca.card_id FROM card_assignees ca WHERE ca.user_id = $1
            )
       ORDER BY cal.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    res.json({ activities: result.rows });
  } catch (e) {
    logger.error({ msg: 'Home activity error', error: (e as Error).message, requestId: (req as any).requestId });
    res.status(500).json({ error: (e as Error).message });
  }
});

// ============ NOTIFICATIONS ============
// GET /api/home/notifications — notifications for the authenticated user
router.get('/notifications', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const notifications = await notificationsRepo.findByUserId(userId, { limit: 50 });
    const unreadCount = await notificationsRepo.countUnread(userId);
    res.json({ notifications, unreadCount });
  } catch (e) {
    logger.error({ msg: 'Home notifications error', error: (e as Error).message, requestId: (req as any).requestId });
    res.status(500).json({ error: (e as Error).message });
  }
});

// PUT /api/home/notifications/read-all — mark all as read
router.put('/notifications/read-all', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const count = await notificationsRepo.markAllRead(userId);
    homeEvents.broadcast(userId, 'notifications_read', { count });
    res.json({ success: true, count });
  } catch (e) {
    logger.error({ msg: 'Home notifications read-all error', error: (e as Error).message, requestId: (req as any).requestId });
    res.status(500).json({ error: (e as Error).message });
  }
});

// ============ CALENDAR ============
// GET /api/home/calendar — cards with deadlines in a date range
router.get('/calendar', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const start = req.query.start as string;
    const end = req.query.end as string;
    if (!start || !end) {
      res.status(400).json({ error: 'start and end query params are required (ISO date strings)' });
      return;
    }
    const cards = await cardsRepo.findByDeadlineRange(start, end);
    const enriched = await Promise.all(cards.map(async (card: CardRow) => {
      const [boardRow, columnRow] = await Promise.all([
        pool.query<{ name: string }>('SELECT name FROM boards WHERE id = $1', [card.board_id]).then(r => r.rows[0]),
        pool.query<{ name: string }>('SELECT name FROM board_columns WHERE id = $1', [card.column_id]).then(r => r.rows[0]),
      ]);
      return {
        ...card,
        boardName: boardRow?.name ?? 'Unknown Board',
        columnName: columnRow?.name ?? 'Unknown Column',
      };
    }));
    res.json({ cards: enriched });
  } catch (e) {
    logger.error({ msg: 'Home calendar error', error: (e as Error).message, requestId: (req as any).requestId });
    res.status(500).json({ error: (e as Error).message });
  }
});

// ============ REAL-TIME SSE ============
// GET /api/home/events — SSE stream for real-time updates
router.get('/events', async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering if behind proxy
  res.flushHeaders();

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`);

  // Register client
  homeEvents.addClient(userId, res);

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 30000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    homeEvents.removeClient(userId, res);
    logger.info({ msg: 'SSE client disconnected', userId });
  });
});

export default router;

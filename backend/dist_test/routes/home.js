'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const config_1 = require("../config");
const logger_1 = require("../config/logger");
const middleware_1 = require("../middleware");
const cards_1 = require("../repositories/cards");
const notifications_1 = require("../repositories/notifications");
const events_1 = require("../utils/events");
const router = (0, express_1.Router)();
const cardsRepo = new cards_1.CardsRepository();
const notificationsRepo = new notifications_1.NotificationsRepository();
// Apply auth to all routes
router.use(middleware_1.authMiddleware);
// ============ MY TASKS ============
// GET /api/home/my-cards — cards assigned to the authenticated user
router.get('/my-cards', async (req, res) => {
    try {
        const userId = req.user.id;
        const cards = await cardsRepo.findByAssignee(userId);
        // Enrich with board/column info
        const enriched = await Promise.all(cards.map(async (card) => {
            const [boardRow, columnRow] = await Promise.all([
                config_1.pool.query('SELECT name FROM boards WHERE id = $1', [card.board_id]).then(r => r.rows[0]),
                config_1.pool.query('SELECT name FROM board_columns WHERE id = $1', [card.column_id]).then(r => r.rows[0]),
            ]);
            return {
                ...card,
                boardName: boardRow?.name ?? 'Unknown Board',
                columnName: columnRow?.name ?? 'Unknown Column',
            };
        }));
        res.json({ cards: enriched });
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Home my-cards error', error: e.message, requestId: req.requestId });
        res.status(500).json({ error: e.message });
    }
});
// ============ ACTIVITY FEED ============
// GET /api/home/activity — recent card changes across boards the user can access
router.get('/activity', async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit || '30', 10);
        const result = await config_1.pool.query(`SELECT
         cal.id, cal.card_id, cal.actor_id, cal.action, cal.field,
         cal.old_value, cal.new_value, cal.metadata, cal.created_at,
         c.title AS card_title,
         b.name AS board_name,
         u.username
       FROM card_activity_log cal
       INNER JOIN cards c ON c.id = cal.card_id
       INNER JOIN boards b ON b.id = c.board_id
       LEFT JOIN users u ON u.id = cal.actor_id
       WHERE b.created_by = $1
          OR c.id IN (
              SELECT ca.card_id FROM card_assignees ca WHERE ca.user_id = $1
            )
       ORDER BY cal.created_at DESC
       LIMIT $2`, [userId, limit]);
        res.json({ activities: result.rows });
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Home activity error', error: e.message, requestId: req.requestId });
        res.status(500).json({ error: e.message });
    }
});
// ============ NOTIFICATIONS ============
// GET /api/home/notifications — notifications for the authenticated user
router.get('/notifications', async (req, res) => {
    try {
        const userId = req.user.id;
        const notifications = await notificationsRepo.findByUserId(userId, { limit: 50 });
        const unreadCount = await notificationsRepo.countUnread(userId);
        res.json({ notifications, unreadCount });
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Home notifications error', error: e.message, requestId: req.requestId });
        res.status(500).json({ error: e.message });
    }
});
// PUT /api/home/notifications/read-all — mark all as read
router.put('/notifications/read-all', async (req, res) => {
    try {
        const userId = req.user.id;
        const count = await notificationsRepo.markAllRead(userId);
        events_1.homeEvents.broadcast(userId, 'notifications_read', { count });
        res.json({ success: true, count });
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Home notifications read-all error', error: e.message, requestId: req.requestId });
        res.status(500).json({ error: e.message });
    }
});
// ============ CALENDAR ============
// GET /api/home/calendar — cards with deadlines in a date range
router.get('/calendar', async (req, res) => {
    try {
        const userId = req.user.id;
        const start = req.query.start;
        const end = req.query.end;
        if (!start || !end) {
            res.status(400).json({ error: 'start and end query params are required (ISO date strings)' });
            return;
        }
        const cards = await cardsRepo.findByDeadlineRange(start, end);
        const enriched = await Promise.all(cards.map(async (card) => {
            const [boardRow, columnRow] = await Promise.all([
                config_1.pool.query('SELECT name FROM boards WHERE id = $1', [card.board_id]).then(r => r.rows[0]),
                config_1.pool.query('SELECT name FROM board_columns WHERE id = $1', [card.column_id]).then(r => r.rows[0]),
            ]);
            return {
                ...card,
                boardName: boardRow?.name ?? 'Unknown Board',
                columnName: columnRow?.name ?? 'Unknown Column',
            };
        }));
        res.json({ cards: enriched });
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Home calendar error', error: e.message, requestId: req.requestId });
        res.status(500).json({ error: e.message });
    }
});
// ============ REAL-TIME SSE ============
// GET /api/home/events — SSE stream for real-time updates
router.get('/events', async (req, res) => {
    const userId = req.user.id;
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering if behind proxy
    res.flushHeaders();
    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`);
    // Register client
    events_1.homeEvents.addClient(userId, res);
    // Heartbeat every 30s to keep connection alive
    const heartbeat = setInterval(() => {
        try {
            res.write(': heartbeat\n\n');
        }
        catch {
            clearInterval(heartbeat);
        }
    }, 30000);
    // Clean up on disconnect
    req.on('close', () => {
        clearInterval(heartbeat);
        events_1.homeEvents.removeClient(userId, res);
        logger_1.logger.info({ msg: 'SSE client disconnected', userId });
    });
});
exports.default = router;
//# sourceMappingURL=home.js.map
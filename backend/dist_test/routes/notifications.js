"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const logger_1 = require("../config/logger");
const notifications_1 = require("../repositories/notifications");
const middleware_1 = require("../middleware");
const ai_1 = require("../schemas/ai");
const router = (0, express_1.Router)();
const notificationsRepo = new notifications_1.NotificationsRepository();
// POST /api/notifications
router.post('/', middleware_1.authMiddleware, (0, middleware_1.validate)(ai_1.createNotificationSchema), async (req, res) => {
    try {
        const { title, message, userId } = req.body;
        const notification = await notificationsRepo.create({
            userId: userId || req.user.id,
            title,
            message,
        });
        return res.status(201).json(notification);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Notification create error', error: e.message, stack: e.stack, requestId: req.requestId });
        return res.status(500).json({ error: e.message });
    }
});
// GET /api/notifications
router.get('/', middleware_1.authMiddleware, async (req, res) => {
    try {
        const notifications = await notificationsRepo.findByUserId(req.user.id);
        return res.json(notifications);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Notifications GET error', error: e.message, stack: e.stack, requestId: req.requestId });
        return res.status(500).json({ error: e.message });
    }
});
// PUT /api/notifications/:id/read
router.put('/:id/read', middleware_1.authMiddleware, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const result = await notificationsRepo.markRead(id, req.user.id);
        if (!result)
            return res.status(404).json({ error: 'Not found' });
        return res.json(result);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Notification mark read error', error: e.message, stack: e.stack, requestId: req.requestId });
        return res.status(500).json({ error: e.message });
    }
});
// PUT /api/notifications/mark-all-read
router.put('/mark-all-read', middleware_1.authMiddleware, async (req, res) => {
    try {
        await notificationsRepo.markAllRead(req.user.id);
        return res.json({ ok: true });
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Notification mark all read error', error: e.message, stack: e.stack, requestId: req.requestId });
        return res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=notifications.js.map
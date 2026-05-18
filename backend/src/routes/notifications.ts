import { Router, Request, Response } from 'express';
import { logger } from '../config/logger';
import { NotificationsRepository } from '../repositories/notifications';
import { authMiddleware, validate } from '../middleware';
import { createNotificationSchema } from '../schemas/ai';

const router: Router = Router();
const notificationsRepo = new NotificationsRepository();

interface CreateNotificationBody {
  title: string;
  message: string;
  userId?: number;
}

// POST /api/notifications
router.post('/', authMiddleware, validate(createNotificationSchema), async (req: Request, res: Response) => {
  try {
    const { title, message, userId } = req.body as unknown as CreateNotificationBody;
    const notification = await notificationsRepo.create({
      userId: userId || (req as any).user.id,
      title,
      message,
    });
    return res.status(201).json(notification);
  } catch (e) {
    logger.error({ msg: 'Notification create error', error: (e as Error).message, stack: (e as Error).stack, requestId: (req as any).requestId });
    return res.status(500).json({ error: (e as Error).message });
  }
});

// GET /api/notifications
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const notifications = await notificationsRepo.findByUserId((req as any).user.id);
    return res.json(notifications);
  } catch (e) {
    logger.error({ msg: 'Notifications GET error', error: (e as Error).message, stack: (e as Error).stack, requestId: (req as any).requestId });
    return res.status(500).json({ error: (e as Error).message });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const result = await notificationsRepo.markRead(id, (req as any).user.id);
    if (!result) return res.status(404).json({ error: 'Not found' });
    return res.json(result);
  } catch (e) {
    logger.error({ msg: 'Notification mark read error', error: (e as Error).message, stack: (e as Error).stack, requestId: (req as any).requestId });
    return res.status(500).json({ error: (e as Error).message });
  }
});

// PUT /api/notifications/mark-all-read
router.put('/mark-all-read', authMiddleware, async (req: Request, res: Response) => {
  try {
    await notificationsRepo.markAllRead((req as any).user.id);
    return res.json({ ok: true });
  } catch (e) {
    logger.error({ msg: 'Notification mark all read error', error: (e as Error).message, stack: (e as Error).stack, requestId: (req as any).requestId });
    return res.status(500).json({ error: (e as Error).message });
  }
});

export default router;

import { NotificationsRepository, NotificationRow } from '../repositories/notifications';

const notificationsRepo = new NotificationsRepository();

class NotificationsService {
  async getAll(userId: number): Promise<NotificationRow[]> {
    return notificationsRepo.findByUserId(userId);
  }

  async create(data: { title: string; message: string; userId?: number }, actorUserId: number): Promise<NotificationRow> {
    return notificationsRepo.create({
      userId: data.userId || actorUserId,
      title: data.title,
      message: data.message,
    });
  }

  async markRead(data: { id: number }, userId: number): Promise<NotificationRow | { error: string; status: number }> {
    const result = await notificationsRepo.markRead(data.id, userId);
    if (!result) return { error: 'Not found', status: 404 };
    return result;
  }
}

export { NotificationsService };
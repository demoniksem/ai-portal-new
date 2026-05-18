"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const notifications_1 = require("../repositories/notifications");
const notificationsRepo = new notifications_1.NotificationsRepository();
class NotificationsService {
    async getAll(userId) {
        return notificationsRepo.findByUserId(userId);
    }
    async create(data, actorUserId) {
        return notificationsRepo.create({
            userId: data.userId || actorUserId,
            title: data.title,
            message: data.message,
        });
    }
    async markRead(data, userId) {
        const result = await notificationsRepo.markRead(data.id, userId);
        if (!result)
            return { error: 'Not found', status: 404 };
        return result;
    }
}
exports.NotificationsService = NotificationsService;
//# sourceMappingURL=notificationsService.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentsService = void 0;
const comments_1 = require("../repositories/comments");
class CommentsService {
    constructor() {
        this.commentsRepo = new comments_1.CommentsRepository();
    }
    async getByPageId(pageId) {
        return this.commentsRepo.findByPageId(pageId);
    }
    async createComment(data, userId) {
        return this.commentsRepo.create({ pageId: data.pageId, userId, text: data.text });
    }
    async updateComment(data, userId) {
        const result = await this.commentsRepo.update(data.commentId, { text: data.text, userId });
        if (!result)
            return { error: 'Comment not found', status: 404 };
        return result;
    }
    async deleteComment(data, userId) {
        const deleted = await this.commentsRepo.delete(data.commentId, userId);
        if (!deleted)
            return { error: 'Comment not found', status: 404 };
        return { deleted: true };
    }
}
exports.CommentsService = CommentsService;
//# sourceMappingURL=commentsService.js.map
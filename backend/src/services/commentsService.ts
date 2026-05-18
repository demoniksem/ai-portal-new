import { CommentsRepository, CommentRow } from '../repositories/comments';

class CommentsService {
  commentsRepo: CommentsRepository;

  constructor() {
    this.commentsRepo = new CommentsRepository();
  }

  async getByPageId(pageId: number): Promise<CommentRow[]> {
    return this.commentsRepo.findByPageId(pageId);
  }

  async createComment(data: { pageId: number; text: string }, userId: number): Promise<CommentRow> {
    return this.commentsRepo.create({ pageId: data.pageId, userId, text: data.text });
  }

  async updateComment(data: { commentId: number; text: string }, userId: number): Promise<CommentRow | { error: string; status: number }> {
    const result = await this.commentsRepo.update(data.commentId, { text: data.text, userId });
    if (!result) return { error: 'Comment not found', status: 404 };
    return result;
  }

  async deleteComment(data: { commentId: number }, userId: number): Promise<{ deleted: boolean } | { error: string; status: number }> {
    const deleted = await this.commentsRepo.delete(data.commentId, userId);
    if (!deleted) return { error: 'Comment not found', status: 404 };
    return { deleted: true };
  }
}

export { CommentsService };
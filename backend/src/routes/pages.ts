import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { PagesService } from '../services/pagesService';
import { CommentsRepository } from '../repositories/comments';
import { authMiddleware, validate, requirePermission } from '../middleware';
import { createPageSchema, updatePageSchema, createCommentSchema, updateCommentSchema, rollbackVersionSchema } from '../schemas';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const router: Router = Router();
const pagesService = new PagesService();
const commentsRepo = new CommentsRepository();

// Configure multer for file uploads
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

interface CreatePageBody {
  title: string;
  content?: string;
  spaceId?: number;
  parentId?: number | null;
  acl?: unknown;
}

interface UpdatePageBody {
  title?: string;
  content?: string;
  parentId?: number | null;
  acl?: unknown;
}

interface CreateCommentBody {
  text: string;
}

interface UpdateCommentBody {
  text: string;
}

interface RollbackBody {
  versionId: number;
}

// GET /api/pages
router.get('/', authMiddleware, (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = req.query.spaceId ? parseInt(req.query.spaceId as string) : undefined;
    const includeDeleted = req.query.includeDeleted === 'true';
    const pages = await pagesService.getAllPages({ spaceId, includeDeleted });
    return res.json(pages);
  } catch (e) {
    logger.error({ msg: 'Pages GET error', error: (e as Error).message, requestId: (req as any).requestId });
    return res.status(500).json({ error: 'Failed to fetch pages' });
  }
}) as any);

// GET /api/pages/:id
router.get('/:id', authMiddleware, (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = await pagesService.getPageById(parseInt((req as any).params.id));
    if (!page) return res.status(404).json({ error: 'Page not found' });
    return res.json(page);
  } catch (e) {
    logger.error({ msg: 'Page GET error', error: (e as Error).message, requestId: (req as any).requestId });
    return res.status(500).json({ error: 'Failed to fetch page' });
  }
}) as any);

// POST /api/pages
router.post('/', authMiddleware, validate(createPageSchema), requirePermission('page.create'), (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, content, spaceId, parentId, acl } = req.body as unknown as CreatePageBody;
    const page = await pagesService.createPage({ title, content, spaceId: spaceId ?? 1, parentId, acl }, (req as any).user.id);
    return res.status(201).json(page);
  } catch (e) {
    logger.error({ msg: 'Page POST error', error: (e as Error).message, requestId: (req as any).requestId });
    return res.status(500).json({ error: 'Failed to create page' });
  }
}) as any);

// PATCH /api/pages/:id
router.patch('/:id', authMiddleware, validate(updatePageSchema), requirePermission('page.update'), (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, content, parentId, acl } = req.body as unknown as UpdatePageBody;
    const result = await pagesService.updatePage(parseInt((req as any).params.id), { title, content, parentId, acl }, (req as any).user.id);

    if ('error' in result) {
      return res.status((result as { error: string; status: number }).status ?? 500).json({ error: (result as { error: string }).error });
    }

    return res.json(result);
  } catch (e) {
    logger.error({ msg: 'Page PATCH error', error: (e as Error).message, requestId: (req as any).requestId });
    return res.status(500).json({ error: 'Failed to update page' });
  }
}) as any);

// DELETE /api/pages/:id (soft delete)
router.delete('/:id', authMiddleware, requirePermission('page.delete'), (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pagesService.deletePage(parseInt((req as any).params.id));

    if ('error' in result) {
      return res.status((result as { error: string; status: number }).status ?? 500).json({ error: (result as { error: string }).error });
    }

    return res.json(result);
  } catch (e) {
    logger.error({ msg: 'Page DELETE error', error: (e as Error).message, requestId: (req as any).requestId });
    return res.status(500).json({ error: 'Failed to delete page' });
  }
}) as any);

// GET /api/pages/:id/versions
router.get('/:id/versions', authMiddleware, (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const versions = await pagesService.getVersions(parseInt((req as any).params.id));
    return res.json(versions);
  } catch (e) {
    logger.error({ msg: 'Versions GET error', error: (e as Error).message, requestId: (req as any).requestId });
    return res.status(500).json({ error: 'Failed to fetch versions' });
  }
}) as any);

// GET /api/pages/:id/versions/:versionId
router.get('/:id/versions/:versionId', authMiddleware, (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const version = await pagesService.getVersion(parseInt((req as any).params.versionId));
    if (!version) return res.status(404).json({ error: 'Version not found' });
    return res.json(version);
  } catch (e) {
    logger.error({ msg: 'Version GET error', error: (e as Error).message, requestId: (req as any).requestId });
    return res.status(500).json({ error: 'Failed to fetch version' });
  }
}) as any);

// POST /api/pages/:id/rollback
router.post('/:id/rollback', authMiddleware, validate(rollbackVersionSchema), (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { versionId } = req.body as unknown as RollbackBody;

    const result = await pagesService.rollbackToVersion(versionId, (req as any).user.id);

    if ('error' in result) {
      return res.status((result as { error: string; status: number }).status ?? 500).json({ error: (result as { error: string }).error });
    }

    return res.json(result);
  } catch (e) {
    logger.error({ msg: 'Rollback error', error: (e as Error).message, requestId: (req as any).requestId });
    return res.status(500).json({ error: 'Failed to rollback page' });
  }
}) as any);

// GET /api/pages/:id/children
router.get('/:id/children', authMiddleware, (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const children = await pagesService.getChildren(parseInt((req as any).params.id));
    return res.json(children);
  } catch (e) {
    logger.error({ msg: 'Children GET error', error: (e as Error).message, requestId: (req as any).requestId });
    return res.status(500).json({ error: 'Failed to fetch children' });
  }
}) as any);

// GET /api/pages/tree/:spaceId — get full page tree for a space
router.get('/tree/:spaceId', authMiddleware, (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = parseInt((req as any).params.spaceId);
    const rootPages = await pagesService.getRootPages(spaceId);
    // Recursively build tree
    const buildTree = async (pages: any[]): Promise<any[]> => {
      return Promise.all(pages.map(async (page) => {
        const children = await pagesService.getChildren(page.id);
        const subtree = children.length > 0 ? await buildTree(children) : [];
        return { ...page, children: subtree };
      }));
    };
    const tree = await buildTree(rootPages);
    return res.json(tree);
  } catch (e) {
    logger.error({ msg: 'Page tree GET error', error: (e as Error).message, requestId: (req as any).requestId });
    return res.status(500).json({ error: 'Failed to fetch page tree' });
  }
}) as any);

// POST /api/pages/:id/restore — restore a soft-deleted page
router.post('/:id/restore', authMiddleware, (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pagesService.restorePage(parseInt((req as any).params.id));

    if ('error' in result) {
      return res.status((result as { error: string; status: number }).status ?? 500).json({ error: (result as { error: string }).error });
    }

    return res.json(result);
  } catch (e) {
    logger.error({ msg: 'Restore error', error: (e as Error).message, requestId: (req as any).requestId });
    return res.status(500).json({ error: 'Failed to restore page' });
  }
}) as any);

// POST /api/pages/:id/comments
router.post('/:id/comments', authMiddleware, validate(createCommentSchema), (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pageId = parseInt((req as any).params.id);
    const { text } = req.body as unknown as CreateCommentBody;
    const comment = await commentsRepo.create({ pageId, userId: (req as any).user.id, text });
    return res.status(201).json(comment);
  } catch (e) {
    logger.error({ msg: 'Comment create error', error: (e as Error).message, requestId: (req as any).requestId });
    return res.status(500).json({ error: 'Failed to create comment' });
  }
}) as any);

// GET /api/pages/:id/comments
router.get('/:id/comments', authMiddleware, (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const comments = await commentsRepo.findByPageId(parseInt((req as any).params.id));
    return res.json(comments);
  } catch (e) {
    logger.error({ msg: 'Comments GET error', error: (e as Error).message, requestId: (req as any).requestId });
    return res.status(500).json({ error: 'Failed to fetch comments' });
  }
}) as any);

// PUT /api/pages/:id/comments/:commentId
router.put('/:id/comments/:commentId', authMiddleware, validate(updateCommentSchema), (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const comment = await commentsRepo.update(parseInt((req as any).params.commentId), {
      text: (req.body as unknown as UpdateCommentBody).text,
      userId: (req as any).user.id,
    });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    return res.json(comment);
  } catch (e) {
    logger.error({ msg: 'Comment update error', error: (e as Error).message, requestId: (req as any).requestId });
    return res.status(500).json({ error: 'Failed to update comment' });
  }
}) as any);

// DELETE /api/pages/:id/comments/:commentId
router.delete('/:id/comments/:commentId', authMiddleware, (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await commentsRepo.delete(parseInt((req as any).params.commentId), (req as any).user.id);
    if (!deleted) return res.status(404).json({ error: 'Comment not found' });
    return res.json({ deleted: true });
  } catch (e) {
    logger.error({ msg: 'Comment delete error', error: (e as Error).message, requestId: (req as any).requestId });
    return res.status(500).json({ error: 'Failed to delete comment' });
  }
}) as any);

// GET /api/pages/:id/attachments
router.get('/:id/attachments', authMiddleware, (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attachments = await pagesService.getAttachments(parseInt((req as any).params.id));
    return res.json(attachments);
  } catch (e) {
    logger.error({ msg: 'Attachments GET error', error: (e as Error).message, requestId: (req as any).requestId });
    return res.status(500).json({ error: 'Failed to fetch attachments' });
  }
}) as any);

// POST /api/pages/:id/attachments — multipart file upload
router.post('/:id/attachments', authMiddleware, upload.single('file'), (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pageId = parseInt((req as any).params.id);

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Use multipart/form-data with a "file" field.' });
    }

    const file = req.file;
    // Store relative URL path — frontend accesses via /api/uploads/:filename
    const filePath = `/api/uploads/${file.filename}`;

    const attachment = await pagesService.addAttachment({
      pageId,
      filename: file.originalname,
      filePath,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedBy: (req as any).user.id,
    });
    return res.status(201).json(attachment);
  } catch (e) {
    logger.error({ msg: 'Attachment POST error', error: (e as Error).message, requestId: (req as any).requestId });
    return res.status(500).json({ error: 'Failed to add attachment' });
  }
}) as any);

// DELETE /api/pages/:id/attachments/:attachmentId
router.delete('/:id/attachments/:attachmentId', authMiddleware, (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await pagesService.deleteAttachment(parseInt((req as any).params.attachmentId));
    if (!deleted) return res.status(404).json({ error: 'Attachment not found' });
    return res.json({ deleted: true });
  } catch (e) {
    logger.error({ msg: 'Attachment DELETE error', error: (e as Error).message, requestId: (req as any).requestId });
    return res.status(500).json({ error: 'Failed to delete attachment' });
  }
}) as any);

export default router;
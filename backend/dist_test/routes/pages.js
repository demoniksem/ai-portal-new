"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const logger_1 = require("../config/logger");
const pagesService_1 = require("../services/pagesService");
const comments_1 = require("../repositories/comments");
const middleware_1 = require("../middleware");
const schemas_1 = require("../schemas");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
const pagesService = new pagesService_1.PagesService();
const commentsRepo = new comments_1.CommentsRepository();
// Configure multer for file uploads
const uploadsDir = path_1.default.join(__dirname, '..', 'uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        cb(null, `${(0, uuid_1.v4)()}${ext}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});
// GET /api/pages
router.get('/', middleware_1.authMiddleware, (async (req, res, next) => {
    try {
        const spaceId = req.query.spaceId ? parseInt(req.query.spaceId) : undefined;
        const includeDeleted = req.query.includeDeleted === 'true';
        const pages = await pagesService.getAllPages({ spaceId, includeDeleted });
        return res.json(pages);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Pages GET error', error: e.message, requestId: req.requestId });
        return res.status(500).json({ error: 'Failed to fetch pages' });
    }
}));
// GET /api/pages/:id
router.get('/:id', middleware_1.authMiddleware, (async (req, res, next) => {
    try {
        const page = await pagesService.getPageById(parseInt(req.params.id));
        if (!page)
            return res.status(404).json({ error: 'Page not found' });
        return res.json(page);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Page GET error', error: e.message, requestId: req.requestId });
        return res.status(500).json({ error: 'Failed to fetch page' });
    }
}));
// POST /api/pages
router.post('/', middleware_1.authMiddleware, (0, middleware_1.validate)(schemas_1.createPageSchema), (async (req, res, next) => {
    try {
        const { title, content, spaceId, parentId, acl } = req.body;
        const page = await pagesService.createPage({ title, content, spaceId: spaceId ?? 1, parentId, acl }, req.user.id);
        return res.status(201).json(page);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Page POST error', error: e.message, requestId: req.requestId });
        return res.status(500).json({ error: 'Failed to create page' });
    }
}));
// PATCH /api/pages/:id
router.patch('/:id', middleware_1.authMiddleware, (0, middleware_1.validate)(schemas_1.updatePageSchema), (async (req, res, next) => {
    try {
        const { title, content, parentId, acl } = req.body;
        const result = await pagesService.updatePage(parseInt(req.params.id), { title, content, parentId, acl }, req.user.id);
        if ('error' in result) {
            return res.status(result.status ?? 500).json({ error: result.error });
        }
        return res.json(result);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Page PATCH error', error: e.message, requestId: req.requestId });
        return res.status(500).json({ error: 'Failed to update page' });
    }
}));
// DELETE /api/pages/:id (soft delete)
router.delete('/:id', middleware_1.authMiddleware, (async (req, res, next) => {
    try {
        const result = await pagesService.deletePage(parseInt(req.params.id));
        if ('error' in result) {
            return res.status(result.status ?? 500).json({ error: result.error });
        }
        return res.json(result);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Page DELETE error', error: e.message, requestId: req.requestId });
        return res.status(500).json({ error: 'Failed to delete page' });
    }
}));
// GET /api/pages/:id/versions
router.get('/:id/versions', middleware_1.authMiddleware, (async (req, res, next) => {
    try {
        const versions = await pagesService.getVersions(parseInt(req.params.id));
        return res.json(versions);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Versions GET error', error: e.message, requestId: req.requestId });
        return res.status(500).json({ error: 'Failed to fetch versions' });
    }
}));
// GET /api/pages/:id/versions/:versionId
router.get('/:id/versions/:versionId', middleware_1.authMiddleware, (async (req, res, next) => {
    try {
        const version = await pagesService.getVersion(parseInt(req.params.versionId));
        if (!version)
            return res.status(404).json({ error: 'Version not found' });
        return res.json(version);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Version GET error', error: e.message, requestId: req.requestId });
        return res.status(500).json({ error: 'Failed to fetch version' });
    }
}));
// POST /api/pages/:id/rollback
router.post('/:id/rollback', middleware_1.authMiddleware, (0, middleware_1.validate)(schemas_1.rollbackVersionSchema), (async (req, res, next) => {
    try {
        const { versionId } = req.body;
        const result = await pagesService.rollbackToVersion(versionId, req.user.id);
        if ('error' in result) {
            return res.status(result.status ?? 500).json({ error: result.error });
        }
        return res.json(result);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Rollback error', error: e.message, requestId: req.requestId });
        return res.status(500).json({ error: 'Failed to rollback page' });
    }
}));
// GET /api/pages/:id/children
router.get('/:id/children', middleware_1.authMiddleware, (async (req, res, next) => {
    try {
        const children = await pagesService.getChildren(parseInt(req.params.id));
        return res.json(children);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Children GET error', error: e.message, requestId: req.requestId });
        return res.status(500).json({ error: 'Failed to fetch children' });
    }
}));
// GET /api/pages/tree/:spaceId — get full page tree for a space
router.get('/tree/:spaceId', middleware_1.authMiddleware, (async (req, res, next) => {
    try {
        const spaceId = parseInt(req.params.spaceId);
        const rootPages = await pagesService.getRootPages(spaceId);
        // Recursively build tree
        const buildTree = async (pages) => {
            return Promise.all(pages.map(async (page) => {
                const children = await pagesService.getChildren(page.id);
                const subtree = children.length > 0 ? await buildTree(children) : [];
                return { ...page, children: subtree };
            }));
        };
        const tree = await buildTree(rootPages);
        return res.json(tree);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Page tree GET error', error: e.message, requestId: req.requestId });
        return res.status(500).json({ error: 'Failed to fetch page tree' });
    }
}));
// POST /api/pages/:id/restore — restore a soft-deleted page
router.post('/:id/restore', middleware_1.authMiddleware, (async (req, res, next) => {
    try {
        const result = await pagesService.restorePage(parseInt(req.params.id));
        if ('error' in result) {
            return res.status(result.status ?? 500).json({ error: result.error });
        }
        return res.json(result);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Restore error', error: e.message, requestId: req.requestId });
        return res.status(500).json({ error: 'Failed to restore page' });
    }
}));
// POST /api/pages/:id/comments
router.post('/:id/comments', middleware_1.authMiddleware, (0, middleware_1.validate)(schemas_1.createCommentSchema), (async (req, res, next) => {
    try {
        const pageId = parseInt(req.params.id);
        const { text } = req.body;
        const comment = await commentsRepo.create({ pageId, userId: req.user.id, text });
        return res.status(201).json(comment);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Comment create error', error: e.message, requestId: req.requestId });
        return res.status(500).json({ error: 'Failed to create comment' });
    }
}));
// GET /api/pages/:id/comments
router.get('/:id/comments', middleware_1.authMiddleware, (async (req, res, next) => {
    try {
        const comments = await commentsRepo.findByPageId(parseInt(req.params.id));
        return res.json(comments);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Comments GET error', error: e.message, requestId: req.requestId });
        return res.status(500).json({ error: 'Failed to fetch comments' });
    }
}));
// PUT /api/pages/:id/comments/:commentId
router.put('/:id/comments/:commentId', middleware_1.authMiddleware, (0, middleware_1.validate)(schemas_1.updateCommentSchema), (async (req, res, next) => {
    try {
        const comment = await commentsRepo.update(parseInt(req.params.commentId), {
            text: req.body.text,
            userId: req.user.id,
        });
        if (!comment)
            return res.status(404).json({ error: 'Comment not found' });
        return res.json(comment);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Comment update error', error: e.message, requestId: req.requestId });
        return res.status(500).json({ error: 'Failed to update comment' });
    }
}));
// DELETE /api/pages/:id/comments/:commentId
router.delete('/:id/comments/:commentId', middleware_1.authMiddleware, (async (req, res, next) => {
    try {
        const deleted = await commentsRepo.delete(parseInt(req.params.commentId), req.user.id);
        if (!deleted)
            return res.status(404).json({ error: 'Comment not found' });
        return res.json({ deleted: true });
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Comment delete error', error: e.message, requestId: req.requestId });
        return res.status(500).json({ error: 'Failed to delete comment' });
    }
}));
// GET /api/pages/:id/attachments
router.get('/:id/attachments', middleware_1.authMiddleware, (async (req, res, next) => {
    try {
        const attachments = await pagesService.getAttachments(parseInt(req.params.id));
        return res.json(attachments);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Attachments GET error', error: e.message, requestId: req.requestId });
        return res.status(500).json({ error: 'Failed to fetch attachments' });
    }
}));
// POST /api/pages/:id/attachments — multipart file upload
router.post('/:id/attachments', middleware_1.authMiddleware, upload.single('file'), (async (req, res, next) => {
    try {
        const pageId = parseInt(req.params.id);
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
            uploadedBy: req.user.id,
        });
        return res.status(201).json(attachment);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Attachment POST error', error: e.message, requestId: req.requestId });
        return res.status(500).json({ error: 'Failed to add attachment' });
    }
}));
// DELETE /api/pages/:id/attachments/:attachmentId
router.delete('/:id/attachments/:attachmentId', middleware_1.authMiddleware, (async (req, res, next) => {
    try {
        const deleted = await pagesService.deleteAttachment(parseInt(req.params.attachmentId));
        if (!deleted)
            return res.status(404).json({ error: 'Attachment not found' });
        return res.json({ deleted: true });
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Attachment DELETE error', error: e.message, requestId: req.requestId });
        return res.status(500).json({ error: 'Failed to delete attachment' });
    }
}));
exports.default = router;
//# sourceMappingURL=pages.js.map
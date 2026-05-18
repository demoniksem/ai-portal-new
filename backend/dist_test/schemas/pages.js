"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rollbackVersionSchema = exports.updateCommentSchema = exports.createCommentSchema = exports.updatePageSchema = exports.createPageSchema = void 0;
const zod_1 = require("zod");
exports.createPageSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required').max(500),
    content: zod_1.z.any().optional(),
    spaceId: zod_1.z.number().int().positive('spaceId must be a positive integer'),
    parentId: zod_1.z.number().int().positive().nullable().optional(),
    acl: zod_1.z.any().optional(),
});
exports.updatePageSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(500).optional(),
    content: zod_1.z.any().optional(),
    parentId: zod_1.z.number().int().positive().nullable().optional(),
    acl: zod_1.z.any().optional(),
});
exports.createCommentSchema = zod_1.z.object({
    text: zod_1.z.string().min(1, 'Comment text is required').max(10000),
});
exports.updateCommentSchema = zod_1.z.object({
    text: zod_1.z.string().min(1, 'Comment text is required').max(10000),
});
exports.rollbackVersionSchema = zod_1.z.object({
    versionId: zod_1.z.number().int().positive('versionId must be a positive integer'),
});
//# sourceMappingURL=pages.js.map
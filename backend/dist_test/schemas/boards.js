"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateBoardMemberRoleSchema = exports.addBoardMemberSchema = exports.createCardFromTemplateSchema = exports.createCardTemplateSchema = exports.createCardRelationSchema = exports.addReactionSchema = exports.updateCardCommentSchema = exports.createCardCommentSchema = exports.updateChecklistItemSchema = exports.createChecklistItemSchema = exports.updateChecklistSchema = exports.createChecklistSchema = exports.setCardCustomFieldsSchema = exports.updateCustomFieldSchema = exports.createCustomFieldSchema = exports.setCardAssigneesSchema = exports.setCardLabelsSchema = exports.createLabelSchema = exports.moveCardSchema = exports.updateCardSchema = exports.createCardSchema = exports.updateSwimlaneSchema = exports.createSwimlaneSchema = exports.reorderColumnSchema = exports.updateColumnSchema = exports.createColumnSchema = exports.updateBoardSchema = exports.createBoardSchema = void 0;
const zod_1 = require("zod");
// Boards
exports.createBoardSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(255),
    description: zod_1.z.string().max(2000).optional(),
    spaceId: zod_1.z.string().uuid('spaceId must be a UUID').optional(),
    departmentId: zod_1.z.string().uuid('departmentId must be a UUID').optional(),
});
exports.updateBoardSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
    description: zod_1.z.string().max(2000).optional(),
});
// Columns
exports.createColumnSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(255),
    position: zod_1.z.number().int().min(0).optional(),
    wipLimit: zod_1.z.number().int().min(0).optional().nullable(),
});
exports.updateColumnSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
    wipLimit: zod_1.z.number().int().min(0).optional().nullable(),
});
exports.reorderColumnSchema = zod_1.z.object({
    position: zod_1.z.number().int().min(0),
});
// Swimlanes
exports.createSwimlaneSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(255),
    position: zod_1.z.number().int().min(0).optional(),
});
exports.updateSwimlaneSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
});
// Cards
exports.createCardSchema = zod_1.z.object({
    boardId: zod_1.z.string().uuid('boardId must be a UUID'),
    columnId: zod_1.z.string().uuid('columnId must be a UUID'),
    swimlaneId: zod_1.z.string().uuid('swimlaneId must be a UUID').optional().nullable(),
    type: zod_1.z.enum(['task', 'bug', 'story', 'epic']).optional().default('task'),
    title: zod_1.z.string().min(1, 'Title is required').max(500),
    description: zod_1.z.string().max(10000).optional(),
    priority: zod_1.z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
    position: zod_1.z.number().int().min(0).optional(),
    startDate: zod_1.z.string().optional().nullable(),
    deadline: zod_1.z.string().optional().nullable(),
    estimate: zod_1.z.number().min(0).optional().nullable(),
    color: zod_1.z.string().max(20).optional().nullable(),
    coverImage: zod_1.z.string().url().optional().nullable(),
});
exports.updateCardSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(500).optional(),
    description: zod_1.z.string().max(10000).optional().nullable(),
    type: zod_1.z.enum(['task', 'bug', 'story', 'epic']).optional(),
    priority: zod_1.z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    columnId: zod_1.z.string().uuid().optional(),
    swimlaneId: zod_1.z.string().uuid().optional().nullable(),
    position: zod_1.z.number().int().min(0).optional(),
    color: zod_1.z.string().max(20).optional().nullable(),
    coverImage: zod_1.z.string().url().optional().nullable(),
    archivedAt: zod_1.z.string().optional().nullable(), // null to unarchive
    startDate: zod_1.z.string().optional().nullable(),
    deadline: zod_1.z.string().optional().nullable(),
    estimate: zod_1.z.number().min(0).optional().nullable(),
    actual: zod_1.z.number().min(0).optional().nullable(),
});
exports.moveCardSchema = zod_1.z.object({
    columnId: zod_1.z.string().uuid('columnId must be a UUID'),
    position: zod_1.z.number().int().min(0),
    swimlaneId: zod_1.z.string().uuid().optional().nullable(),
});
// Labels
exports.createLabelSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(100),
    color: zod_1.z.string().max(20).optional().default('#6b7280'),
});
exports.setCardLabelsSchema = zod_1.z.object({
    labelIds: zod_1.z.array(zod_1.z.string().uuid()),
});
// Assignees
exports.setCardAssigneesSchema = zod_1.z.object({
    userIds: zod_1.z.array(zod_1.z.string().uuid()),
});
// Custom Fields
exports.createCustomFieldSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(100),
    fieldType: zod_1.z.enum(['text', 'number', 'date', 'select', 'checkbox']).optional().default('text'),
    options: zod_1.z.array(zod_1.z.object({ value: zod_1.z.string(), label: zod_1.z.string() })).optional(),
    position: zod_1.z.number().int().min(0).optional(),
});
exports.updateCustomFieldSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).optional(),
    fieldType: zod_1.z.enum(['text', 'number', 'date', 'select', 'checkbox']).optional(),
    options: zod_1.z.array(zod_1.z.object({ value: zod_1.z.string(), label: zod_1.z.string() })).optional(),
    position: zod_1.z.number().int().min(0).optional(),
});
exports.setCardCustomFieldsSchema = zod_1.z.object({
    fields: zod_1.z.record(zod_1.z.any()),
});
// Checklists
exports.createChecklistSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(255).optional().default('Checklist'),
    position: zod_1.z.number().int().min(0).optional(),
});
exports.updateChecklistSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(255).optional(),
    position: zod_1.z.number().int().min(0).optional(),
});
exports.createChecklistItemSchema = zod_1.z.object({
    text: zod_1.z.string().min(1, 'Text is required').max(1000),
    position: zod_1.z.number().int().min(0).optional(),
});
exports.updateChecklistItemSchema = zod_1.z.object({
    text: zod_1.z.string().min(1).max(1000).optional(),
    checked: zod_1.z.boolean().optional(),
    position: zod_1.z.number().int().min(0).optional(),
});
// Comments
exports.createCardCommentSchema = zod_1.z.object({
    content: zod_1.z.string().min(1, 'Content is required').max(10000),
    mentions: zod_1.z.array(zod_1.z.object({
        userId: zod_1.z.string(),
        offset: zod_1.z.number(),
        length: zod_1.z.number(),
    })).optional().default([]),
});
exports.updateCardCommentSchema = zod_1.z.object({
    content: zod_1.z.string().min(1).max(10000),
});
// Reactions
exports.addReactionSchema = zod_1.z.object({
    emoji: zod_1.z.string().min(1).max(50).default('👍'),
});
// Card Relations
exports.createCardRelationSchema = zod_1.z.object({
    targetCardId: zod_1.z.string().uuid('targetCardId must be a UUID'),
    relationType: zod_1.z.enum(['blocks', 'blocked_by', 'duplicates', 'relates_to', 'parent', 'child']),
});
// Templates
exports.createCardTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(255),
    description: zod_1.z.string().max(2000).optional().nullable(),
    type: zod_1.z.enum(['task', 'bug', 'story', 'epic']).optional().default('task'),
    titleTemplate: zod_1.z.string().max(500).optional().nullable(),
    descriptionTemplate: zod_1.z.string().max(10000).optional().nullable(),
    fields: zod_1.z.record(zod_1.z.any()).optional().default({}),
});
exports.createCardFromTemplateSchema = zod_1.z.object({
    columnId: zod_1.z.string().uuid('columnId must be a UUID'),
    title: zod_1.z.string().min(1).max(500).optional(),
    fields: zod_1.z.record(zod_1.z.any()).optional().default({}),
});
// Board Membership
exports.addBoardMemberSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid('userId must be a UUID'),
    role: zod_1.z.enum(['owner', 'editor', 'viewer']).default('editor'),
});
exports.updateBoardMemberRoleSchema = zod_1.z.object({
    role: zod_1.z.enum(['owner', 'editor', 'viewer']),
});
//# sourceMappingURL=boards.js.map
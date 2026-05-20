import { z } from 'zod';

// Boards
export const createBoardSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).optional(),
  spaceId: z.number().int().positive(),
  departmentId: z.string().uuid('departmentId must be a UUID').optional(),
});

export const updateBoardSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
});

// Columns
export const createColumnSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  position: z.number().int().min(0).optional(),
  wipLimit: z.number().int().min(0).optional().nullable(),
});

export const updateColumnSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  wipLimit: z.number().int().min(0).optional().nullable(),
});

export const reorderColumnSchema = z.object({
  position: z.number().int().min(0),
});

// Swimlanes
export const createSwimlaneSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  position: z.number().int().min(0).optional(),
});

export const updateSwimlaneSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

// Cards
export const createCardSchema = z.object({
  boardId: z.string().uuid('boardId must be a UUID'),
  columnId: z.string().uuid('columnId must be a UUID'),
  swimlaneId: z.string().uuid('swimlaneId must be a UUID').optional().nullable(),
  type: z.enum(['task', 'bug', 'story', 'epic']).optional().default('task'),
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(10000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  position: z.number().int().min(0).optional(),
  startDate: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
  estimate: z.number().min(0).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  coverImage: z.string().url().optional().nullable(),
});

export const updateCardSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional().nullable(),
  type: z.enum(['task', 'bug', 'story', 'epic']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  columnId: z.string().uuid().optional(),
  swimlaneId: z.string().uuid().optional().nullable(),
  position: z.number().int().min(0).optional(),
  color: z.string().max(20).optional().nullable(),
  coverImage: z.string().url().optional().nullable(),
  archivedAt: z.string().optional().nullable(), // null to unarchive
  startDate: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
  estimate: z.number().min(0).optional().nullable(),
  actual: z.number().min(0).optional().nullable(),
});

export const moveCardSchema = z.object({
  columnId: z.string().uuid('columnId must be a UUID'),
  position: z.number().int().min(0),
  swimlaneId: z.string().uuid().optional().nullable(),
});

// Labels
export const createLabelSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  color: z.string().max(20).optional().default('#6b7280'),
});

export const setCardLabelsSchema = z.object({
  labelIds: z.array(z.string().uuid()),
});

// Assignees
export const setCardAssigneesSchema = z.object({
  userIds: z.array(z.string().uuid()),
});

// Custom Fields
export const createCustomFieldSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  fieldType: z.enum(['text', 'number', 'date', 'select', 'checkbox']).optional().default('text'),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  position: z.number().int().min(0).optional(),
});

export const updateCustomFieldSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  fieldType: z.enum(['text', 'number', 'date', 'select', 'checkbox']).optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  position: z.number().int().min(0).optional(),
});

export const setCardCustomFieldsSchema = z.object({
  fields: z.record(z.any()),
});

// Checklists
export const createChecklistSchema = z.object({
  title: z.string().min(1).max(255).optional().default('Checklist'),
  position: z.number().int().min(0).optional(),
});

export const updateChecklistSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  position: z.number().int().min(0).optional(),
});

export const createChecklistItemSchema = z.object({
  text: z.string().min(1, 'Text is required').max(1000),
  position: z.number().int().min(0).optional(),
});

export const updateChecklistItemSchema = z.object({
  text: z.string().min(1).max(1000).optional(),
  checked: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

// Comments
export const createCardCommentSchema = z.object({
  content: z.string().min(1, 'Content is required').max(10000),
  mentions: z.array(z.object({
    userId: z.string(),
    offset: z.number(),
    length: z.number(),
  })).optional().default([]),
});

export const updateCardCommentSchema = z.object({
  content: z.string().min(1).max(10000),
});

// Reactions
export const addReactionSchema = z.object({
  emoji: z.string().min(1).max(50).default('👍'),
});

// Card Relations
export const createCardRelationSchema = z.object({
  targetCardId: z.string().uuid('targetCardId must be a UUID'),
  relationType: z.enum(['blocks', 'blocked_by', 'duplicates', 'relates_to', 'parent', 'child']),
});

// Templates
export const createCardTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).optional().nullable(),
  type: z.enum(['task', 'bug', 'story', 'epic']).optional().default('task'),
  titleTemplate: z.string().max(500).optional().nullable(),
  descriptionTemplate: z.string().max(10000).optional().nullable(),
  fields: z.record(z.any()).optional().default({}),
});

export const createCardFromTemplateSchema = z.object({
  columnId: z.string().uuid('columnId must be a UUID'),
  title: z.string().min(1).max(500).optional(),
  fields: z.record(z.any()).optional().default({}),
});

// Board Membership
export const addBoardMemberSchema = z.object({
  userId: z.string().uuid('userId must be a UUID'),
  role: z.enum(['owner', 'editor', 'viewer']).default('editor'),
});

export const updateBoardMemberRoleSchema = z.object({
  role: z.enum(['owner', 'editor', 'viewer']),
});

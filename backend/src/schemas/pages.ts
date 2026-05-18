import { z } from 'zod';

export const createPageSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  content: z.any().optional(),
  spaceId: z.number().int().positive('spaceId must be a positive integer'),
  parentId: z.number().int().positive().nullable().optional(),
  acl: z.any().optional(),
});

export const updatePageSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.any().optional(),
  parentId: z.number().int().positive().nullable().optional(),
  acl: z.any().optional(),
});

export const createCommentSchema = z.object({
  text: z.string().min(1, 'Comment text is required').max(10000),
});

export const updateCommentSchema = z.object({
  text: z.string().min(1, 'Comment text is required').max(10000),
});

export const rollbackVersionSchema = z.object({
  versionId: z.number().int().positive('versionId must be a positive integer'),
});

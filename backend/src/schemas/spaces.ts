import { z } from 'zod';

export const createSpaceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
});

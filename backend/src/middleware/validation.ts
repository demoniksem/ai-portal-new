import { z, ZodError, ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

const querySchemas = {
  search: z.object({
    q: z.string().min(1, 'Search query is required').max(500),
    spaceId: z.string().optional(),
    limit: z.string().regex(/^\d+$/).optional().transform(v => v ? parseInt(v, 10) : 20),
    offset: z.string().regex(/^\d+$/).optional().transform(v => v ? parseInt(v, 10) : 0),
    highlight: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
  }),
  autocomplete: z.object({
    q: z.string().min(1, 'Query is required').max(200),
    limit: z.string().regex(/^\d+$/).optional().transform(v => v ? parseInt(v, 10) : 5),
  }),
  githubIssues: z.object({
    repo: z.string().min(1, 'repo parameter required (e.g., owner/repo)').max(200),
    state: z.enum(['open', 'closed', 'all']).default('open'),
    labels: z.string().max(200).optional(),
    sort: z.enum(['created', 'updated', 'comments']).default('created'),
  }),
};

function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.query);
      req.query = parsed as typeof req.query;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
        });
        return;
      }
      next(err);
    }
  };
}

const schemas = {
  register: z.object({
    email: z.string().email('Invalid email format').max(255),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    username: z.string().max(100).optional(),
  }),
  login: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),
  createSpace: z.object({
    name: z.string().min(1, 'Name is required').max(255),
    slug: z.string().min(1, 'Slug is required').max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  }),
  createPage: z.object({
    title: z.string().min(1, 'Title is required').max(500),
    content: z.any().optional(),
    spaceId: z.number().int().positive('spaceId must be a positive integer'),
    acl: z.any().optional(),
  }),
  updatePage: z.object({
    title: z.string().min(1).max(500).optional(),
    content: z.any().optional(),
    acl: z.any().optional(),
  }),
  aiBuild: z.object({
    prompt: z.string().min(1, 'Prompt is required').max(5000, 'Prompt too long (max 5000 characters)'),
  }),
  createComment: z.object({
    text: z.string().min(1, 'Comment text is required').max(10000),
  }),
  createNotification: z.object({
    title: z.string().min(1).max(255),
    message: z.string().min(1).max(2000),
    userId: z.number().int().positive().optional(),
  }),
  jiraIntegration: z.object({
    jiraUrl: z.string().url('Invalid Jira URL').refine((val: string) => val.includes('atlassian.net'), 'Jira URL must be from atlassian.net'),
    jql: z.string().min(1, 'JQL is required').max(2000),
    maxResults: z.number().int().min(1).max(100).optional(),
  }),
  aiSettings: z.object({
    provider: z.enum(['openrouter', 'openai', 'anthropic', 'local']).default('openrouter'),
    apiKey: z.string().max(500).optional(),
    model: z.string().min(1, 'Model is required').max(255),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().int().min(100).max(32000).default(4000),
  }),
};

function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
        });
        return;
      }
      next(err);
    }
  };
}

export { schemas, validate, querySchemas, validateQuery };

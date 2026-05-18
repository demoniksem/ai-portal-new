import { z } from 'zod';

export const createOrUpdateAiConfigSchema = z.object({
  provider: z.enum(['openrouter', 'openai', 'anthropic', 'openclaw', 'local']).default('openrouter'),
  apiKey: z.string().optional(),
  model: z.string().min(1, 'Model is required').max(255),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(100000).default(4000),
  apiBaseUrl: z.string().url().max(500).optional().nullable(),
  enabled: z.boolean().default(true),
});

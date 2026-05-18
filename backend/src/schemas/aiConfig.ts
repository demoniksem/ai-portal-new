import { z } from 'zod';

export const companyAiConfigSchema = z.object({
  provider: z.enum(['openrouter', 'openai', 'anthropic', 'openclaw', 'local']).default('openrouter'),
  apiKey: z.string().optional(),
  model: z.string().min(1).max(255).default('qwen/qwen3.6-plus:free'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(100000).default(4000),
  apiBaseUrl: z.string().url().max(500).optional().nullable(),
  enabled: z.boolean().default(true),
});

export const updateCompanyAiConfigSchema = companyAiConfigSchema.partial();

export type CompanyAiConfigInput = z.infer<typeof companyAiConfigSchema>;
export type UpdateCompanyAiConfigInput = z.infer<typeof updateCompanyAiConfigSchema>;

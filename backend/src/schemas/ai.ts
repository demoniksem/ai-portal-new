import { z } from 'zod';

export const aiBuildSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(5000, 'Prompt too long (max 5000 characters)'),
});

export const aiSettingsSchema = z.object({
  provider: z.enum(['openrouter', 'openai', 'anthropic', 'openclaw', 'local']).default('openrouter'),
  apiKey: z.string().max(500).optional(),
  model: z.string().min(1, 'Model is required').max(255),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(100).max(32000).default(4000),
});

export const createNotificationSchema = z.object({
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(2000),
  userId: z.number().int().positive().optional(),
});

export const jiraIntegrationSchema = z.object({
  jiraUrl: z.string().url('Invalid Jira URL').includes('atlassian.net', { message: 'Jira URL must be from atlassian.net' }),
  jql: z.string().min(1, 'JQL is required').max(2000),
  maxResults: z.number().int().min(1).max(100).optional(),
});

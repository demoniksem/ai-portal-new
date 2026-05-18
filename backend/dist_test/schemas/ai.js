"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jiraIntegrationSchema = exports.createNotificationSchema = exports.aiSettingsSchema = exports.aiBuildSchema = void 0;
const zod_1 = require("zod");
exports.aiBuildSchema = zod_1.z.object({
    prompt: zod_1.z.string().min(1, 'Prompt is required').max(5000, 'Prompt too long (max 5000 characters)'),
});
exports.aiSettingsSchema = zod_1.z.object({
    provider: zod_1.z.enum(['openrouter', 'openai', 'anthropic', 'openclaw', 'local']).default('openrouter'),
    apiKey: zod_1.z.string().max(500).optional(),
    model: zod_1.z.string().min(1, 'Model is required').max(255),
    temperature: zod_1.z.number().min(0).max(2).default(0.7),
    maxTokens: zod_1.z.number().int().min(100).max(32000).default(4000),
});
exports.createNotificationSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(255),
    message: zod_1.z.string().min(1).max(2000),
    userId: zod_1.z.number().int().positive().optional(),
});
exports.jiraIntegrationSchema = zod_1.z.object({
    jiraUrl: zod_1.z.string().url('Invalid Jira URL').includes('atlassian.net', { message: 'Jira URL must be from atlassian.net' }),
    jql: zod_1.z.string().min(1, 'JQL is required').max(2000),
    maxResults: zod_1.z.number().int().min(1).max(100).optional(),
});
//# sourceMappingURL=ai.js.map
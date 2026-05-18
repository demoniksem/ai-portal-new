"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCompanyAiConfigSchema = exports.companyAiConfigSchema = void 0;
const zod_1 = require("zod");
exports.companyAiConfigSchema = zod_1.z.object({
    provider: zod_1.z.enum(['openrouter', 'openai', 'anthropic', 'openclaw', 'local']).default('openrouter'),
    apiKey: zod_1.z.string().optional(),
    model: zod_1.z.string().min(1).max(255).default('qwen/qwen3.6-plus:free'),
    temperature: zod_1.z.number().min(0).max(2).default(0.7),
    maxTokens: zod_1.z.number().int().min(1).max(100000).default(4000),
    apiBaseUrl: zod_1.z.string().url().max(500).optional().nullable(),
    enabled: zod_1.z.boolean().default(true),
});
exports.updateCompanyAiConfigSchema = exports.companyAiConfigSchema.partial();
//# sourceMappingURL=aiConfig.js.map
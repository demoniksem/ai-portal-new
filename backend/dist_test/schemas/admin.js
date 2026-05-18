"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrUpdateAiConfigSchema = void 0;
const zod_1 = require("zod");
exports.createOrUpdateAiConfigSchema = zod_1.z.object({
    provider: zod_1.z.enum(['openrouter', 'openai', 'anthropic', 'openclaw', 'local']).default('openrouter'),
    apiKey: zod_1.z.string().optional(),
    model: zod_1.z.string().min(1, 'Model is required').max(255),
    temperature: zod_1.z.number().min(0).max(2).default(0.7),
    maxTokens: zod_1.z.number().int().min(1).max(100000).default(4000),
    apiBaseUrl: zod_1.z.string().url().max(500).optional().nullable(),
    enabled: zod_1.z.boolean().default(true),
});
//# sourceMappingURL=admin.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.querySchemas = exports.schemas = void 0;
exports.validate = validate;
exports.validateQuery = validateQuery;
const zod_1 = require("zod");
const querySchemas = {
    search: zod_1.z.object({
        q: zod_1.z.string().min(1, 'Search query is required').max(500),
        spaceId: zod_1.z.string().optional(),
        limit: zod_1.z.string().regex(/^\d+$/).optional().transform(v => v ? parseInt(v, 10) : 20),
        offset: zod_1.z.string().regex(/^\d+$/).optional().transform(v => v ? parseInt(v, 10) : 0),
        highlight: zod_1.z.enum(['true', 'false']).optional().transform(v => v === 'true'),
    }),
    autocomplete: zod_1.z.object({
        q: zod_1.z.string().min(1, 'Query is required').max(200),
        limit: zod_1.z.string().regex(/^\d+$/).optional().transform(v => v ? parseInt(v, 10) : 5),
    }),
    githubIssues: zod_1.z.object({
        repo: zod_1.z.string().min(1, 'repo parameter required (e.g., owner/repo)').max(200),
        state: zod_1.z.enum(['open', 'closed', 'all']).default('open'),
        labels: zod_1.z.string().max(200).optional(),
        sort: zod_1.z.enum(['created', 'updated', 'comments']).default('created'),
    }),
};
exports.querySchemas = querySchemas;
function validateQuery(schema) {
    return (req, res, next) => {
        try {
            const parsed = schema.parse(req.query);
            req.query = parsed;
            next();
        }
        catch (err) {
            if (err instanceof zod_1.ZodError) {
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
    register: zod_1.z.object({
        email: zod_1.z.string().email('Invalid email format').max(255),
        password: zod_1.z.string().min(8, 'Password must be at least 8 characters').max(128),
        username: zod_1.z.string().max(100).optional(),
    }),
    login: zod_1.z.object({
        email: zod_1.z.string().email('Invalid email format'),
        password: zod_1.z.string().min(1, 'Password is required'),
    }),
    createSpace: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Name is required').max(255),
        slug: zod_1.z.string().min(1, 'Slug is required').max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
    }),
    createPage: zod_1.z.object({
        title: zod_1.z.string().min(1, 'Title is required').max(500),
        content: zod_1.z.any().optional(),
        spaceId: zod_1.z.number().int().positive('spaceId must be a positive integer'),
        acl: zod_1.z.any().optional(),
    }),
    updatePage: zod_1.z.object({
        title: zod_1.z.string().min(1).max(500).optional(),
        content: zod_1.z.any().optional(),
        acl: zod_1.z.any().optional(),
    }),
    aiBuild: zod_1.z.object({
        prompt: zod_1.z.string().min(1, 'Prompt is required').max(5000, 'Prompt too long (max 5000 characters)'),
    }),
    createComment: zod_1.z.object({
        text: zod_1.z.string().min(1, 'Comment text is required').max(10000),
    }),
    createNotification: zod_1.z.object({
        title: zod_1.z.string().min(1).max(255),
        message: zod_1.z.string().min(1).max(2000),
        userId: zod_1.z.number().int().positive().optional(),
    }),
    jiraIntegration: zod_1.z.object({
        jiraUrl: zod_1.z.string().url('Invalid Jira URL').refine((val) => val.includes('atlassian.net'), 'Jira URL must be from atlassian.net'),
        jql: zod_1.z.string().min(1, 'JQL is required').max(2000),
        maxResults: zod_1.z.number().int().min(1).max(100).optional(),
    }),
    aiSettings: zod_1.z.object({
        provider: zod_1.z.enum(['openrouter', 'openai', 'anthropic', 'local']).default('openrouter'),
        apiKey: zod_1.z.string().max(500).optional(),
        model: zod_1.z.string().min(1, 'Model is required').max(255),
        temperature: zod_1.z.number().min(0).max(2).default(0.7),
        maxTokens: zod_1.z.number().int().min(100).max(32000).default(4000),
    }),
};
exports.schemas = schemas;
function validate(schema) {
    return (req, res, next) => {
        try {
            schema.parse(req.body);
            next();
        }
        catch (err) {
            if (err instanceof zod_1.ZodError) {
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
//# sourceMappingURL=validation.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSpaceSchema = void 0;
const zod_1 = require("zod");
exports.createSpaceSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(255),
    slug: zod_1.z.string().min(1, 'Slug is required').max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
});
//# sourceMappingURL=spaces.js.map
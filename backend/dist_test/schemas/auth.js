"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
exports.registerSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format').max(255),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters').max(128),
    username: zod_1.z.string().max(100).optional(),
    fullName: zod_1.z.string().max(255).optional(),
    companyId: zod_1.z.string().uuid('Invalid company ID format'),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
    password: zod_1.z.string().min(1, 'Password is required'),
    companyId: zod_1.z.string().uuid('Invalid company ID format'),
});
//# sourceMappingURL=auth.js.map
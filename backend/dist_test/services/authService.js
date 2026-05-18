"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
exports.buildToken = buildToken;
exports.verifyToken = verifyToken;
const bcryptjs_1 = require("bcryptjs");
const jsonwebtoken_1 = require("jsonwebtoken");
const config_1 = require("../config");
const users_1 = require("../repositories/users");
const auditService_1 = require("./auditService");
const usersRepo = new users_1.RbacUsersRepository();
const auditService = new auditService_1.AuditService();
// ─── JWT helpers ─────────────────────────────────────────────────────────────
function buildToken(userId, email, companyId, companyRole) {
    const opts = { expiresIn: config_1.JWT_EXPIRY };
    return (0, jsonwebtoken_1.sign)({ userId, email, companyId, companyRole }, config_1.JWT_SECRET, opts);
}
function verifyToken(token) {
    try {
        return (0, jsonwebtoken_1.verify)(token, config_1.JWT_SECRET);
    }
    catch {
        return null;
    }
}
// ─── AuthService ─────────────────────────────────────────────────────────────
class AuthService {
    /**
     * Register a new user in a company.
     * Default role: 'employee'.
     */
    async register(data) {
        const existing = await usersRepo.findByEmail(data.email, data.companyId);
        if (existing) {
            return { error: 'User already exists', status: 409 };
        }
        const passwordHash = await (0, bcryptjs_1.hash)(data.password, 12);
        const user = await usersRepo.create({
            email: data.email,
            passwordHash,
            companyId: data.companyId,
            fullName: data.fullName,
            username: data.username,
        });
        // Build token for immediate login
        const token = buildToken(user.id, user.email, user.company_id, 'employee');
        await auditService.logUserRegister(user.company_id, user.id, { id: user.id, email: user.email });
        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username ?? user.email.split('@')[0],
                companyId: user.company_id,
                companyRole: 'employee',
                departmentRoles: [],
                objectRoles: [],
            },
        };
    }
    /**
     * Authenticate with email + password.
     * Returns JWT in httpOnly cookie-style token (for API: just the token string).
     */
    async login(data) {
        const user = await usersRepo.findByEmail(data.email, data.companyId);
        if (!user) {
            return { error: 'Invalid credentials', status: 401 };
        }
        const isValid = await (0, bcryptjs_1.compare)(data.password, user.password_hash);
        if (!isValid) {
            return { error: 'Invalid credentials', status: 401 };
        }
        // Get full profile for roles
        const profile = await usersRepo.getFullProfile(user.id);
        const token = buildToken(user.id, user.email, user.company_id, profile?.companyRole ?? 'guest');
        await auditService.logUserLogin(user.company_id, user.id);
        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username ?? user.email.split('@')[0],
                companyId: user.company_id,
                companyRole: profile?.companyRole ?? 'guest',
                departmentRoles: (profile?.departmentRoles ?? []).map(r => ({
                    departmentId: r.department_id,
                    role: r.role,
                })),
                objectRoles: (profile?.objectRoles ?? []).map(r => ({
                    objectType: r.object_type,
                    objectId: r.object_id,
                    role: r.role,
                })),
            },
        };
    }
    /**
     * Return the currently authenticated user profile from a JWT.
     */
    async me(token) {
        const payload = verifyToken(token);
        if (!payload)
            return null;
        const profile = await usersRepo.getFullProfile(payload.userId);
        if (!profile)
            return null;
        return {
            id: profile.id,
            email: profile.email,
            username: profile.fullName ?? profile.username ?? profile.email.split('@')[0],
            companyId: profile.companyId,
            companyRole: profile.companyRole,
            departmentRoles: profile.departmentRoles.map(r => ({
                departmentId: r.department_id,
                role: r.role,
            })),
            objectRoles: profile.objectRoles.map(r => ({
                objectType: r.object_type,
                objectId: r.object_id,
                role: r.role,
            })),
        };
    }
    /**
     * Verify and decode a JWT token, returning the full authenticated user.
     */
    async verifyToken(token) {
        return this.me(token);
    }
    /**
     * Decode token without DB call (for middleware speed).
     * Use this when you only need the JWT payload, not full profile.
     */
    decodeToken(token) {
        return verifyToken(token);
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=authService.js.map
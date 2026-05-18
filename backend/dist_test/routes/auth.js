"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const logger_1 = require("../config/logger");
const authService_1 = require("../services/authService");
const middleware_1 = require("../middleware");
const schemas_1 = require("../schemas");
const validation_1 = require("../middleware/validation");
const rbac_1 = require("../middleware/rbac");
const router = (0, express_1.Router)();
const authService = new authService_1.AuthService();
// ─── Public routes ─────────────────────────────────────────────────────────────
// POST /api/auth/register
router.post('/register', middleware_1.authLimiter, (0, validation_1.validate)(schemas_1.registerSchema), async (req, res) => {
    try {
        const { email, password, companyId, fullName, username } = req.body;
        if (!companyId) {
            return res.status(400).json({ error: 'companyId is required' });
        }
        const result = await authService.register({ email, password, companyId, fullName, username });
        if ('error' in result) {
            return res.status(result.status ?? 400).json({ error: result.error });
        }
        // Set httpOnly cookie with JWT
        res.cookie('token', result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000, // 24h
        });
        return res.status(201).json({ token: result.token, user: result.user });
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Register error', error: e.message, requestId: req.requestId });
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/auth/login
router.post('/login', middleware_1.authLimiter, (0, validation_1.validate)(schemas_1.loginSchema), async (req, res) => {
    try {
        const { email, password, companyId } = req.body;
        if (!companyId) {
            return res.status(400).json({ error: 'companyId is required' });
        }
        const result = await authService.login({ email, password, companyId });
        if ('error' in result) {
            return res.status(result.status ?? 400).json({ error: result.error });
        }
        // Set httpOnly cookie with JWT
        res.cookie('token', result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000,
        });
        return res.json({ token: result.token, user: result.user });
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Login error', error: e.message, requestId: req.requestId });
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/auth/logout
router.post('/logout', async (req, res) => {
    // Clear the httpOnly cookie
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    });
    return res.json({ message: 'Logged out successfully' });
});
// GET /api/auth/me — returns current authenticated user
router.get('/me', rbac_1.authMiddleware, async (req, res) => {
    try {
        // req.user is already set by authMiddleware from JWT
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        const user = await authService.me(token);
        if (!user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        return res.json({ user });
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Me error', error: e.message, requestId: req.requestId });
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLoggerMiddleware = requestLoggerMiddleware;
const logger_1 = require("../config/logger");
function requestLoggerMiddleware(req, res, next) {
    const start = Date.now();
    const { method, url } = req;
    res.on('finish', () => {
        const duration = Date.now() - start;
        const { statusCode } = res;
        const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
        logger_1.logger[level]({
            msg: `${method} ${url}`,
            method,
            url,
            status: statusCode,
            duration,
            requestId: req.requestId,
            userAgent: req.headers['user-agent'],
        });
    });
    next();
}
//# sourceMappingURL=requestLogger.js.map
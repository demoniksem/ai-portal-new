"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const logger_1 = require("../config/logger");
const searchService_1 = require("../services/searchService");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const searchService = new searchService_1.SearchService();
const router = (0, express_1.Router)();
const searchHandler = async (req, res) => {
    try {
        const { q, spaceId, limit, offset, highlight } = req.query;
        if (!q)
            return res.status(400).json({ error: 'Search query required' });
        const result = await searchService.search({ query: q, spaceId, limit, offset, highlight });
        if ('error' in result)
            return res.status(result.status ?? 500).json({ error: result.error });
        return res.json(result);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Search error', error: e.message, stack: e.stack, requestId: req.requestId });
        return res.status(500).json({ error: 'Search failed' });
    }
};
const autocompleteHandler = async (req, res) => {
    try {
        const { q: query, limit } = req.query;
        if (!query)
            return res.status(400).json({ error: 'Query required' });
        const result = await searchService.autocomplete(query, limit ?? 5);
        return res.json(result);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Autocomplete error', error: e.message });
        return res.status(500).json({ error: 'Autocomplete failed' });
    }
};
router.get('/', auth_1.authMiddleware, (0, validation_1.validateQuery)(validation_1.querySchemas.search), searchHandler);
router.get('/autocomplete', auth_1.authMiddleware, (0, validation_1.validateQuery)(validation_1.querySchemas.autocomplete), autocompleteHandler);
exports.default = router;
//# sourceMappingURL=search.js.map
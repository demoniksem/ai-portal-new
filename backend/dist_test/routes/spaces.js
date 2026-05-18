"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const logger_1 = require("../config/logger");
const spacesService_1 = require("../services/spacesService");
const middleware_1 = require("../middleware");
const schemas_1 = require("../schemas");
const router = (0, express_1.Router)();
const spacesService = new spacesService_1.SpacesService();
// GET /api/spaces
const getSpacesHandler = async (req, res) => {
    try {
        const spaces = await spacesService.getAllSpaces();
        res.json(spaces);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Spaces GET error', error: e.message, requestId: req.requestId });
        res.status(500).json({ error: 'Failed to fetch spaces' });
    }
};
// POST /api/spaces
const createSpaceHandler = async (req, res) => {
    try {
        const { name, slug } = req.body;
        const userId = req.user.id;
        const result = await spacesService.createSpace({ name, slug }, userId);
        if ('error' in result) {
            res.status(result.status ?? 500).json({ error: result.error });
            return;
        }
        res.status(201).json(result.space);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Spaces POST error', error: e.message, requestId: req.requestId });
        res.status(500).json({ error: 'Failed to create space' });
    }
};
// GET /api/spaces/:id
const getSpaceHandler = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const space = await spacesService.getSpaceById(id);
        if (!space) {
            res.status(404).json({ error: 'Space not found' });
            return;
        }
        res.json(space);
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Space GET error', error: e.message, requestId: req.requestId });
        res.status(500).json({ error: 'Failed to fetch space' });
    }
};
// DELETE /api/spaces/:id
const deleteSpaceHandler = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const result = await spacesService.deleteSpace(id);
        if ('error' in result) {
            res.status(result.status ?? 500).json({ error: result.error });
            return;
        }
        res.json({ deleted: true });
    }
    catch (e) {
        logger_1.logger.error({ msg: 'Space DELETE error', error: e.message, requestId: req.requestId });
        res.status(500).json({ error: 'Failed to delete space' });
    }
};
router.get('/', middleware_1.authMiddleware, getSpacesHandler);
router.post('/', middleware_1.authMiddleware, (0, middleware_1.validate)(schemas_1.createSpaceSchema), createSpaceHandler);
router.get('/:id', middleware_1.authMiddleware, getSpaceHandler);
router.delete('/:id', middleware_1.authMiddleware, deleteSpaceHandler);
exports.default = router;
//# sourceMappingURL=spaces.js.map
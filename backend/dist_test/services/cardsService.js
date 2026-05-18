"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardsService = void 0;
const cards_1 = require("../repositories/cards");
const config_1 = require("../config");
const logger_1 = require("../config/logger");
class CardsService {
    constructor() {
        this.cardsRepo = new cards_1.CardsRepository();
    }
    async getCards(opts) {
        return this.cardsRepo.findAll(opts);
    }
    async getCardById(id) {
        return this.cardsRepo.findByIdWithRelations(id);
    }
    async createCard(data) {
        const card = await this.cardsRepo.create(data);
        await this.indexCard(card);
        return card;
    }
    async updateCard(id, data) {
        const card = await this.cardsRepo.update(id, data);
        if (card)
            await this.indexCard(card);
        return card;
    }
    async deleteCard(id) {
        const result = await this.cardsRepo.delete(id);
        if (result) {
            try {
                await config_1.meiliClient.index('cards').deleteDocument(id);
            }
            catch (e) {
                logger_1.logger.error({ msg: 'MeiliSearch card delete error', error: e.message });
            }
        }
        return result;
    }
    async indexCard(card) {
        try {
            await config_1.meiliClient.index('cards').addDocuments([{
                    id: card.id,
                    title: card.title,
                    description: card.description ?? '',
                    type: card.type,
                    priority: card.priority,
                    board_id: card.board_id,
                    column_id: card.column_id,
                    author_id: card.author_id,
                    created_at: card.created_at,
                }]);
        }
        catch (e) {
            logger_1.logger.error({ msg: 'MeiliSearch card index error', error: e.message });
        }
    }
}
exports.CardsService = CardsService;
//# sourceMappingURL=cardsService.js.map
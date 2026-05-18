import { CardsRepository } from '../repositories/cards';
import { meiliClient } from '../config';
import { logger } from '../config/logger';

export class CardsService {
  private cardsRepo: CardsRepository;

  constructor() {
    this.cardsRepo = new CardsRepository();
  }

  async getCards(opts?: { boardId?: string; columnId?: string }) {
    return this.cardsRepo.findAll(opts);
  }

  async getCardById(id: string) {
    return this.cardsRepo.findByIdWithRelations(id);
  }

  async createCard(data: {
    boardId: string; columnId: string; title: string; type?: string;
    description?: string; priority?: string; position?: number;
    authorId?: string; swimlaneId?: string;
  }) {
    const card = await this.cardsRepo.create(data);
    await this.indexCard(card);
    return card;
  }

  async updateCard(id: string, data: {
    title?: string; description?: string; type?: string; priority?: string;
    columnId?: string; swimlaneId?: string; position?: number; color?: string;
    coverImage?: string; archivedAt?: string | null; startDate?: string;
    deadline?: string; estimate?: number; actual?: number;
  }) {
    const card = await this.cardsRepo.update(id, data);
    if (card) await this.indexCard(card);
    return card;
  }

  async deleteCard(id: string) {
    const result = await this.cardsRepo.delete(id);
    if (result) {
      try {
        await meiliClient.index('cards').deleteDocument(id);
      } catch (e: any) {
        logger.error({ msg: 'MeiliSearch card delete error', error: e.message });
      }
    }
    return result;
  }

  private async indexCard(card: any) {
    try {
      await meiliClient.index('cards').addDocuments([{
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
    } catch (e: any) {
      logger.error({ msg: 'MeiliSearch card index error', error: e.message });
    }
  }
}

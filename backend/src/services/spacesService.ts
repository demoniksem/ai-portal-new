import { SpacesRepository, Space } from '../repositories/spaces';
import { pool } from '../config';

export interface SpaceDetail extends Space {
  page_count: number;
  active_page_count: number;
  recent_pages: { id: number; title: string; updated_at: string }[];
}

const spacesRepo = new SpacesRepository();

class SpacesService {
  async getAllSpaces(): Promise<Space[]> {
    return spacesRepo.findAll();
  }

  async createSpace(data: { name: string; slug: string }, userId: number): Promise<{ space?: Space; error?: string; status?: number }> {
    try {
      const space = await spacesRepo.create({ name: data.name, slug: data.slug, createdBy: userId });
      return { space };
    } catch (e: any) {
      if (e.code === '23505') {
        return { error: 'Space with this slug already exists', status: 409 };
      }
      throw e;
    }
  }

  async getSpaceById(id: number): Promise<SpaceDetail | null> {
    const space = await spacesRepo.findById(id);
    if (!space) return null;

    const [countResult, activeCountResult, recentResult] = await Promise.all([
      pool.query<{ count: string }>('SELECT COUNT(*) as count FROM pages WHERE space_id = $1', [id]),
      pool.query<{ count: string }>('SELECT COUNT(*) as count FROM pages WHERE space_id = $1 AND deleted_at IS NULL', [id]),
      pool.query<{ id: number; title: string; updated_at: Date }>(
        'SELECT id, title, updated_at FROM pages WHERE space_id = $1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 5',
        [id]
      ),
    ]);

    return {
      ...space,
      page_count: parseInt(countResult.rows[0]?.count ?? '0', 10),
      active_page_count: parseInt(activeCountResult.rows[0]?.count ?? '0', 10),
      recent_pages: recentResult.rows.map(r => ({
        id: r.id,
        title: r.title,
        updated_at: r.updated_at.toISOString(),
      })),
    };
  }

  async deleteSpace(id: number): Promise<{ success?: boolean; error?: string; status?: number }> {
    const result = await spacesRepo.delete(id);
    if (result === 'not_found') {
      return { error: 'Space not found', status: 404 };
    }
    if (result === 'has_live_pages') {
      return { error: 'В пространстве есть страницы — сначала удалите их', status: 400 };
    }
    return { success: true };
  }
}

export { SpacesService };
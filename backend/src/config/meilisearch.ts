/* eslint-disable @typescript-eslint/no-explicit-any */
import { MeiliSearch } from 'meilisearch';

// Lazy MeiliSearch client — only created if MEILISEARCH_URL is set
// This prevents crashes when the env var is missing
let _meiliClient: MeiliSearch | null = null;

export interface FallbackMeiliIndex {
  search: (query: string, options?: any) => Promise<{ hits: any[]; estimatedTotalHits: number }>;
  addDocuments: (docs: any[], primaryKey?: string) => Promise<{ taskUid: number }>;
  updateDocuments: (docs: any[]) => Promise<{ taskUid: number }>;
  updateSearchableAttributes: (attrs: string[]) => Promise<{ taskUid: number }>;
  updateFilterableAttributes: (attrs: string[]) => Promise<{ taskUid: number }>;
  deleteDocument: (id: string | number) => Promise<{ taskUid: number }>;
}

export interface FallbackMeiliClient {
  index: (name: string) => FallbackMeiliIndex;
  createIndex: (name: string, options: { primaryKey: string }) => Promise<{ uid: string }>;
  getIndexes: () => Promise<{ results: Array<{ uid: string }> }>;
  health: () => Promise<{ status: string }>;
}

export type MeiliClientType = MeiliSearch | FallbackMeiliClient;

function getMeiliClient(): MeiliClientType {
  if (_meiliClient) return _meiliClient;

  const host = process.env.MEILISEARCH_URL;
  if (!host) {
    const noopIndex: FallbackMeiliIndex = {
      search: async () => { throw new Error('MeiliSearch not configured (MEILISEARCH_URL not set)'); },
      addDocuments: async () => { throw new Error('MeiliSearch not configured'); },
      updateDocuments: async () => { throw new Error('MeiliSearch not configured'); },
      updateSearchableAttributes: async () => { throw new Error('MeiliSearch not configured'); },
      updateFilterableAttributes: async () => { throw new Error('MeiliSearch not configured'); },
      deleteDocument: async () => { throw new Error('MeiliSearch not configured'); },
    };
    const fallback: FallbackMeiliClient = {
      index: () => noopIndex,
      createIndex: async () => { throw new Error('MeiliSearch not configured'); },
      getIndexes: async () => ({ results: [] }),
      health: async () => ({ status: 'unavailable' }),
    };
    return fallback;
  }

  _meiliClient = new MeiliSearch({ host, apiKey: process.env.MEILI_MASTER_KEY });
  return _meiliClient;
}

export { getMeiliClient };

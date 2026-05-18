/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'meilisearch' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  class Index<T = any> {
    uid?: string;
    search(query: string, options?: any): Promise<{ hits: any[]; estimatedTotalHits: number }>;
    addDocuments(docs: any[], primaryKey?: string): Promise<{ taskUid: number }>;
    updateDocuments(docs: any[]): Promise<{ taskUid: number }>;
    updateSearchableAttributes(attrs: string[]): Promise<{ taskUid: number }>;
    deleteDocument(id: string | number): Promise<{ taskUid: number }>;
  }

  class MeiliSearch {
    constructor(config: { host: string; apiKey?: string });
    index(name: string): Index;
    createIndex(name: string, options: { primaryKey: string }): Promise<{ uid: string }>;
    getIndexes(): Promise<{ results: Index[] }>;
    health(): Promise<{ status: string }>;
  }

  export { Index, MeiliSearch };
}

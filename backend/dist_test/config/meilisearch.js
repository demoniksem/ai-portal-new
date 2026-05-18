"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMeiliClient = getMeiliClient;
/* eslint-disable @typescript-eslint/no-explicit-any */
const meilisearch_1 = require("meilisearch");
// Lazy MeiliSearch client — only created if MEILISEARCH_URL is set
// This prevents crashes when the env var is missing
let _meiliClient = null;
function getMeiliClient() {
    if (_meiliClient)
        return _meiliClient;
    const host = process.env.MEILISEARCH_URL;
    if (!host) {
        const noopIndex = {
            search: async () => { throw new Error('MeiliSearch not configured (MEILISEARCH_URL not set)'); },
            addDocuments: async () => { throw new Error('MeiliSearch not configured'); },
            updateDocuments: async () => { throw new Error('MeiliSearch not configured'); },
            updateSearchableAttributes: async () => { throw new Error('MeiliSearch not configured'); },
            updateFilterableAttributes: async () => { throw new Error('MeiliSearch not configured'); },
            deleteDocument: async () => { throw new Error('MeiliSearch not configured'); },
        };
        const fallback = {
            index: () => noopIndex,
            createIndex: async () => { throw new Error('MeiliSearch not configured'); },
            getIndexes: async () => ({ results: [] }),
            health: async () => ({ status: 'unavailable' }),
        };
        return fallback;
    }
    _meiliClient = new meilisearch_1.MeiliSearch({ host, apiKey: process.env.MEILI_MASTER_KEY });
    return _meiliClient;
}
//# sourceMappingURL=meilisearch.js.map
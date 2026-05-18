"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchService = void 0;
const config_1 = require("../config");
class SearchService {
    async search(opts) {
        if (!opts.query) {
            return { error: 'Query parameter "q" is required', status: 400 };
        }
        const limit = Math.min(opts.limit ?? 20, 100);
        const offset = opts.offset ?? 0;
        const highlight = opts.highlight ?? true;
        const type = opts.type ?? 'all';
        // Determine which indexes to search
        const indexes = type === 'card' ? ['cards'] : type === 'page' ? ['pages'] : ['pages', 'cards'];
        const allHits = [];
        let totalProcessingTimeMs = 0;
        let totalEstimatedHits = 0;
        const highlighted = [];
        for (const indexName of indexes) {
            const searchParams = { limit, offset };
            if (highlight) {
                searchParams.attributesToHighlight = ['title', 'content', 'description'];
                searchParams.highlightPreTag = '<mark>';
                searchParams.highlightPostTag = '</mark>';
            }
            const filters = [];
            if (opts.spaceId && indexName === 'pages')
                filters.push(`spaceId = ${parseInt(opts.spaceId, 10)}`);
            if (opts.boardId && indexName === 'cards')
                filters.push(`board_id = '${opts.boardId}'`);
            if (filters.length > 0)
                searchParams.filter = filters.join(' AND ');
            try {
                const results = await config_1.meiliClient.index(indexName).search(opts.query, searchParams);
                totalProcessingTimeMs += results.processingTimeMs ?? 0;
                totalEstimatedHits += results.estimatedTotalHits ?? results.hits?.length ?? 0;
                for (const hit of results.hits ?? []) {
                    allHits.push({ ...hit, _type: indexName });
                }
                if (highlight && results.hits) {
                    for (const hit of results.hits) {
                        const entry = { id: hit.id, type: indexName };
                        if (hit._formatted) {
                            entry.title = hit._formatted.title ?? hit.title ?? '';
                            if (indexName === 'pages')
                                entry.content = hit._formatted.content ?? '';
                            if (indexName === 'cards')
                                entry.description = hit._formatted.description ?? '';
                        }
                        else {
                            entry.title = hit.title ?? '';
                            if (indexName === 'pages')
                                entry.content = typeof hit.content === 'string' ? hit.content.substring(0, 200) : '';
                            if (indexName === 'cards')
                                entry.description = typeof hit.description === 'string' ? hit.description.substring(0, 200) : '';
                        }
                        highlighted.push(entry);
                    }
                }
            }
            catch (e) {
                if (!e.message?.includes('not configured')) {
                    return { error: `Search failed for ${indexName}: ${e.message}`, status: 500 };
                }
            }
        }
        return {
            hits: allHits,
            query: opts.query,
            processingTimeMs: totalProcessingTimeMs,
            estimatedTotalHits: totalEstimatedHits,
            limit,
            offset,
            highlighted,
        };
    }
    async autocomplete(query, limit = 5) {
        if (!query)
            return { hits: [] };
        const results = [];
        for (const indexName of ['pages', 'cards']) {
            try {
                const res = await config_1.meiliClient.index(indexName).search(query, {
                    limit,
                    attributesToRetrieve: ['id', 'title'],
                });
                for (const hit of res.hits ?? []) {
                    results.push({ id: hit.id, title: hit.title ?? '', type: indexName });
                }
            }
            catch (e) {
                // MeiliSearch not configured, silently skip
            }
        }
        return { hits: results.slice(0, limit) };
    }
}
exports.SearchService = SearchService;
//# sourceMappingURL=searchService.js.map
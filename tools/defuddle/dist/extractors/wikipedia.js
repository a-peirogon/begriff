"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WikipediaExtractor = void 0;
const _base_1 = require("./_base");
class WikipediaExtractor extends _base_1.BaseExtractor {
    canExtract() {
        return this.document.querySelector('#mw-content-text') !== null;
    }
    extract() {
        const ogTitle = this.document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
        const title = ogTitle.replace(/\s*[-–—]\s*Wikipedia\s*$/, '') || ogTitle;
        return {
            content: '',
            contentHtml: '',
            contentSelector: '#mw-content-text',
            variables: {
                title,
                author: 'Wikipedia',
                site: 'Wikipedia',
            },
        };
    }
}
exports.WikipediaExtractor = WikipediaExtractor;
//# sourceMappingURL=wikipedia.js.map
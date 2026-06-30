"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeetCodeExtractor = void 0;
const _base_1 = require("./_base");
class LeetCodeExtractor extends _base_1.BaseExtractor {
    canExtract() {
        return this.document.querySelector('[data-track-load="description_content"]') !== null;
    }
    extract() {
        const ogTitle = this.document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
        const title = ogTitle.replace(/\s*[-–—]\s*LeetCode\s*$/, '') || ogTitle;
        return {
            content: '',
            contentHtml: '',
            contentSelector: '[data-track-load="description_content"]',
            variables: {
                title,
                site: 'LeetCode',
            },
        };
    }
}
exports.LeetCodeExtractor = LeetCodeExtractor;
//# sourceMappingURL=leetcode.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseExtractor = void 0;
class BaseExtractor {
    constructor(document, url, schemaOrgData, options) {
        this.document = document;
        this.url = url;
        this.schemaOrgData = schemaOrgData;
        this.options = options || {};
    }
    get fetch() {
        const fn = this.options.fetch || globalThis.fetch;
        return fn.bind(globalThis);
    }
    /**
     * Generate a title from the post description text, falling back to
     * "Post by {author}" if the description is empty.
     */
    postTitle(author, site) {
        return `Post by ${author} on ${site}`;
    }
    canExtractAsync() {
        return false;
    }
    /**
     * When true, parseAsync() will prefer extractAsync() over extract(),
     * even if sync extraction produces content. Use this when the async
     * path provides strictly better results (e.g. YouTube transcripts).
     */
    prefersAsync() {
        return false;
    }
    async extractAsync() {
        return this.extract();
    }
}
exports.BaseExtractor = BaseExtractor;
//# sourceMappingURL=_base.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LwnExtractor = void 0;
const _base_1 = require("./_base");
const dom_1 = require("../utils/dom");
const comments_1 = require("../utils/comments");
class LwnExtractor extends _base_1.BaseExtractor {
    canExtract() {
        return !!this.document.querySelector('.PageHeadline') &&
            !!this.document.querySelector('.ArticleText');
    }
    extract() {
        const main = this.document.querySelector('.ArticleText main');
        const articleContent = main ? this.getArticleContent(main) : '';
        const comments = this.options.includeReplies !== false && main ? this.extractComments(main) : '';
        const contentHtml = (0, comments_1.buildContentHtml)('lwn', articleContent, comments);
        const byline = this.document.querySelector('.Byline')?.textContent?.trim() || '';
        return {
            content: contentHtml,
            contentHtml: contentHtml,
            extractedContent: {},
            variables: {
                title: this.document.querySelector('.PageHeadline h1')?.textContent?.trim() || '',
                author: byline.match(/by\s+(\w+)/i)?.[1] || '',
                site: 'LWN.net',
                published: this.parseDate(byline),
                description: this.document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '',
            }
        };
    }
    parseDate(text) {
        const match = text.match(/Posted\s+(\w+\s+\d+,\s+\d{4})/);
        if (!match)
            return '';
        const date = new Date(match[1]);
        return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
    }
    getArticleContent(main) {
        const clone = main.cloneNode(true);
        for (const el of Array.from(clone.querySelectorAll('details.CommentBox, form, a[name^="Comm"]'))) {
            el.remove();
        }
        // Remove trailing <hr> and <br clear="all"> separating article from comments
        let lastEl = clone.lastElementChild;
        while (lastEl && (lastEl.tagName === 'HR' || (lastEl.tagName === 'BR' && lastEl.getAttribute('clear')))) {
            const prev = lastEl.previousElementSibling;
            lastEl.remove();
            lastEl = prev;
        }
        return (0, dom_1.serializeHTML)(clone);
    }
    extractComments(main) {
        const allBoxes = Array.from(main.querySelectorAll('details.CommentBox'));
        const commentData = [];
        for (const box of allBoxes) {
            const depth = this.getCommentDepth(box, main);
            const data = this.extractCommentData(box, depth);
            if (data)
                commentData.push(data);
        }
        return commentData.length > 0 ? (0, comments_1.buildCommentTree)(commentData) : '';
    }
    getCommentDepth(el, root) {
        let depth = 0;
        let parent = el.parentElement;
        while (parent && parent !== root) {
            if (parent.tagName === 'DETAILS' && parent.classList.contains('CommentBox')) {
                depth++;
            }
            parent = parent.parentElement;
        }
        return depth;
    }
    extractCommentData(box, depth) {
        const poster = box.querySelector(':scope > summary .CommentPoster');
        if (!poster)
            return null;
        const author = poster.querySelector('b')?.textContent?.trim() || '';
        const linkEl = poster.querySelector('a[href^="/Articles/"]');
        const articlePath = linkEl?.getAttribute('href') || '';
        const url = articlePath ? `https://lwn.net${articlePath}` : '';
        const date = this.parseDate(poster.textContent || '');
        const title = box.querySelector(':scope > summary h3.CommentTitle')?.textContent?.trim() || '';
        // Only include title if it differs from the parent comment's title
        const parentBox = box.parentElement?.closest('details.CommentBox');
        const parentTitle = parentBox?.querySelector(':scope > summary h3.CommentTitle')?.textContent?.trim() || '';
        const uniqueTitle = title && title !== parentTitle ? title : '';
        const content = this.getCommentContent(box, uniqueTitle);
        return { author, date, content, depth, url };
    }
    getCommentContent(box, title) {
        let content = '';
        if (title) {
            content += `<p><strong>${(0, dom_1.escapeHtml)(title)}</strong></p>`;
        }
        const formatted = box.querySelector(':scope > .FormattedComment');
        if (formatted) {
            content += (0, dom_1.serializeHTML)(formatted);
        }
        else {
            // Collect direct content nodes, skipping structural elements
            const tempContainer = this.document.createElement('div');
            for (const child of Array.from(box.childNodes)) {
                if (child.nodeType === 1) {
                    const el = child;
                    const tag = el.tagName;
                    if (tag === 'SUMMARY' || tag === 'DETAILS' || el.classList.contains('CommentReplyButton'))
                        continue;
                    if (tag === 'FORM')
                        continue;
                    if (tag === 'A' && el.getAttribute('name')?.startsWith('CommAnchor'))
                        continue;
                    if (tag === 'P' && !el.textContent?.trim())
                        continue;
                }
                tempContainer.appendChild(child.cloneNode(true));
            }
            const text = (0, dom_1.serializeHTML)(tempContainer).trim();
            if (text)
                content += text;
        }
        return content;
    }
}
exports.LwnExtractor = LwnExtractor;
//# sourceMappingURL=lwn.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThreadsExtractor = void 0;
const _base_1 = require("./_base");
const dom_1 = require("../utils/dom");
const comments_1 = require("../utils/comments");
class ThreadsExtractor extends _base_1.BaseExtractor {
    constructor(document, url, schemaOrgData, options) {
        super(document, url, schemaOrgData, options);
        this.pagelets = [];
        this.regionContainer = null;
        const all = Array.from(document.querySelectorAll('[data-pagelet^="threads_post_page_"]'));
        this.pagelets = all.filter(p => p.querySelector('a[href^="/@"], time[datetime]'));
        // Fallback for server-rendered HTML (no pagelets, but has a region
        // with Threads post content — identified by /@username links)
        if (this.pagelets.length === 0) {
            const region = document.querySelector('div[role="region"]');
            if (region?.querySelector('a[href^="/@"]')) {
                this.regionContainer = region;
            }
        }
    }
    canExtract() {
        return this.pagelets.length > 0 || !!this.regionContainer;
    }
    extract() {
        // Fallback: server-rendered HTML without pagelets
        if (this.pagelets.length === 0 && this.regionContainer) {
            return this.extractFromRegion(this.regionContainer);
        }
        const mainAuthor = this.getUsername(this.pagelets[0]);
        // Classify pagelets into thread posts (by main author) and replies.
        // Parse each pagelet once and cache the results.
        const threadPosts = [];
        const replyPosts = [];
        let threadEnded = false;
        for (const pagelet of this.pagelets) {
            const posts = this.getPostsFromPagelet(pagelet);
            if (posts.length === 0)
                continue;
            if (!threadEnded && posts[0].username === mainAuthor && posts.length === 1) {
                threadPosts.push(posts[0]);
            }
            else {
                threadEnded = true;
                replyPosts.push(posts);
            }
        }
        const postContent = threadPosts.map(p => p.content).join('\n<hr>\n');
        const comments = this.options.includeReplies !== false
            ? this.extractComments(replyPosts)
            : '';
        const contentHtml = (0, comments_1.buildContentHtml)('threads', postContent, comments);
        const author = `@${mainAuthor}`;
        const description = this.createDescription(threadPosts[0]?.element);
        const title = this.postTitle(author, 'Threads');
        const published = threadPosts[0]?.date || '';
        return {
            content: contentHtml,
            contentHtml,
            extractedContent: {
                postAuthor: mainAuthor,
            },
            variables: {
                title,
                author,
                site: 'Threads',
                description,
                ...(published && { published }),
            }
        };
    }
    /**
     * Extract from server-rendered HTML where the post content is inside
     * a div[role="region"] without pagelet wrappers.
     */
    extractFromRegion(region) {
        const mainAuthor = this.getUsername(region);
        if (!mainAuthor)
            return { content: '', contentHtml: '' };
        const author = `@${mainAuthor}`;
        const postContent = this.extractPostContent(region);
        // Extract replies from embedded JSON data
        const comments = this.options.includeReplies !== false
            ? this.extractCommentsFromJson(mainAuthor)
            : '';
        const contentHtml = (0, comments_1.buildContentHtml)('threads', postContent, comments);
        const description = this.createDescription(region);
        const date = this.getDate(region);
        return {
            content: contentHtml,
            contentHtml,
            extractedContent: {
                postAuthor: mainAuthor,
            },
            variables: {
                title: this.postTitle(author, 'Threads'),
                author,
                site: 'Threads',
                description,
                ...(date && { published: date }),
            }
        };
    }
    /**
     * Extract reply data from React hydration JSON scripts.
     * Server-rendered Threads pages embed post data in script[type="application/json"].
     */
    extractCommentsFromJson(mainAuthor) {
        const scripts = this.document.querySelectorAll('script[type="application/json"]');
        // Replies can be spread across multiple JSON scripts.
        // Parse all scripts that contain reply data and merge results.
        const allPosts = [];
        const seen = new Set();
        for (const script of Array.from(scripts)) {
            const raw = script.textContent || '';
            if ((raw.match(/"text_fragments"/g) || []).length < 2)
                continue;
            if (!raw.includes('"username"'))
                continue;
            try {
                const data = JSON.parse(raw);
                for (const post of this.findPostsInJson(data, 0)) {
                    // Deduplicate by text content
                    const key = post.username + ':' + post.text.slice(0, 80);
                    if (seen.has(key))
                        continue;
                    seen.add(key);
                    allPosts.push(post);
                }
            }
            catch { /* skip unparseable scripts */ }
        }
        if (allPosts.length < 2)
            return '';
        // First entry by the main author is the post itself — skip it
        const commentData = [];
        let isFirstByMainAuthor = true;
        for (const post of allPosts) {
            if (isFirstByMainAuthor && post.username === mainAuthor) {
                isFirstByMainAuthor = false;
                continue;
            }
            commentData.push({
                author: `@${post.username}`,
                date: '',
                content: `<p>${(0, dom_1.escapeHtml)(post.text)}</p>`,
                depth: 0,
            });
        }
        return commentData.length > 0 ? (0, comments_1.buildCommentTree)(commentData) : '';
    }
    findPostsInJson(obj, depth, results = []) {
        if (depth > 35 || obj == null || typeof obj !== 'object')
            return results;
        if (obj.user?.username && typeof obj.user.username === 'string') {
            const text = this.extractTextFromJson(obj, 0);
            if (text) {
                results.push({ username: obj.user.username, text });
            }
        }
        for (const key of Object.keys(obj)) {
            if (key === 'quoted_post')
                continue;
            this.findPostsInJson(obj[key], depth + 1, results);
        }
        return results;
    }
    extractTextFromJson(obj, depth) {
        if (depth > 10 || obj == null || typeof obj !== 'object')
            return null;
        if (obj.text_fragments?.fragments) {
            return obj.text_fragments.fragments
                .map((f) => {
                if (f.plaintext)
                    return f.plaintext;
                if (f.mention_fragment?.username)
                    return `@${f.mention_fragment.username}`;
                if (f.linkified_web_url)
                    return f.linkified_web_url;
                return '';
            })
                .join('');
        }
        for (const key of Object.keys(obj)) {
            if (key === 'quoted_post')
                continue;
            const result = this.extractTextFromJson(obj[key], depth + 1);
            if (result)
                return result;
        }
        return null;
    }
    getPostsFromPagelet(pagelet) {
        const containers = pagelet.querySelectorAll('[data-pressable-container]');
        const posts = [];
        for (const container of Array.from(containers)) {
            // Skip nested quoted posts (pressable inside another pressable)
            if (container.parentElement?.closest('[data-pressable-container]')) {
                continue;
            }
            const username = this.getUsername(container);
            if (!username)
                continue;
            posts.push({
                username,
                date: this.getDate(container),
                permalink: this.getPermalink(container),
                content: this.extractPostContent(container),
                element: container,
            });
        }
        return posts;
    }
    extractComments(replyPosts) {
        const commentData = [];
        for (const posts of replyPosts) {
            // Single post = top-level reply (depth 0)
            // Multiple posts = linear reply chain (depth 0, 1, 2, ...)
            for (let i = 0; i < posts.length; i++) {
                commentData.push(this.toCommentData(posts[i], posts.length === 1 ? 0 : i));
            }
        }
        return commentData.length > 0 ? (0, comments_1.buildCommentTree)(commentData) : '';
    }
    toCommentData(post, depth) {
        return {
            author: `@${post.username}`,
            date: post.date,
            content: post.content,
            depth,
            url: post.permalink || undefined,
        };
    }
    getUsername(container) {
        const links = container.querySelectorAll('a[href^="/@"][role="link"]');
        for (const link of Array.from(links)) {
            const text = link.textContent?.trim();
            if (text && !text.includes('profile picture')) {
                return text;
            }
        }
        // Fallback: extract from href
        const firstLink = container.querySelector('a[href^="/@"]');
        if (firstLink) {
            const match = firstLink.getAttribute('href')?.match(/\/@([^/]+)/);
            return match ? match[1] : '';
        }
        return '';
    }
    getDate(container) {
        const timeEl = container.querySelector('time[datetime]');
        if (!timeEl)
            return '';
        const datetime = timeEl.getAttribute('datetime') || '';
        try {
            return new Date(datetime).toISOString().split('T')[0];
        }
        catch {
            return '';
        }
    }
    getPermalink(container) {
        const timeLink = container.querySelector('a[href*="/post/"]');
        if (!timeLink)
            return '';
        const href = timeLink.getAttribute('href') || '';
        return href.startsWith('http') ? href : `https://www.threads.com${href}`;
    }
    extractPostContent(container) {
        const parts = [];
        const allSpans = Array.from(container.querySelectorAll('span[dir="auto"]'));
        for (const span of allSpans) {
            if (span.closest('a[href^="/@"], a[href*="/post/"], a[href*="l.threads.com"], time'))
                continue;
            if (span.closest('[role="button"]'))
                continue;
            const text = span.textContent?.trim() || '';
            if (!text || text === 'Author' || text === '·' || text === 'Top' || text === 'View activity')
                continue;
            if (/^\d{2}\/\d{2}\/\d{2}$/.test(text) || /^@?\w+\/post\/\w+$/.test(text))
                continue;
            const cleaned = this.stripThreadNumber(text);
            if (!cleaned)
                continue;
            const cleanedHtml = this.cleanText(span);
            if (cleanedHtml)
                parts.push(`<p>${cleanedHtml}</p>`);
        }
        const images = this.extractImages(container);
        if (images)
            parts.push(images);
        const card = this.extractLinkCard(container);
        if (card)
            parts.push(card);
        const quoted = this.extractQuotedPost(container);
        if (quoted)
            parts.push(quoted);
        return parts.join('\n');
    }
    cleanText(span) {
        const clone = span.cloneNode(true);
        this.removeThreadNumbers(clone);
        clone.querySelectorAll('a').forEach(link => {
            const href = link.getAttribute('href') || '';
            const text = link.textContent?.trim() || '';
            // Remove post permalink links entirely
            if (href.match(/\/@[\w.]+\/post\//)) {
                link.remove();
                return;
            }
            const cleanLink = clone.ownerDocument.createElement('a');
            if (href.includes('l.threads.com')) {
                cleanLink.setAttribute('href', this.unwrapRedirectUrl(href));
            }
            else if (href.startsWith('/@')) {
                const username = href.replace(/^\/@/, '');
                cleanLink.setAttribute('href', `https://www.threads.com/@${username}`);
                cleanLink.textContent = `@${username}`;
                link.replaceWith(cleanLink);
                return;
            }
            else {
                cleanLink.setAttribute('href', href.startsWith('http') ? href : `https://www.threads.com${href}`);
            }
            cleanLink.textContent = text;
            link.replaceWith(cleanLink);
        });
        clone.querySelectorAll('span, div').forEach(el => {
            el.replaceWith(...Array.from(el.childNodes));
        });
        let html = (clone.innerHTML || clone.textContent || '').trim();
        html = html.replace(/<!--.*?-->/g, '');
        html = html.replace(/\s+/g, ' ').trim();
        return html || '';
    }
    stripThreadNumber(text) {
        return text.replace(/\s*\d+\s*\/\s*\d+\s*$/, '').trim();
    }
    removeThreadNumbers(container) {
        // Thread numbers are structured as separate spans in a div (e.g. "1" "/" "2").
        // Match divs whose full text is a fraction like "1/2".
        const divs = Array.from(container.querySelectorAll('div'));
        for (const div of divs) {
            const text = div.textContent?.trim() || '';
            if (/^\d+\/\d+$/.test(text) && div.querySelectorAll('span').length >= 2) {
                div.remove();
            }
        }
    }
    unwrapRedirectUrl(href) {
        try {
            const url = new URL(href);
            const actual = url.searchParams.get('u');
            return actual ? decodeURIComponent(actual) : href;
        }
        catch {
            return href;
        }
    }
    extractImages(container) {
        const images = [];
        container.querySelectorAll('img').forEach(img => {
            const alt = img.getAttribute('alt') || '';
            const src = img.getAttribute('src') || '';
            if (alt.includes('profile picture') || !src)
                return;
            if (img.closest('a[href*="l.threads.com"]'))
                return;
            const width = parseInt(img.getAttribute('width') || '0');
            if (width > 0 && width <= 48)
                return;
            images.push(`<img src="${(0, dom_1.escapeHtml)(src)}" alt="${(0, dom_1.escapeHtml)(alt)}" />`);
        });
        return images.join('\n');
    }
    extractLinkCard(container) {
        const cardLinks = container.querySelectorAll('a[href*="l.threads.com"]');
        for (const cardLink of Array.from(cardLinks)) {
            const img = cardLink.querySelector('img');
            if (!img)
                continue;
            const href = cardLink.getAttribute('href') || '';
            const actualUrl = this.unwrapRedirectUrl(href);
            const imgSrc = img.getAttribute('src') || '';
            const imgAlt = img.getAttribute('alt') || '';
            if (imgSrc) {
                return `<a href="${(0, dom_1.escapeHtml)(actualUrl)}"><img src="${(0, dom_1.escapeHtml)(imgSrc)}" alt="${(0, dom_1.escapeHtml)(imgAlt)}" /></a>`;
            }
        }
        return '';
    }
    extractQuotedPost(container) {
        // Browser DOM: quoted posts are nested [data-pressable-container] elements
        const nestedPressable = container.querySelector('[data-pressable-container]');
        if (nestedPressable) {
            return this.extractQuotedPostFrom(nestedPressable);
        }
        // Server HTML fallback: look for a second /@user/post/ link that
        // contains text content (the main post's permalink only has a date)
        const postLinks = container.querySelectorAll('a[href*="/post/"]');
        for (const link of Array.from(postLinks)) {
            const text = link.textContent?.trim() || '';
            // Skip timestamp-only links (just a date like "04/04/26")
            if (/^\d{2}\/\d{2}\/\d{2}$/.test(text))
                continue;
            // This link has real text content — it's a quoted post
            const href = link.getAttribute('href') || '';
            const match = href.match(/\/@([^/]+)\/post\//);
            if (!match)
                continue;
            const username = match[1];
            const content = `<p>${(0, dom_1.escapeHtml)(text)}</p>`;
            const permalink = href.startsWith('http') ? href : `https://www.threads.com${href}`;
            return (0, comments_1.buildQuotedPost)({
                author: `@${username}`,
                content,
                url: permalink,
            });
        }
        return '';
    }
    extractQuotedPostFrom(quotedContainer) {
        const username = this.getUsername(quotedContainer);
        const date = this.getDate(quotedContainer);
        // Quoted post text is often inside the post permalink link,
        // so only skip username-only @-links, not post links.
        const textSpans = Array.from(quotedContainer.querySelectorAll('span[dir="auto"]'));
        let content = '';
        for (const span of textSpans) {
            if (span.closest('[role="button"], time'))
                continue;
            const link = span.closest('a[href^="/@"]');
            if (link && !link.getAttribute('href')?.includes('/post/'))
                continue;
            const text = span.textContent?.trim();
            if (!text || text === '·' || text === 'Author')
                continue;
            if (/^\d{2}\/\d{2}\/\d{2}$/.test(text))
                continue;
            const cleaned = this.stripThreadNumber(text);
            if (cleaned) {
                content += `<p>${(0, dom_1.escapeHtml)(cleaned)}</p>\n`;
            }
        }
        return (0, comments_1.buildQuotedPost)({
            author: username ? `@${username}` : undefined,
            date: date || undefined,
            content: content.trim(),
        });
    }
    createDescription(container) {
        if (!container)
            return '';
        const spans = container.querySelectorAll('span[dir="auto"]');
        for (const span of Array.from(spans)) {
            if (span.closest('a[href^="/@"], [role="button"], a[href*="/post/"], time'))
                continue;
            const text = span.textContent?.trim() || '';
            if (!text || text === 'Author' || text === '·' || text === 'Top' || text === 'View activity')
                continue;
            if (/^\d{2}\/\d{2}\/\d{2}$/.test(text))
                continue;
            const cleaned = this.stripThreadNumber(text);
            if (cleaned) {
                return cleaned.slice(0, 140).replace(/\s+/g, ' ');
            }
        }
        return '';
    }
}
exports.ThreadsExtractor = ThreadsExtractor;
//# sourceMappingURL=threads.js.map
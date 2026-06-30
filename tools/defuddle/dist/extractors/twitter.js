"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwitterExtractor = void 0;
const _base_1 = require("./_base");
const dom_1 = require("../utils/dom");
const comments_1 = require("../utils/comments");
class TwitterExtractor extends _base_1.BaseExtractor {
    constructor(document, url) {
        super(document, url);
        this.mainTweet = null;
        this.threadTweets = [];
        this.replyTweets = [];
        this.replyDepths = [];
        // Get all tweets from the timeline
        const timeline = Array.from(document.querySelectorAll('[aria-label]'))
            .find(el => el.querySelector('[data-testid="cellInnerDiv"]') !== null) ?? null;
        if (!timeline) {
            // Try to find a single tweet if not in timeline view
            const singleTweet = document.querySelector('article[data-testid="tweet"]');
            if (singleTweet) {
                this.mainTweet = singleTweet;
            }
            return;
        }
        // Walk cellInnerDiv elements to classify tweets:
        // 1. Main tweet (first article)
        // 2. Thread tweets: consecutive self-replies by the main author at the
        //    top of the timeline, before any reply by a different person
        // 3. Reply tweets: everything after the thread ends
        const cells = Array.from(timeline.querySelectorAll('[data-testid="cellInnerDiv"]'));
        // Get all tweets before any section with "Discover more" or similar headings
        const firstSection = timeline.querySelector('section, h2')?.parentElement;
        let mainHandle = '';
        let isFirstTweet = true;
        let threadEnded = false;
        let lastWasTweet = false;
        let currentDepth = 0;
        for (const cell of cells) {
            // Stop if we've passed a section boundary
            if (firstSection && (firstSection.compareDocumentPosition(cell) & Node.DOCUMENT_POSITION_FOLLOWING)) {
                break;
            }
            const article = cell.querySelector('article[data-testid="tweet"]');
            if (article) {
                if (isFirstTweet) {
                    this.mainTweet = article;
                    mainHandle = this.getHandle(article);
                    isFirstTweet = false;
                    lastWasTweet = true;
                    continue;
                }
                const handle = this.getHandle(article);
                // Before the thread has ended, self-replies by the main author
                // are part of the thread (post content)
                if (!threadEnded && handle === mainHandle) {
                    this.threadTweets.push(article);
                    lastWasTweet = true;
                    continue;
                }
                // First tweet by a different person ends the thread
                if (!threadEnded) {
                    threadEnded = true;
                }
                // Determine reply depth
                if (lastWasTweet) {
                    currentDepth++;
                }
                else {
                    currentDepth = 0;
                }
                this.replyTweets.push(article);
                this.replyDepths.push(currentDepth);
                lastWasTweet = true;
            }
            else {
                lastWasTweet = false;
            }
        }
    }
    canExtract() {
        return !!this.mainTweet;
    }
    extract() {
        // Build post content from main tweet + thread (self-replies)
        const parts = [this.extractTweetContent(this.mainTweet)];
        for (const tweet of this.threadTweets) {
            parts.push(this.extractTweetContent(tweet));
        }
        const postContent = parts.join('\n<hr>\n');
        const comments = this.options.includeReplies !== false
            ? this.extractComments()
            : '';
        const contentHtml = (0, comments_1.buildContentHtml)('twitter', postContent, comments);
        const tweetId = this.getTweetId();
        const tweetAuthor = this.getTweetAuthor();
        const description = this.createDescription(this.mainTweet);
        const title = this.postTitle(tweetAuthor, 'X');
        return {
            content: contentHtml,
            contentHtml: contentHtml,
            extractedContent: {
                tweetId,
                tweetAuthor,
            },
            variables: {
                title,
                author: tweetAuthor,
                site: 'X (Twitter)',
                description,
            }
        };
    }
    extractComments() {
        if (this.replyTweets.length === 0)
            return '';
        const commentData = this.replyTweets.map((tweet, i) => {
            const userInfo = this.extractUserInfo(tweet);
            const content = this.extractTweetContent(tweet);
            return {
                author: userInfo.fullName ? `${userInfo.fullName} ${userInfo.handle}` : userInfo.handle,
                date: userInfo.date,
                content,
                depth: this.replyDepths[i],
                url: userInfo.permalink,
            };
        });
        return (0, comments_1.buildCommentTree)(commentData);
    }
    getHandle(tweet) {
        const nameElement = tweet.querySelector('[data-testid="User-Name"]');
        const links = nameElement?.querySelectorAll('a');
        return links?.[1]?.textContent?.trim() || '';
    }
    formatTweetText(text) {
        if (!text)
            return '';
        // Create a temporary div to parse and clean the HTML
        const tempDiv = this.document.createElement('div');
        tempDiv.appendChild((0, dom_1.parseHTML)(this.document, text));
        // Convert links to plain text with @ handles
        tempDiv.querySelectorAll('a').forEach(link => {
            const handle = link.textContent?.trim() || '';
            link.replaceWith(handle);
        });
        // Remove unnecessary spans and divs but keep their content
        tempDiv.querySelectorAll('span, div').forEach(element => {
            element.replaceWith(...Array.from(element.childNodes));
        });
        // Get cleaned text and split into paragraphs
        const cleanText = (0, dom_1.serializeHTML)(tempDiv);
        const paragraphs = cleanText.split('\n')
            .map(line => line.trim())
            .filter(line => line);
        // Wrap each paragraph in <p> tags
        return paragraphs.map(p => `<p>${p}</p>`).join('\n');
    }
    replaceEmojiImages(container) {
        container.querySelectorAll('img[src*="/emoji/"]').forEach(img => {
            const altText = img.getAttribute('alt');
            if (altText) {
                img.replaceWith(altText);
            }
        });
    }
    findQuotedTweet(tweet) {
        return tweet.querySelector('[aria-labelledby*="id__"]')
            ?.querySelector('[data-testid="User-Name"]')
            ?.closest('[aria-labelledby*="id__"]') || null;
    }
    extractTweetContent(tweet) {
        if (!tweet)
            return '';
        const tweetClone = tweet.cloneNode(true);
        this.replaceEmojiImages(tweetClone);
        const tweetTextEl = tweetClone.querySelector('[data-testid="tweetText"]');
        const tweetText = tweetTextEl ? (0, dom_1.serializeHTML)(tweetTextEl) : '';
        const formattedText = this.formatTweetText(tweetText);
        const quotedTweet = this.findQuotedTweet(tweet);
        const images = this.extractImages(tweet, quotedTweet);
        const quotedHtml = quotedTweet ? this.extractQuotedTweet(quotedTweet) : '';
        const cardLink = this.extractCard(tweet);
        let html = '';
        if (formattedText)
            html += formattedText;
        if (images.length)
            html += `\n${images.join('\n')}`;
        if (cardLink)
            html += `\n${cardLink}`;
        if (quotedHtml)
            html += `\n${quotedHtml}`;
        return html;
    }
    extractQuotedTweet(quotedTweet) {
        const tweetClone = quotedTweet.cloneNode(true);
        this.replaceEmojiImages(tweetClone);
        const tweetTextEl = tweetClone.querySelector('[data-testid="tweetText"]');
        const tweetText = tweetTextEl ? (0, dom_1.serializeHTML)(tweetTextEl) : '';
        const formattedText = this.formatTweetText(tweetText);
        const userInfo = this.extractUserInfo(quotedTweet);
        const images = this.extractImages(quotedTweet, null);
        let content = '';
        if (formattedText)
            content += formattedText;
        if (images.length)
            content += `\n${images.join('\n')}`;
        const author = userInfo.fullName
            ? `${userInfo.fullName} ${userInfo.handle}`
            : userInfo.handle;
        return (0, comments_1.buildQuotedPost)({
            author: author || undefined,
            date: userInfo.date || undefined,
            content,
        });
    }
    extractUserInfo(tweet) {
        const nameElement = tweet.querySelector('[data-testid="User-Name"]');
        if (!nameElement)
            return { fullName: '', handle: '', date: '', permalink: '' };
        // Try to get name and handle from links first (main tweet structure)
        const links = nameElement.querySelectorAll('a');
        let fullName = links?.[0]?.textContent?.trim() || '';
        let handle = links?.[1]?.textContent?.trim() || '';
        // If links don't have the info, try direct children (quoted tweet structure).
        // Quoted tweets have two child divs: [0] = display name, [1] = "@handle·date"
        if (!fullName || !handle) {
            const children = Array.from(nameElement.children);
            if (children.length >= 2) {
                fullName = children[0]?.textContent?.trim() || '';
                const secondText = children[1]?.textContent?.trim() || '';
                const handleMatch = secondText.match(/(@\w+)/);
                handle = handleMatch ? handleMatch[1] : '';
            }
        }
        const timestamp = tweet.querySelector('time');
        const datetime = timestamp?.getAttribute('datetime') || '';
        const date = datetime ? new Date(datetime).toISOString().split('T')[0] : '';
        const permalink = timestamp?.closest('a')?.href || '';
        return { fullName, handle, date, permalink };
    }
    extractImages(tweet, quotedTweet) {
        const imageContainers = [
            '[data-testid="tweetPhoto"]',
            '[data-testid="tweet-image"]',
            'img[src*="media"]'
        ];
        const images = [];
        for (const selector of imageContainers) {
            const elements = tweet.querySelectorAll(selector);
            elements.forEach(img => {
                if (quotedTweet?.contains(img)) {
                    return;
                }
                if (img.tagName.toLowerCase() === 'img' && img.getAttribute('alt')) {
                    const highQualitySrc = img.getAttribute('src')?.replace(/&name=\w+$/, '&name=large') || '';
                    const cleanAlt = img.getAttribute('alt')?.replace(/\s+/g, ' ').trim() || '';
                    images.push(`<img src="${(0, dom_1.escapeHtml)(highQualitySrc)}" alt="${(0, dom_1.escapeHtml)(cleanAlt)}" />`);
                }
            });
        }
        return images;
    }
    extractCard(tweet) {
        const card = tweet.querySelector('[data-testid="card.wrapper"]');
        if (!card)
            return '';
        const cardLink = card.querySelector('a[href]');
        if (!cardLink)
            return '';
        const href = cardLink.getAttribute('href') || '';
        const label = cardLink.getAttribute('aria-label') || '';
        const title = label.split(/\n/)[0]?.trim() || href;
        return `<p><a href="${(0, dom_1.escapeHtml)(href)}">${(0, dom_1.escapeHtml)(title)}</a></p>`;
    }
    getTweetId() {
        const match = this.url.match(/status\/(\d+)/);
        return match?.[1] || '';
    }
    getTweetAuthor() {
        const handle = this.getHandle(this.mainTweet);
        return handle.startsWith('@') ? handle : `@${handle}`;
    }
    createDescription(tweet) {
        if (!tweet)
            return '';
        const tweetText = tweet.querySelector('[data-testid="tweetText"]')?.textContent || '';
        return tweetText.trim().slice(0, 140).replace(/\s+/g, ' ');
    }
}
exports.TwitterExtractor = TwitterExtractor;
//# sourceMappingURL=twitter.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtractorRegistry = void 0;
// Extractors
const reddit_1 = require("./extractors/reddit");
const twitter_1 = require("./extractors/twitter");
const x_article_1 = require("./extractors/x-article");
const youtube_1 = require("./extractors/youtube");
const bilibili_1 = require("./extractors/bilibili");
const hackernews_1 = require("./extractors/hackernews");
const chatgpt_1 = require("./extractors/chatgpt");
const claude_1 = require("./extractors/claude");
const grok_1 = require("./extractors/grok");
const gemini_1 = require("./extractors/gemini");
const github_1 = require("./extractors/github");
const x_oembed_1 = require("./extractors/x-oembed");
const bbcode_data_1 = require("./extractors/bbcode-data");
const c2_wiki_1 = require("./extractors/c2-wiki");
const substack_1 = require("./extractors/substack");
const nytimes_1 = require("./extractors/nytimes");
const wikipedia_1 = require("./extractors/wikipedia");
const linkedin_1 = require("./extractors/linkedin");
const threads_1 = require("./extractors/threads");
const bluesky_1 = require("./extractors/bluesky");
const discourse_1 = require("./extractors/discourse");
const medium_1 = require("./extractors/medium");
const leetcode_1 = require("./extractors/leetcode");
const lwn_1 = require("./extractors/lwn");
const mastodon_1 = require("./extractors/mastodon");
class ExtractorRegistry {
    static initialize() {
        // Register all extractors with their URL patterns
        // X Article extractor must be registered BEFORE Twitter to take priority
        // DOM-based canExtract() determines if page has article content
        this.register({
            patterns: [
                'x.com',
                'twitter.com',
            ],
            extractor: x_article_1.XArticleExtractor
        });
        this.register({
            patterns: [
                'twitter.com',
                /\/x\.com\/.*/,
            ],
            extractor: twitter_1.TwitterExtractor
        });
        this.register({
            patterns: [
                'x.com',
                'twitter.com',
            ],
            extractor: x_oembed_1.XOembedExtractor
        });
        this.register({
            patterns: [
                'reddit.com',
                'old.reddit.com',
                'new.reddit.com',
                /^https:\/\/[^\/]+\.reddit\.com/
            ],
            extractor: reddit_1.RedditExtractor
        });
        this.register({
            patterns: [
                'youtube.com',
                'youtu.be',
                /youtube\.com\/watch\?v=.*/,
                /youtu\.be\/.*/
            ],
            extractor: youtube_1.YoutubeExtractor
        });
        this.register({
            patterns: [
                'bilibili.com',
                /www\.bilibili\.com\/video\/BV[0-9A-Za-z]+/,
            ],
            extractor: bilibili_1.BilibiliExtractor
        });
        this.register({
            patterns: [
                'news.ycombinator.com',
            ],
            extractor: hackernews_1.HackerNewsExtractor
        });
        this.register({
            patterns: [
                /^https?:\/\/chatgpt\.com\/(c|share)\/.*/
            ],
            extractor: chatgpt_1.ChatGPTExtractor
        });
        this.register({
            patterns: [
                'claude.ai',
                /^https?:\/\/claude\.ai\/(chat|share)\/.*/
            ],
            extractor: claude_1.ClaudeExtractor
        });
        this.register({
            patterns: [
                /^https?:\/\/grok\.com\/(chat|share)(\/.*)?$/
            ],
            extractor: grok_1.GrokExtractor,
        });
        this.register({
            patterns: [
                /^https?:\/\/gemini\.google\.com\/app\/.*/
            ],
            extractor: gemini_1.GeminiExtractor
        });
        this.register({
            patterns: [
                'github.com',
                /^https?:\/\/github\.com\/.*/
            ],
            extractor: github_1.GitHubExtractor
        });
        this.register({
            patterns: [
                'linkedin.com',
            ],
            extractor: linkedin_1.LinkedInExtractor
        });
        this.register({
            patterns: [
                'threads.net',
                'www.threads.com',
                'threads.com',
            ],
            extractor: threads_1.ThreadsExtractor
        });
        this.register({
            patterns: [
                'bsky.app',
            ],
            extractor: bluesky_1.BlueskyExtractor
        });
        this.register({
            patterns: [
                'medium.com',
                /\.medium\.com/,
            ],
            extractor: medium_1.MediumExtractor
        });
        this.register({
            patterns: [
                'wiki.c2.com',
            ],
            extractor: c2_wiki_1.C2WikiExtractor
        });
        this.register({
            patterns: [
                /^https?:\/\/substack\.com\/@[^/]+\/note\/.+/,
                /^https?:\/\/substack\.com\/home\/post\/p-\d+/,
                'substack.com',
            ],
            extractor: substack_1.SubstackExtractor
        });
        this.register({
            patterns: [
                'nytimes.com',
            ],
            extractor: nytimes_1.NytimesExtractor
        });
        this.register({
            patterns: [
                'wikipedia.org',
            ],
            extractor: wikipedia_1.WikipediaExtractor
        });
        this.register({
            patterns: [/\/@[^/]+\/\d+/],
            extractor: mastodon_1.MastodonExtractor
        });
        this.register({
            patterns: [/\/t\/[^/]+\/\d+/],
            extractor: discourse_1.DiscourseExtractor
        });
        this.register({
            patterns: [
                'leetcode.com',
            ],
            extractor: leetcode_1.LeetCodeExtractor
        });
        this.register({
            patterns: [
                'lwn.net',
            ],
            extractor: lwn_1.LwnExtractor
        });
        this.register({
            patterns: [/.*/],
            extractor: bbcode_data_1.BbcodeDataExtractor
        });
    }
    static register(mapping) {
        this.mappings.push(mapping);
    }
    static findExtractor(document, url, schemaOrgData, options) {
        return this.findByPredicate(document, url, schemaOrgData, e => e.canExtract(), options);
    }
    static findAsyncExtractor(document, url, schemaOrgData, options) {
        return this.findByPredicate(document, url, schemaOrgData, e => e.canExtractAsync(), options);
    }
    static findPreferredAsyncExtractor(document, url, schemaOrgData, options) {
        return this.findByPredicate(document, url, schemaOrgData, e => e.canExtractAsync() && e.prefersAsync(), options);
    }
    static findByPredicate(document, url, schemaOrgData, predicate, options) {
        try {
            const domain = new URL(url).hostname;
            for (const { patterns, extractor } of this.mappings) {
                const matches = patterns.some(pattern => {
                    if (pattern instanceof RegExp) {
                        return pattern.test(url);
                    }
                    return domain.includes(pattern);
                });
                if (matches) {
                    const instance = new extractor(document, url, schemaOrgData, options);
                    if (predicate(instance)) {
                        return instance;
                    }
                }
            }
            return null;
        }
        catch (error) {
            console.error('Error finding extractor:', error);
            return null;
        }
    }
}
exports.ExtractorRegistry = ExtractorRegistry;
ExtractorRegistry.mappings = [];
// Initialize extractors
ExtractorRegistry.initialize();
//# sourceMappingURL=extractor-registry.js.map
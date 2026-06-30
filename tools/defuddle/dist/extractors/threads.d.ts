import { BaseExtractor, ExtractorOptions } from './_base';
import { ExtractorResult } from '../types/extractors';
export declare class ThreadsExtractor extends BaseExtractor {
    private pagelets;
    private regionContainer;
    constructor(document: Document, url: string, schemaOrgData?: any, options?: ExtractorOptions);
    canExtract(): boolean;
    extract(): ExtractorResult;
    /**
     * Extract from server-rendered HTML where the post content is inside
     * a div[role="region"] without pagelet wrappers.
     */
    private extractFromRegion;
    /**
     * Extract reply data from React hydration JSON scripts.
     * Server-rendered Threads pages embed post data in script[type="application/json"].
     */
    private extractCommentsFromJson;
    private findPostsInJson;
    private extractTextFromJson;
    private getPostsFromPagelet;
    private extractComments;
    private toCommentData;
    private getUsername;
    private getDate;
    private getPermalink;
    private extractPostContent;
    private cleanText;
    private stripThreadNumber;
    private removeThreadNumbers;
    private unwrapRedirectUrl;
    private extractImages;
    private extractLinkCard;
    private extractQuotedPost;
    private extractQuotedPostFrom;
    private createDescription;
}

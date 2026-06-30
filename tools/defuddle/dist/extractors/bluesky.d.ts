import { BaseExtractor, ExtractorOptions } from './_base';
import { ExtractorResult } from '../types/extractors';
export declare class BlueskyExtractor extends BaseExtractor {
    private threadScreen;
    private postItems;
    constructor(document: Document, url: string, schemaOrgData?: any, options?: ExtractorOptions);
    canExtract(): boolean;
    extract(): ExtractorResult;
    private extractComments;
    private hasTopConnector;
    private getHandle;
    private getDisplayName;
    private getPublishedDate;
    private getReplyDate;
    private getPermalink;
    private extractPostContent;
    private cleanText;
    private extractImages;
    private extractLinkCard;
    private extractQuotedPost;
    private createDescription;
}

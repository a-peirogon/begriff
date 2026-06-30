import { BaseExtractor, ExtractorOptions } from './_base';
import { ExtractorResult } from '../types/extractors';
export declare class MastodonExtractor extends BaseExtractor {
    private mainPost;
    private replyStatuses;
    constructor(document: Document, url: string, schemaOrgData?: any, options?: ExtractorOptions);
    canExtract(): boolean;
    extract(): ExtractorResult;
    private getFullHandle;
    private getDisplayName;
    private getReplyDate;
    private getReplyPermalink;
    private getPublishedDate;
    private getDescription;
    private extractPostContent;
    private extractTextContent;
    /** Replace emoji `<img>` tags with their alt text (Unicode emoji or :shortcode:). */
    private replaceEmojiImages;
    private extractImages;
    private extractLinkCard;
    private extractComments;
}

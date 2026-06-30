import { BaseExtractor } from './_base';
import { ExtractorResult } from '../types/extractors';
export declare class LinkedInExtractor extends BaseExtractor {
    private postArticle;
    constructor(document: Document, url: string, schemaOrgData?: any, options?: any);
    canExtract(): boolean;
    extract(): ExtractorResult;
    private getPostContent;
    /**
     * Get visible text from an element, stripping screen-reader duplicates
     * and optionally additional selectors (e.g. badges).
     */
    private getVisibleText;
    private cleanTextContent;
    private extractQuotedPost;
    private extractImages;
    private extractVideo;
    private extractComments;
    private extractCommentData;
    private getAuthorName;
    private createDescription;
}

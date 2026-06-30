import { BaseExtractor, ExtractorOptions } from './_base';
import { ExtractorResult } from '../types/extractors';
export declare class DiscourseExtractor extends BaseExtractor {
    private isDiscourse;
    constructor(document: Document, url: string, schemaOrgData?: any, options?: ExtractorOptions);
    canExtract(): boolean;
    extract(): ExtractorResult;
    private getTopicTitle;
    private getTags;
    private getPublishedDate;
    private getAuthor;
    private getPostDate;
    private getPostPermalink;
    private getLikeCount;
    private getPostText;
    private extractPostContent;
    private extractComments;
}

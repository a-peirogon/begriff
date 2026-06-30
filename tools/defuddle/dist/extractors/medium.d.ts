import { BaseExtractor, ExtractorOptions } from './_base';
import { ExtractorResult } from '../types/extractors';
export declare class MediumExtractor extends BaseExtractor {
    private article;
    constructor(document: Document, url: string, schemaOrgData?: any, options?: ExtractorOptions);
    canExtract(): boolean;
    extract(): ExtractorResult;
    /**
     * Remove Medium UI elements from the article before the standard
     * pipeline processes it. This runs on the live DOM.
     */
    private cleanArticle;
    private getTitle;
    private getSubtitle;
    private getAuthor;
    private getPublication;
    private getDescription;
}

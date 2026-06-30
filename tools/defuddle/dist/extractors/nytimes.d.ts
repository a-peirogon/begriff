import { BaseExtractor } from './_base';
import { ExtractorResult } from '../types/extractors';
export declare class NytimesExtractor extends BaseExtractor {
    private preloadedData;
    private contentSelector;
    constructor(document: Document, url: string, schemaOrgData?: any, options?: any);
    canExtract(): boolean;
    extract(): ExtractorResult;
    private extractPreloadData;
    private renderBlocks;
    private renderInlines;
    private getBestImageUrl;
    private escapeHtml;
    private escapeAttr;
}

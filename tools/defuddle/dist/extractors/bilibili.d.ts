import { BaseExtractor, ExtractorOptions } from './_base';
import { ExtractorResult } from '../types/extractors';
export declare class BilibiliExtractor extends BaseExtractor {
    private static transcriptCache;
    private _bvid;
    constructor(document: Document, url: string, schemaOrgData?: any, options?: ExtractorOptions);
    canExtract(): boolean;
    canExtractAsync(): boolean;
    prefersAsync(): boolean;
    extract(): ExtractorResult;
    extractAsync(): Promise<ExtractorResult>;
    private getBvid;
    private getPageNumber;
    private formatDescription;
    private buildEmbedHtml;
    private buildResult;
    private normalizeLanguageCode;
    private pickSubtitleTrack;
    private fetchViewData;
    private parseSubtitleTracks;
    private fetchPlayerV2;
    private fetchTranscript;
    private normalizeSubtitleUrl;
    private isAllowedSubtitleHost;
    private parseSubtitleJson;
    private groupSubtitleLines;
    private concatTranscriptText;
}

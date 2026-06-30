import { BaseExtractor } from './_base';
import { ExtractorResult } from '../types/extractors';
export declare class LwnExtractor extends BaseExtractor {
    canExtract(): boolean;
    extract(): ExtractorResult;
    private parseDate;
    private getArticleContent;
    private extractComments;
    private getCommentDepth;
    private extractCommentData;
    private getCommentContent;
}

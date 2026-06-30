import { BaseExtractor } from './_base';
import { ExtractorResult } from '../types/extractors';
export declare class XOembedExtractor extends BaseExtractor {
    canExtract(): boolean;
    extract(): ExtractorResult;
    canExtractAsync(): boolean;
    prefersAsync(): boolean;
    extractAsync(): Promise<ExtractorResult>;
    private extractOembed;
    private tryExtractFxTwitter;
    private fetchFxTwitter;
    private toDateString;
    private buildArticleResult;
    private buildTweetResult;
    /**
     * Convert a Unicode code-point index to a UTF-16 code-unit offset.
     * FxTwitter facet indices count code points (emoji = 1) but JavaScript
     * string operations (indexOf, slice, .length) use UTF-16 code units
     * where surrogate-pair emoji count as 2.
     */
    private codePointToUtf16Index;
    /**
     * Adjust FxTwitter facet indices from code-point space to UTF-16 code-unit
     * space so they match JavaScript string offsets. When the text contains no
     * surrogate pairs the indices are unchanged.
     */
    private adjustFacetIndicesToUtf16;
    private renderTweet;
    private applyMarkers;
    private applyFacets;
    private renderArticle;
    private renderBlock;
    private renderAtomicBlock;
    private renderInlineContent;
}

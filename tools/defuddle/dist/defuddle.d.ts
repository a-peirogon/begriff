import { DefuddleOptions, DefuddleResponse } from './types';
export declare class Defuddle {
    private doc;
    private options;
    private debug;
    private _schemaOrgData;
    private _schemaOrgExtracted;
    private _metaTags;
    private _metadata;
    private _mobileStyles;
    private _smallImages;
    private _inExtractorPipelineRun;
    /**
     * Create a new Defuddle instance
     * @param doc - The document to parse
     * @param options - Options for parsing
     */
    constructor(doc: Document, options?: DefuddleOptions);
    /**
     * Lazily extract and cache schema.org data. Must be called before
     * parse() strips script tags from the document.
     */
    private getSchemaOrgData;
    /**
     * Parse the document and extract its main content
     */
    parse(): DefuddleResponse;
    /**
     * Extract text content from schema.org data (e.g. SocialMediaPosting, Article)
     */
    private _getSchemaText;
    /**
     * Serialize the body for the fallback/error paths, where extraction found
     * no content and we return the whole body. Sanitizes a CLONE so the
     * caller's live document is never mutated — stripping elements from the
     * live page (e.g. its <style> blocks) would destroy its layout. The normal
     * extraction pipeline already removes script/style/etc. via EXACT_SELECTORS,
     * so only these raw-body paths need to sanitize here.
     */
    private _serializeFallbackBody;
    /**
     * Remove dangerous elements and attributes from the given body element.
     */
    private _stripUnsafeElements;
    /**
     * Replace base64 placeholder images with real URLs from <noscript> fallbacks.
     * Next.js (data-nimg) renders a tiny base64 gif as src with the real image
     * only inside a <noscript> sibling. This promotes the real URL before
     * noscript elements are stripped.
     */
    /**
     * Remove duplicate images within figures and adjacent elements, keeping
     * the highest resolution version. Handles Reader mode and lazy-loading
     * hydration creating a second copy alongside the original.
     */
    private _deduplicateImages;
    private _keepBestImage;
    /**
     * True when nothing but whitespace and wrapper markup sits between `a` and `b`
     * in document order (`a` must precede `b`). Used to confirm two <img> are a
     * genuine lazy-load duplicate pair rather than distinct images separated by text.
     */
    private _noVisibleContentBetween;
    /** Strip protocol and query string for loose URL comparison. */
    private _normalizeSrc;
    /**
     * Remove the cover/hero image from content when it matches the page's
     * metadata image (og:image). The image is already captured as result.image;
     * keeping it inline duplicates information.
     * Only removes when the image is not inside a figure with a caption
     * (captioned figures are intentional content references).
     * Returns the highest-resolution URL from the image's srcset (if available)
     * so callers can upgrade the metadata image.
     */
    private _removeCoverImage;
    private static _urlWidthPattern;
    private _pickBestImage;
    private static _urlWidth;
    /**
     * Rename non-standard HTML attributes to their canonical lowercase forms.
     * React SSR outputs camelCase attributes like "srcSet" that some DOM
     * parsers (e.g. linkedom) preserve verbatim instead of lowercasing.
     */
    private _normalizeAttributes;
    private _resolveNoscriptImages;
    /**
     * Detect whether a <noscript> is inside a lazy-loading image wrapper
     * (vs. a standalone tracking pixel that should not be promoted).
     */
    private _isLazyImageContext;
    /**
     * Find the smallest DOM element whose text contains the search phrase
     * and whose word count is at least 80% of the expected count.
     * Shared by _findSchemaContentElement and _findContentBySchemaText.
     */
    private _findElementBySchemaText;
    private findLargestHiddenContentSelector;
    /**
     * Get the largest available src from an img element,
     * checking srcset for higher-resolution versions.
     */
    private _getLargestImageSrc;
    /**
     * Parse the document asynchronously. Checks for extractors that prefer
     * async (e.g. YouTube transcripts) before sync, then falls back to async
     * extractors if sync parse yields no content.
     */
    parseAsync(): Promise<DefuddleResponse>;
    /**
     * Fetch only async variables (e.g. transcript) without re-parsing.
     * Safe to call after parse() — uses cached schema.org data since
     * parse() strips script tags from the document.
     */
    fetchAsyncVariables(): Promise<{
        [key: string]: string;
    } | null>;
    private tryAsyncExtractor;
    /**
     * Internal parse method that does the actual work
     */
    private parseInternal;
    private countHtmlWords;
    private _log;
    private _evaluateMediaQueries;
    private applyMobileStyles;
    private removeImages;
    private findMainContent;
    private findTableBasedContent;
    private findContentByScoring;
    private getElementSelector;
    private getComputedStyle;
    private adoptExternalFootnotes;
    /**
     * Resolve relative URLs to absolute within a DOM element
     */
    private resolveRelativeUrls;
    /**
     * Flatten shadow DOM content into a cloned document.
     * Walks both trees in parallel so positional correspondence is exact.
     */
    private flattenShadowRoots;
    /**
     * Resolve React streaming SSR suspense boundaries.
     * React's streaming SSR places content in hidden divs (id="S:0") and
     * template placeholders (id="B:0") with $RC scripts to swap them.
     * Since we don't execute scripts, we perform the swap manually.
     */
    private resolveStreamedContent;
    /**
     * Replace a shadow DOM host element with a div containing its shadow content.
     * Custom elements (tag names with hyphens) would re-initialize when inserted
     * into a live DOM, recreating their shadow roots and hiding the content.
     */
    private replaceShadowHost;
    /**
     * Resolve relative URLs in an HTML string
     */
    private resolveContentUrls;
    private _extractSchemaOrgData;
    private _collectMetaTags;
    private _decodeHTMLEntities;
    /**
     * Build a DefuddleResponse from an extractor result with metadata
     */
    private buildExtractorResponse;
    /**
     * Sanitize and finalize HTML produced by site extractors.
     *
     * Extractors build their output from template-literal strings, so unlike the
     * main pipeline their output never passes through the DOM-based attribute
     * sanitizer. Attacker-controlled attribute values (e.g. an image `alt` or
     * `src` read straight off the page) could otherwise close an attribute and
     * inject an event handler or a `javascript:` URL. Parsing the output into a
     * DOM and running the same `_stripUnsafeElements` pass used elsewhere
     * neutralizes any such injection regardless of which extractor produced it.
     *
     * Relative-URL resolution runs on the same parsed DOM so extractor output is
     * parsed and serialized only once (resolveRelativeUrls no-ops without a URL).
     */
    private _sanitizeExtractorHtml;
    /**
     * Filter extractor variables to only include custom ones
     * (exclude standard fields that are already mapped to top-level properties)
     */
    private getExtractorVariables;
}

export interface MathData {
    mathml: string;
    latex: string | null;
    isBlock: boolean;
}
/**
 * Rebuild a `<math>` element from a MathJax CHTML `mjx-math` render tree.
 * Returns null when there is nothing to recover (e.g. an unrendered
 * `mjx-lazy` placeholder).
 */
export declare const reconstructMathMLFromMjx: (mjxMath: Element, doc: Document) => MathData | null;
export declare const getMathMLFromElement: (el: Element) => MathData | null;
export declare const getBasicLatexFromElement: (el: Element) => string | null;
export declare const isBlockDisplay: (el: Element) => boolean;
export declare const mathFastCheck = "math, mjx-container, .MathJax, .katex, img.latex, [data-math], [data-latex], script[type^=\"math/\"]";
export declare const mathSelectors: string;
export declare const LOOKS_LIKE_LATEX_RE: RegExp;
/**
 * Extract LaTeX from an image src URL by detecting URL-encoded LaTeX commands.
 * Works with any LaTeX rendering service without hardcoding domain names.
 */
export declare function extractLatexFromImageSrc(src: string): string | null;
/**
 * Scan text nodes inside `element` for raw LaTeX delimiters (`$...$`,
 * `$$...$$`, `\(...\)`, `\[...\]`) and wrap each match in a `<math>`
 * element so the existing math pipeline can process them.
 *
 * Only runs when a MathJax or KaTeX script tag is present in the document,
 * to avoid false positives on pages that use `$` for currency.
 */
export declare function wrapRawLatexDelimiters(element: Element, doc: Document): void;

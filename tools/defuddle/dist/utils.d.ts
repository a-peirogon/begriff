export declare function isElement(node: Node): node is Element;
export declare function isTextNode(node: Node): node is Text;
export declare function isCommentNode(node: Node): node is Comment;
export declare function isSVGElement(el: Element): boolean;
export declare function getComputedStyle(element: Element): CSSStyleDeclaration | null;
export declare function getWindow(doc: Document): Window | null;
export declare function textPreview(el: Element): string;
export declare function logDebug(debug: boolean, message: string, ...args: any[]): void;
export declare const CJK_CHAR_RANGES = "\\u3040-\\u309f\\u30a0-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\uac00-\\ud7af";
/**
 * Canonicalize text for title/heading comparison: normalize smart quotes,
 * dashes, ellipses, and whitespace; lowercase. Two strings that humans would
 * read as "the same" should compare equal after this pass.
 */
export declare function normalizeText(text: string): string;
/**
 * Count words in text, handling CJK characters (Chinese, Japanese, Korean).
 * CJK characters are counted individually since they don't use spaces between words.
 * Non-CJK text is counted by splitting on whitespace.
 */
export declare function countWords(text: string): number;

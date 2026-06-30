/**
 * Score-based candidate for "this element is the start of the prose body."
 *
 * Anchor on the title (h1/h2 matching the normalized page title) if present,
 * then walk forward in document order for the first prose-length block — a
 * DOM-shape proxy for "here is where the article actually begins," replacing
 * ad-hoc byte-offset checks like `contentText.indexOf(text) < 300`.
 *
 * Returns `null` when no candidate qualifies; callers should treat that as
 * "no signal" rather than a removal opportunity.
 */
export declare function findContentStart(mainContent: Element, title: string): Element | null;
/**
 * True when `el` is positioned strictly before `boundary` in document order.
 * Safe when `boundary` is null (returns false — treat as "don't know").
 */
export declare function isAboveContentStart(el: Element, boundary: Element | null): boolean;

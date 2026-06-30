import type { DefuddleResponse } from './types';
/**
 * Build a YAML frontmatter block ("---\n…\n---\n\n") from extracted metadata.
 * Shared by the CLI (`--frontmatter`) and the defuddle.md worker so both emit
 * identical output. `source:` is only emitted when a sourceUrl is provided
 * (CLI stdin/file input has no URL).
 */
export declare function buildFrontmatter(result: DefuddleResponse, sourceUrl?: string): string;

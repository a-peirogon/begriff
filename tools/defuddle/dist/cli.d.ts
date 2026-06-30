#!/usr/bin/env node
import { Command } from 'commander';
export interface ParseOptions {
    output?: string;
    markdown?: boolean;
    md?: boolean;
    json?: boolean;
    debug?: boolean;
    property?: string;
    lang?: string;
    userAgent?: string;
    frontmatter?: boolean;
}
interface ParseResult {
    output: string;
}
export declare function readStdin(input?: NodeJS.ReadStream): Promise<string>;
export declare function parseSource(source: string | undefined, options: ParseOptions, input?: NodeJS.ReadStream): Promise<ParseResult>;
export declare function createProgram(): Command;
export {};

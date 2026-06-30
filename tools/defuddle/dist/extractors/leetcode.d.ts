import { BaseExtractor } from './_base';
import { ExtractorResult } from '../types/extractors';
export declare class LeetCodeExtractor extends BaseExtractor {
    canExtract(): boolean;
    extract(): ExtractorResult;
}

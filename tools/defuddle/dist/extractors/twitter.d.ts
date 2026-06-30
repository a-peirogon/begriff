import { BaseExtractor } from './_base';
import { ExtractorResult } from '../types/extractors';
export declare class TwitterExtractor extends BaseExtractor {
    private mainTweet;
    private threadTweets;
    private replyTweets;
    private replyDepths;
    constructor(document: Document, url: string);
    canExtract(): boolean;
    extract(): ExtractorResult;
    private extractComments;
    private getHandle;
    private formatTweetText;
    private replaceEmojiImages;
    private findQuotedTweet;
    private extractTweetContent;
    private extractQuotedTweet;
    private extractUserInfo;
    private extractImages;
    private extractCard;
    private getTweetId;
    private getTweetAuthor;
    private createDescription;
}

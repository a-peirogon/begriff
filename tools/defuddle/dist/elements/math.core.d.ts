import { MathData } from './math.base';
export declare const createCleanMathEl: (mathData: MathData | null, latex: string | null, isBlock: boolean, doc: Document) => Element;
export declare const mathRules: {
    selector: string;
    element: string;
    fastCheck: string;
    transform: (el: Element, doc: Document) => Element;
}[];

import type { Caption, TikTokPage } from "@remotion/captions";

export type Page = { from: number; to: number; start: number; end: number; text: string };
export type FixRule = { from: string[]; to: string[] };

export declare const SWITCH_CAPTIONS_EVERY_MS: number;
export declare function normWord(s: string): string;
export declare function wordsToCaptions(words: { word: string; start: number; end: number; prob?: number }[]): Caption[];
export declare function spreadWords(words: string[], startMs: number, endMs: number): Caption[];
export declare function parseFixRules(text: string): FixRule[];
export declare function applyFixes(captions: Caption[], rules: FixRule[]): Caption[];
export type CaptionPage = TikTokPage & { from: number; to: number };
export declare const MAX_PAGE_CHARS: number;
export declare function keepPhrases(vocab: string | string[]): string[][];
export declare function makePages(captions: Caption[], keep?: string[][]): CaptionPage[];
export declare const ZOOM_SCALE: number;
export declare function zoomMoments(pages: CaptionPage[]): { startMs: number; endMs: number }[];
export declare function numberFlags(texts: string[]): boolean[];
export declare function pageEndMs(pages: CaptionPage[], i: number): number;
export declare function toPages(captions: Caption[], durationSec?: number, keep?: string[][]): Page[];
export declare function replacePageText(captions: Caption[], page: Page, newText: string): Caption[];

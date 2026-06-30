"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BilibiliExtractor = void 0;
const _base_1 = require("./_base");
const dom_1 = require("../utils/dom");
const transcript_1 = require("../utils/transcript");
const FETCH_TIMEOUT_MS = 4000;
const TRANSCRIPT_GROUP_GAP_SECONDS = 20;
const TRANSCRIPT_MAX_GROUP_SECONDS = 30;
const HAN_CHAR = /[\u4E00-\u9FFF]/;
class BilibiliExtractor extends _base_1.BaseExtractor {
    constructor(document, url, schemaOrgData, options) {
        super(document, url, schemaOrgData, options);
    }
    canExtract() {
        return !!this.getBvid();
    }
    canExtractAsync() {
        return this.canExtract();
    }
    prefersAsync() {
        return true;
    }
    extract() {
        return this.buildResult();
    }
    async extractAsync() {
        const bvid = this.getBvid();
        if (!bvid)
            return this.buildResult();
        const view = await this.fetchViewData(bvid);
        if (!view)
            return this.buildResult();
        const { aid, pages = [] } = view;
        const pageNumber = this.getPageNumber();
        const pageInfo = (pages.length > 0 ? (pages[pageNumber - 1] ?? pages[0]) : undefined);
        const cid = pageInfo?.cid;
        const preferredLang = this.normalizeLanguageCode(this.options.language);
        const cacheKey = (aid && cid) ? `${bvid}:${cid}:${preferredLang}` : '';
        let transcript;
        if (aid && cid) {
            if (cacheKey && BilibiliExtractor.transcriptCache.has(cacheKey)) {
                const cached = BilibiliExtractor.transcriptCache.get(cacheKey);
                transcript = cached ?? undefined;
            }
            else {
                transcript = await this.fetchTranscript(aid, cid, bvid);
                if (cacheKey) {
                    BilibiliExtractor.transcriptCache.set(cacheKey, transcript ?? null);
                    if (BilibiliExtractor.transcriptCache.size > 300) {
                        const firstKey = BilibiliExtractor.transcriptCache.keys().next().value;
                        if (firstKey)
                            BilibiliExtractor.transcriptCache.delete(firstKey);
                    }
                }
            }
        }
        return this.buildResult(transcript, view, pageInfo, pageNumber);
    }
    getBvid() {
        if (this._bvid !== undefined)
            return this._bvid;
        try {
            const url = new URL(this.url);
            const match = url.pathname.match(/\/video\/(BV[0-9A-Za-z]+)\/?/);
            this._bvid = match?.[1] ?? '';
        }
        catch {
            this._bvid = '';
        }
        return this._bvid;
    }
    getPageNumber() {
        try {
            const url = new URL(this.url);
            const p = parseInt(new URLSearchParams(url.search).get('p') || '1', 10);
            return Number.isFinite(p) && p > 0 ? p : 1;
        }
        catch {
            return 1;
        }
    }
    formatDescription(desc) {
        const safe = (0, dom_1.escapeHtml)(desc).replace(/\n/g, '<br>');
        return safe ? `<p>${safe}</p>` : '';
    }
    buildEmbedHtml(bvid, pageNumber) {
        const src = `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bvid)}&page=${pageNumber}&high_quality=1&danmaku=0`;
        return `<iframe width="560" height="315" src="${src}" title="Bilibili video player" frameborder="0" allowfullscreen></iframe>`;
    }
    buildResult(transcript, view, pageInfo, pageNumber) {
        const bvid = this.getBvid();
        const title = view?.title || this.document.title || '';
        const author = view?.owner?.name || '';
        const desc = view?.desc || '';
        const description = desc.slice(0, 200).trim();
        const image = view?.pic || '';
        const published = view?.pubdate ? new Date(view.pubdate * 1000).toISOString() : '';
        let contentHtml = '';
        if (bvid) {
            contentHtml += this.buildEmbedHtml(bvid, pageNumber || this.getPageNumber());
        }
        if (desc) {
            contentHtml += this.formatDescription(desc);
        }
        if (transcript?.html) {
            contentHtml += transcript.html;
        }
        const variables = {
            title,
            author,
            site: 'Bilibili',
            image,
            published,
            description,
        };
        if (pageInfo?.part) {
            variables.part = pageInfo.part;
        }
        if (transcript?.text) {
            variables.transcript = transcript.text;
        }
        if (transcript?.languageCode) {
            variables.language = transcript.languageCode;
        }
        return {
            content: contentHtml,
            contentHtml,
            extractedContent: {
                videoId: bvid,
                ...(pageInfo?.cid ? { cid: String(pageInfo.cid) } : {}),
            },
            variables,
        };
    }
    normalizeLanguageCode(code) {
        return (code || '').trim().replace(/_/g, '-').toLocaleLowerCase();
    }
    pickSubtitleTrack(tracks, preferredLang) {
        if (tracks.length === 0)
            return undefined;
        const pref = this.normalizeLanguageCode(preferredLang);
        const prefBase = pref ? pref.split('-')[0] : '';
        const stableUrlKey = (u) => {
            const input = (u || '').trim();
            if (!input)
                return '';
            try {
                const normalized = input.startsWith('//') ? `https:${input}` : input;
                const parsed = new URL(normalized);
                return `${parsed.hostname.toLocaleLowerCase()}${parsed.pathname}`;
            }
            catch {
                return input.split('?')[0].split('#')[0];
            }
        };
        const normalizeDoc = (doc) => (doc || '').trim().toLocaleLowerCase();
        const isLikelyAiDoc = (doc) => {
            const d = normalizeDoc(doc);
            return d.includes('ai') || d.includes('auto') || d.includes('自动');
        };
        const langPriority = (code) => {
            // Stable language preference when no explicit language provided.
            if (code === 'zh-cn' || code === 'zh-hans')
                return 0;
            if (code === 'zh')
                return 1;
            if (code.startsWith('zh-'))
                return 2;
            if (code === 'en' || code.startsWith('en-'))
                return 3;
            return 4;
        };
        const ranked = tracks
            .map((t, index) => {
            const code = this.normalizeLanguageCode(t.lan);
            let prefScore = 3;
            if (pref) {
                if (code === pref)
                    prefScore = 0;
                else if (prefBase && code === prefBase)
                    prefScore = 1;
                else if (prefBase && code.split('-')[0] === prefBase)
                    prefScore = 2;
            }
            const aiScore = t.is_ai_subtitle || isLikelyAiDoc(t.lan_doc) ? 1 : 0;
            const lp = langPriority(code);
            const id = typeof t.id === 'number' ? t.id : Number.MAX_SAFE_INTEGER;
            const doc = normalizeDoc(t.lan_doc);
            const urlKey = stableUrlKey(t.subtitle_url);
            return { t, prefScore, aiScore, lp, id, doc, urlKey, index };
        })
            .sort((a, b) => {
            if (a.prefScore !== b.prefScore)
                return a.prefScore - b.prefScore;
            if (a.aiScore !== b.aiScore)
                return a.aiScore - b.aiScore;
            if (a.lp !== b.lp)
                return a.lp - b.lp;
            if (a.id !== b.id)
                return a.id - b.id;
            if (a.doc !== b.doc)
                return a.doc.localeCompare(b.doc);
            if (a.urlKey !== b.urlKey)
                return a.urlKey.localeCompare(b.urlKey);
            return a.index - b.index;
        });
        return ranked[0]?.t;
    }
    async fetchViewData(bvid) {
        try {
            const url = `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`;
            const response = await this.fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (compatible; Defuddle/1.0)',
                },
                credentials: 'include',
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            });
            if (!response.ok)
                return undefined;
            const json = await response.json();
            if (json?.code !== 0)
                return undefined;
            return json.data;
        }
        catch {
            return undefined;
        }
    }
    parseSubtitleTracks(json) {
        const candidates = [
            json?.data?.subtitle?.subtitles,
            json?.data?.subtitle?.list,
            json?.data?.subtitle?.tracks,
        ];
        for (const cand of candidates) {
            if (!Array.isArray(cand))
                continue;
            return cand
                .map((t) => ({
                lan: String(t?.lan ?? t?.lang ?? t?.language ?? ''),
                lan_doc: t?.lan_doc ? String(t.lan_doc) : undefined,
                subtitle_url: String(t?.subtitle_url ?? t?.subtitleUrl ?? t?.url ?? ''),
                id: typeof t?.id === 'number' ? t.id : (typeof t?.subtitle_id === 'number' ? t.subtitle_id : undefined),
                is_ai_subtitle: typeof t?.is_ai_subtitle === 'boolean'
                    ? t.is_ai_subtitle
                    : (typeof t?.ai_type === 'number' ? t.ai_type > 0 : undefined),
            }))
                .filter((t) => !!t.lan && !!t.subtitle_url);
        }
        return [];
    }
    async fetchPlayerV2(url) {
        const response = await this.fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (compatible; Defuddle/1.0)',
            },
            credentials: 'include',
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!response.ok) {
            return { tracks: [], code: response.status, message: `http_${response.status}` };
        }
        const json = await response.json();
        const code = typeof json?.code === 'number' ? json.code : undefined;
        const message = typeof json?.message === 'string' ? json.message : undefined;
        if (code !== 0) {
            return { tracks: [], code, message };
        }
        return { tracks: this.parseSubtitleTracks(json), code, message };
    }
    async fetchTranscript(aid, cid, bvid) {
        try {
            // Deterministic API order to minimize drift across repeated extraction:
            // 1) wbi/v2 (most complete), 2) v2 with bvid+cid, 3) v2 with aid+cid.
            const urlWbi = `https://api.bilibili.com/x/player/wbi/v2?bvid=${encodeURIComponent(String(bvid))}&aid=${encodeURIComponent(String(aid))}&cid=${encodeURIComponent(String(cid))}`;
            const urlBvid = `https://api.bilibili.com/x/player/v2?bvid=${encodeURIComponent(String(bvid))}&cid=${encodeURIComponent(String(cid))}`;
            const urlAid = `https://api.bilibili.com/x/player/v2?aid=${encodeURIComponent(String(aid))}&cid=${encodeURIComponent(String(cid))}`;
            let tracks = [];
            const first = await this.fetchPlayerV2(urlWbi);
            tracks = first.tracks;
            if (tracks.length === 0) {
                const second = await this.fetchPlayerV2(urlBvid);
                tracks = second.tracks;
                if (tracks.length === 0) {
                    const third = await this.fetchPlayerV2(urlAid);
                    tracks = third.tracks;
                }
            }
            if (!Array.isArray(tracks) || tracks.length === 0) {
                return undefined;
            }
            const picked = this.pickSubtitleTrack(tracks, this.options.language);
            if (!picked?.subtitle_url) {
                return undefined;
            }
            const subtitleUrl = this.normalizeSubtitleUrl(picked.subtitle_url);
            if (!subtitleUrl) {
                return undefined;
            }
            if (!this.isAllowedSubtitleHost(subtitleUrl)) {
                return undefined;
            }
            const subtitleResponse = await this.fetch(subtitleUrl.toString(), {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (compatible; Defuddle/1.0)',
                },
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            });
            if (!subtitleResponse.ok) {
                return undefined;
            }
            const subtitleJson = await subtitleResponse.json();
            const transcript = this.parseSubtitleJson(subtitleJson);
            if (!transcript) {
                return undefined;
            }
            return { ...transcript, languageCode: picked.lan };
        }
        catch {
            return undefined;
        }
    }
    normalizeSubtitleUrl(url) {
        try {
            const trimmed = (url || '').trim();
            if (!trimmed)
                return null;
            // bilibili often returns protocol-relative URLs: //i0.hdslb.com/...
            const normalized = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
            const parsed = new URL(normalized);
            if (parsed.protocol !== 'https:')
                return null;
            return parsed;
        }
        catch {
            return null;
        }
    }
    isAllowedSubtitleHost(url) {
        const host = url.hostname.toLocaleLowerCase();
        return host.endsWith('.hdslb.com') || host.endsWith('.bilibili.com');
    }
    parseSubtitleJson(json) {
        const lines = Array.isArray(json?.body) ? json.body : [];
        const cleaned = lines
            .map(l => ({
            start: typeof l.from === 'number' ? l.from : NaN,
            end: typeof l.to === 'number' ? l.to : (typeof l.from === 'number' ? l.from : NaN),
            text: (l.content || '').trim(),
        }))
            .filter(l => Number.isFinite(l.start) && l.text.length > 0)
            .sort((a, b) => a.start - b.start);
        if (cleaned.length === 0)
            return undefined;
        const segments = this.groupSubtitleLines(cleaned);
        const { html, text } = (0, transcript_1.buildTranscript)('bilibili', segments);
        return { html, text };
    }
    groupSubtitleLines(lines) {
        const groups = [];
        let currentStart = lines[0].start;
        let currentEnd = lines[0].end;
        let currentText = lines[0].text;
        const flush = () => {
            const normalized = currentText.replace(/\s+/g, ' ').trim();
            if (!normalized)
                return;
            groups.push({
                start: Math.max(0, Math.floor(currentStart)),
                text: normalized,
                speakerChange: groups.length > 0,
            });
        };
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const gap = line.start - currentEnd;
            const span = Math.max(line.end, line.start) - currentStart;
            const shouldSplit = gap > TRANSCRIPT_GROUP_GAP_SECONDS || span > TRANSCRIPT_MAX_GROUP_SECONDS;
            if (shouldSplit) {
                flush();
                currentStart = line.start;
                currentEnd = line.end;
                currentText = line.text;
                continue;
            }
            currentText = this.concatTranscriptText(currentText, line.text);
            currentEnd = Math.max(currentEnd, line.end);
        }
        flush();
        return groups;
    }
    concatTranscriptText(prev, next) {
        const a = (prev || '').trimEnd();
        const b = (next || '').trimStart();
        if (!a)
            return b;
        if (!b)
            return a;
        const aLast = a[a.length - 1];
        const bFirst = b[0];
        const aHan = HAN_CHAR.test(aLast);
        const bHan = HAN_CHAR.test(bFirst);
        if (aHan && bHan)
            return a + b;
        const aAlnum = /[A-Za-z0-9]$/.test(a);
        const bAlnum = /^[A-Za-z0-9]/.test(b);
        if (aAlnum && bAlnum)
            return `${a} ${b}`;
        return `${a} ${b}`;
    }
}
exports.BilibiliExtractor = BilibiliExtractor;
BilibiliExtractor.transcriptCache = new Map();
//# sourceMappingURL=bilibili.js.map
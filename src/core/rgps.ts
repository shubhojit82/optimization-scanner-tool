/**
 * Retrieval-Grade Passage Standard (RGPS) v3.6.0
 *
 * Scores a passage (or the dominant passage of a page) on the 12 dimensions
 * that determine whether an AI engine can lift it, match it, and cite it.
 *
 * Scoring:
 *   - 25 total points spread across 12 dimensions
 *   - R1–R9 are MANDATORY — a zero on any mandatory dimension fails the passage
 *   - R3, R6, R7 carry 1.5× weight (3 pts each instead of 2)
 *   - S6–S8 are SCORED RECOMMENDATIONS (1 pt each, no mandatory penalty)
 *   - Pass bar: 17 (general content), 19 (YMYL — health/money)
 *
 * Pure function — no I/O, no external dependencies.
 */

export const RGPS_VERSION = 'rgps/3.6.0';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RgpsDimId =
    | 'R1' | 'R2' | 'R3' | 'R4' | 'R5'
    | 'R6' | 'R7' | 'R8' | 'R9'
    | 'S6' | 'S7' | 'S8';

export type RgpsStep = 1 | 2 | 3;

export type RgpsDimensionResult = {
    id: RgpsDimId;
    name: string;
    step: RgpsStep;
    mandatory: boolean;
    weight: number;         // max points this dimension can contribute
    score: number;          // 0..weight (integer)
    passed: boolean;        // true if score > 0 (or not mandatory)
    evidence: string;       // what was found
    action: string | null;  // remediation hint if score < weight
};

export type RgpsResult = {
    version: string;
    total: number;           // 0..25 raw point total
    passBar: number;         // 17 (general) or 19 (YMYL)
    passed: boolean;         // total >= passBar AND no mandatory zero
    ymyl: boolean;           // was YMYL threshold applied
    mandatoryFail: RgpsDimId | null;  // first mandatory dimension that scored 0
    dimensions: RgpsDimensionResult[];
    stepScores: { step: 1; max: 8; score: number } |
                { step: 2; max: 11; score: number } |
                { step: 3; max: 6; score: number };
    stepBreakdown: [
        { step: 1; label: string; max: 8; score: number },
        { step: 2; label: string; max: 11; score: number },
        { step: 3; label: string; max: 6; score: number },
    ];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip tags and collapse whitespace from an HTML snippet. */
export function rgpsExtractText(html: string): string {
    return html
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function sentences(text: string): string[] {
    return text.match(/[^.!?]+[.!?]+/g) ?? [];
}

function words(text: string): string[] {
    return text.toLowerCase().match(/\b[a-z']{2,}\b/g) ?? [];
}

function avgWordsPerSentence(text: string): number {
    const sents = sentences(text);
    if (!sents.length) return 0;
    const total = sents.reduce((n, s) => n + words(s).length, 0);
    return total / sents.length;
}

/** Count pronoun forms that create cross-passage dependency. */
function countDependentPronouns(text: string): number {
    const pronouns = /\b(this|that|these|those|it|they|them|their|he|she|above|below|following|mentioned)\b/gi;
    return (text.match(pronouns) ?? []).length;
}

/** Count adjective stacking (3+ adjectives before a noun — stray modifiers). */
function hasStackedModifiers(text: string): boolean {
    // simple heuristic: 3+ commas or conjunctions joining adjectives before a noun
    return /(?:\w+,\s*){2,}\w+\s+\w+/.test(text);
}

/** Detect "as of [date]" or ISO-like date mentions near freshness-sensitive terms. */
function hasFreshnessSignal(text: string): boolean {
    return /\bas of\b|\bupdated\b|\blast (updated|reviewed|modified)\b|\b\d{4}\b/.test(text);
}

/** Detect source/trust signals: citations, footnotes, official source references. */
function hasTrustSignal(html: string): boolean {
    // <cite>, <blockquote cite=...>, footnote patterns, "according to", "source:"
    if (/<cite\b/i.test(html)) return true;
    if (/according to\b/i.test(html)) return true;
    if (/\bsource:/i.test(html)) return true;
    if (/\[\d+\]/.test(html)) return true;            // footnote refs [1]
    if (/<a\b[^>]+href=[^>]+>\s*\[\d+\]\s*<\/a>/i.test(html)) return true;
    return false;
}

/** Pull out first heading from HTML. */
function firstHeading(html: string): string {
    const m = html.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i);
    if (!m) return '';
    return m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Pull first 1–2 sentences after the heading. */
function openingSentences(text: string, count = 2): string {
    return (sentences(text).slice(0, count)).join(' ');
}

/** Check if text contains entity-defining pattern: "X is a/an ...", "X: ...", "X refers to". */
function hasEntityDefinition(text: string): boolean {
    return /\b\w[\w\s]{1,40}\b (is|are|refers? to|describes?|means?)\b/i.test(text);
}

/** Heuristic for semantic density: counts specifics (numbers, % , $, named entities). */
function semanticDensityScore(text: string): number {
    let score = 0;
    if (/\d+(\.\d+)?%/.test(text)) score++;                      // percentages
    if (/\$[\d,]+|\d+[\s]?(USD|EUR|GBP)/.test(text)) score++;    // monetary
    if (/\b(because|since|therefore|as a result|due to|which means)\b/i.test(text)) score++;  // causal
    if (/\b\d{4}\b/.test(text)) score++;                          // years
    if (/\b(v\d|version \d|\d+\.\d+|\b[A-Z]{2,5}\b)/.test(text)) score++;  // versions/acronyms
    return score;
}

// ── Main scorer ───────────────────────────────────────────────────────────────

/**
 * Score a single passage (dominant passage or full page text extracted from HTML).
 *
 * @param html   Raw HTML of the page or passage.
 * @param ymyl   True for YMYL content (health / money) — raises pass bar to 19.
 */
export function scorePassage(html: string, ymyl = false): RgpsResult {
    const text = rgpsExtractText(html);
    const heading = firstHeading(html);
    const opening = openingSentences(text);
    const awps = avgWordsPerSentence(text);
    const passBar = ymyl ? 19 : 17;

    // ── R1: Atomic intent ─ 2 pts ─────────────────────────────────────────────
    // One question per passage, answered once. Proxy: single H2/H3 per logical block;
    // no more than one question-mark heading; body stays on the stated topic.
    const headingCount = (html.match(/<h[2-3]\b/gi) ?? []).length;
    const questionHeadings = (html.match(/<h[2-3]\b[^>]*>[^<]*\?[^<]*<\/h[2-3]>/gi) ?? []).length;
    const r1Score = headingCount <= 2 && questionHeadings <= 1 ? 2
        : headingCount <= 4 ? 1
        : 0;
    const r1: RgpsDimensionResult = {
        id: 'R1', name: 'Atomic intent', step: 1, mandatory: true, weight: 2,
        score: r1Score, passed: r1Score > 0,
        evidence: `${headingCount} sub-heading(s) in passage; ${questionHeadings} question heading(s)`,
        action: r1Score < 2 ? 'Split passage so each H2/H3 block answers exactly one question.' : null,
    };

    // ── R2: Standalone meaning ─ 2 pts ────────────────────────────────────────
    // Reads on its own: no "this", "above", stray pronouns.
    const depPronouns = countDependentPronouns(text);
    const r2Score = depPronouns === 0 ? 2 : depPronouns <= 2 ? 1 : 0;
    const r2: RgpsDimensionResult = {
        id: 'R2', name: 'Standalone meaning', step: 1, mandatory: true, weight: 2,
        score: r2Score, passed: r2Score > 0,
        evidence: `${depPronouns} dependent pronoun(s) found`,
        action: r2Score < 2 ? 'Replace "this", "above", "they" etc. with explicit noun phrases so the passage reads independently.' : null,
    };

    // ── R3: Answer-first ─ 3 pts (1.5×) ──────────────────────────────────────
    // First 1–2 sentences answer the heading. Proxy: heading keyword appears in opening.
    const headingWords = words(heading);
    const openingWords = new Set(words(opening));
    const headingOverlap = headingWords.filter(w => w.length > 3 && openingWords.has(w)).length;
    const openingLen = opening.length;
    const r3Score = headingOverlap >= 2 && openingLen > 20 ? 3
        : headingOverlap >= 1 && openingLen > 10 ? 2
        : openingLen > 10 ? 1
        : 0;
    const r3: RgpsDimensionResult = {
        id: 'R3', name: 'Answer-first', step: 2, mandatory: true, weight: 3,
        score: r3Score, passed: r3Score > 0,
        evidence: `Opening: "${opening.slice(0, 100)}…" — ${headingOverlap} heading keyword(s) in first sentences`,
        action: r3Score < 3 ? 'Put the direct answer in the first 1–2 sentences directly under the heading.' : null,
    };

    // ── R4: Declarative snippability ─ 2 pts ─────────────────────────────────
    // Short, declarative claims — one fact per sentence.
    const longSents = sentences(text).filter(s => words(s).length > 30).length;
    const totalSents = sentences(text).length;
    const r4Score = longSents === 0 && totalSents > 0 ? 2
        : longSents <= 1 ? 1
        : 0;
    const r4: RgpsDimensionResult = {
        id: 'R4', name: 'Declarative snippability', step: 1, mandatory: true, weight: 2,
        score: r4Score, passed: r4Score > 0,
        evidence: `${longSents} sentences over 30 words; ${totalSents} total sentences`,
        action: r4Score < 2 ? 'Break long sentences into short declarative claims — one fact per sentence.' : null,
    };

    // ── R5: Low syntactic complexity ─ 2 pts ──────────────────────────────────
    // No nested clauses or stacked modifiers.
    const stacked = hasStackedModifiers(text);
    const r5Score = !stacked && awps < 20 ? 2 : !stacked || awps < 25 ? 1 : 0;
    const r5: RgpsDimensionResult = {
        id: 'R5', name: 'Low syntactic complexity', step: 1, mandatory: true, weight: 2,
        score: r5Score, passed: r5Score > 0,
        evidence: `Avg ${awps.toFixed(1)} words/sentence; stacked modifiers: ${stacked}`,
        action: r5Score < 2 ? 'Simplify sentences — remove nested clauses and trim modifier chains.' : null,
    };

    // ── R6: Entity clarity ─ 3 pts (1.5×) ────────────────────────────────────
    // Names and defines the brand, product or concept with its scope.
    const hasEntityDef = hasEntityDefinition(text);
    const entityCount = (text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) ?? []).length;
    const r6Score = hasEntityDef && entityCount >= 2 ? 3
        : hasEntityDef ? 2
        : entityCount >= 1 ? 1
        : 0;
    const r6: RgpsDimensionResult = {
        id: 'R6', name: 'Entity clarity', step: 2, mandatory: true, weight: 3,
        score: r6Score, passed: r6Score > 0,
        evidence: `Entity definition found: ${hasEntityDef}; named entity count: ${entityCount}`,
        action: r6Score < 3 ? 'Add an explicit definition — "X is a [category] that…" — near the first mention of the main entity.' : null,
    };

    // ── R7: Semantic density ─ 3 pts (1.5×) ──────────────────────────────────
    // Mechanisms, conditions, specifics — not adjectives.
    const density = semanticDensityScore(text);
    const r7Score = density >= 3 ? 3 : density >= 2 ? 2 : density >= 1 ? 1 : 0;
    const r7: RgpsDimensionResult = {
        id: 'R7', name: 'Semantic density', step: 2, mandatory: true, weight: 3,
        score: r7Score, passed: r7Score > 0,
        evidence: `Density signals: ${density}/5 (percentages, monetary values, causal connectors, years, versions)`,
        action: r7Score < 3 ? 'Replace vague adjectives with specific mechanisms, conditions, numbers or causal connectors.' : null,
    };

    // ── R8: Heading/query alignment ─ 2 pts ───────────────────────────────────
    // The heading is a question a real person asks.
    const headingIsQuestion = /\?$/.test(heading.trim());
    const headingHasKeywords = headingWords.length >= 3;
    const r8Score = headingIsQuestion && headingHasKeywords ? 2
        : headingHasKeywords ? 1
        : heading.length > 0 ? 1
        : 0;
    const r8: RgpsDimensionResult = {
        id: 'R8', name: 'Heading/query alignment', step: 2, mandatory: true, weight: 2,
        score: r8Score, passed: r8Score > 0,
        evidence: `Heading: "${heading.slice(0, 80)}"; is question: ${headingIsQuestion}`,
        action: r8Score < 2 ? 'Rewrite the heading as the exact question a user would type, ending with "?".' : null,
    };

    // ── R9: No conflicting duplicates ─ 2 pts ─────────────────────────────────
    // One answer per question across the site, never two that disagree.
    // From single-page HTML we can only check within-page duplication.
    const headings = (html.match(/<h[2-3]\b[^>]*>([\s\S]*?)<\/h[2-3]>/gi) ?? [])
        .map(h => h.replace(/<[^>]+>/g, '').toLowerCase().trim());
    const uniqueHeadings = new Set(headings);
    const dupHeadings = headings.length - uniqueHeadings.size;
    const r9Score = dupHeadings === 0 ? 2 : dupHeadings === 1 ? 1 : 0;
    const r9: RgpsDimensionResult = {
        id: 'R9', name: 'No conflicting duplicates', step: 3, mandatory: true, weight: 2,
        score: r9Score, passed: r9Score > 0,
        evidence: `${headings.length} headings; ${dupHeadings} duplicate heading(s) detected`,
        action: r9Score < 2 ? 'Remove or merge duplicate headings — each question should be answered once.' : null,
    };

    // ── S6: Content-answer fit ─ 1 pt ─────────────────────────────────────────
    // Follows the shape AI engines already use to answer that question.
    // Proxy: contains a list, table, or step-by-step structure.
    const hasStructure = /<(ul|ol|table|dl)\b/i.test(html);
    const s6Score = hasStructure ? 1 : 0;
    const s6: RgpsDimensionResult = {
        id: 'S6', name: 'Content-answer fit', step: 3, mandatory: false, weight: 1,
        score: s6Score, passed: true,  // not mandatory
        evidence: `Structured content (list/table): ${hasStructure}`,
        action: s6Score < 1 ? 'Use a list, table or numbered steps to match the format AI engines prefer for this query type.' : null,
    };

    // ── S7: Freshness signals ─ 1 pt ──────────────────────────────────────────
    // Time-sensitive facts carry an "as of" date.
    const freshness = hasFreshnessSignal(text);
    const s7Score = freshness ? 1 : 0;
    const s7: RgpsDimensionResult = {
        id: 'S7', name: 'Freshness signals', step: 3, mandatory: false, weight: 1,
        score: s7Score, passed: true,
        evidence: `"As of" date or year found: ${freshness}`,
        action: s7Score < 1 ? 'Add an "as of [month year]" marker near time-sensitive claims.' : null,
    };

    // ── S8: Trust signals ─ 1 pt ──────────────────────────────────────────────
    // Claims carry their source or a way to verify them.
    const trust = hasTrustSignal(html);
    const s8Score = trust ? 1 : 0;
    const s8: RgpsDimensionResult = {
        id: 'S8', name: 'Trust signals', step: 3, mandatory: false, weight: 1,
        score: s8Score, passed: true,
        evidence: `Citation/source detected: ${trust}`,
        action: s8Score < 1 ? 'Add a <cite> tag, footnote reference [1], or "according to [source]" to support key claims.' : null,
    };

    // ── Aggregate ─────────────────────────────────────────────────────────────

    const dimensions = [r1, r2, r3, r4, r5, r6, r7, r8, r9, s6, s7, s8];

    const total = dimensions.reduce((n, d) => n + d.score, 0);

    const mandatoryFail = dimensions
        .filter(d => d.mandatory && d.score === 0)
        .map(d => d.id as RgpsDimId)[0] ?? null;

    const passed = mandatoryFail === null && total >= passBar;

    const step1Score = [r1, r2, r4, r5].reduce((n, d) => n + d.score, 0);
    const step2Score = [r3, r6, r7, r8].reduce((n, d) => n + d.score, 0);
    const step3Score = [r9, s6, s7, s8].reduce((n, d) => n + d.score, 0);

    return {
        version: RGPS_VERSION,
        total,
        passBar,
        passed,
        ymyl,
        mandatoryFail,
        dimensions,
        stepScores: { step: 1, max: 8, score: step1Score },
        stepBreakdown: [
            { step: 1, label: 'Lift it out cleanly', max: 8, score: step1Score },
            { step: 2, label: 'Match it to the question', max: 11, score: step2Score },
            { step: 3, label: 'Trust it and cite it', max: 6, score: step3Score },
        ],
    };
}

/** Detect YMYL category from URL or page text. */
export function isYmyl(url: string, text: string): boolean {
    const u = url.toLowerCase();
    if (/\/(health|medical|insurance|finance|investment|loan|mortgage|tax|legal|law)\b/.test(u)) return true;
    const lower = text.toLowerCase();
    const ymylTerms = ['insurance', 'diagnosis', 'treatment', 'invest', 'mortgage', 'legal advice', 'tax return'];
    return ymylTerms.filter(t => lower.includes(t)).length >= 2;
}

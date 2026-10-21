/**
 * Page-level question mapping — pure function, no I/O.
 * Implements P0 features: cnt-1 (identify questions answered by a page)
 *                         cnt-2 (find topic and question coverage gaps)
 */

export type QuestionMatch = {
    prompt: string;
    intent: string;
    answered: boolean;         // does the page materially address this question?
    confidence: 'high' | 'medium' | 'low';
    matchedTerms: string[];    // which key terms from the prompt appear on the page
    missingTerms: string[];    // key terms absent from the page
    evidence: string;          // short excerpt from the page that matched, or empty
};

export type QuestionMappingResult = {
    answeredCount: number;
    gapCount: number;
    coveragePct: number;       // 0-100
    questions: QuestionMatch[];
    topGaps: string[];         // top 5 unanswered questions
};

/** Extract keywords from a prompt, removing stop words */
function keywords(text: string): string[] {
    const STOPS = new Set(['what','is','the','a','an','how','why','when','where','who','does','do','can','will','are','be','to','of','in','for','on','with','at','by','from','up','about','into','through','during','before','after','above','below','between','out','off','over','under','again','then','once','that','this','these','those','which','their','our','your','my','its','has','have','had','was','were','would','could','should','may','might','must','shall','being','been','get','got','getting','let','just','now','here','there','so','and','or','but','if','as','it','they','we','you','he','she','him','her','them','us','me','i']);
    return text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOPS.has(w));
}

/**
 * Check how well a page's visible text answers a set of questions.
 * pageText: stripped visible text (no HTML tags)
 * questions: [{intent, prompt}] from queryUniverse()
 */
export function mapQuestionsToPage(
    pageText: string,
    questions: {intent: string; prompt: string}[]
): QuestionMappingResult {
    const lowerPage = pageText.toLowerCase();

    const mapped = questions.map(q => {
        const kws = keywords(q.prompt);
        if (kws.length === 0) {
            return {prompt: q.prompt, intent: q.intent, answered: false, confidence: 'low' as const, matchedTerms: [], missingTerms: [], evidence: ''};
        }

        const matched: string[] = [];
        const missing: string[] = [];

        for (const kw of kws) {
            if (lowerPage.includes(kw)) matched.push(kw);
            else missing.push(kw);
        }

        const matchRatio = matched.length / kws.length;
        const answered = matchRatio >= 0.6;
        const confidence: 'high' | 'medium' | 'low' =
            matchRatio >= 0.8 ? 'high' :
            matchRatio >= 0.5 ? 'medium' : 'low';

        // Find a short passage that contains the most matched terms
        let evidence = '';
        if (answered && matched.length > 0) {
            const idx = lowerPage.indexOf(matched[0]);
            if (idx !== -1) {
                const start = Math.max(0, idx - 60);
                const end = Math.min(pageText.length, idx + 140);
                evidence = '…' + pageText.slice(start, end).replace(/\s+/g, ' ').trim() + '…';
            }
        }

        return {prompt: q.prompt, intent: q.intent, answered, confidence, matchedTerms: matched, missingTerms: missing, evidence};
    });

    const answeredCount = mapped.filter(q => q.answered).length;
    const gapCount = mapped.length - answeredCount;
    const coveragePct = mapped.length ? Math.round((answeredCount / mapped.length) * 100) : 0;
    const topGaps = mapped.filter(q => !q.answered).slice(0, 5).map(q => q.prompt);

    return {answeredCount, gapCount, coveragePct, questions: mapped, topGaps};
}

export type Client = {
    id: string;
    name: string;
    brandAliases?: string[];
    updated?: string;
    domain: string;
    industry: string;
    products: string[];
    competitors: string[];
    market: string;
    created: string;
    monthlyBudgetUsd?: number;   // ops-6/cst-2: optional monthly AI spend cap in USD
};
export type DimensionItem = {
    label: string;
    value: string;
    status: 'ok' | 'warn' | 'fail' | 'info';
    table?: {headers: string[]; rows: string[][]};
};
export type DimensionDetail = {
    found: string[];      // things present and correct
    missing: string[];    // things absent that should be there
    items: DimensionItem[]; // attribute-level breakdown
    table?: {headers: string[]; rows: string[][]};
};
export type Dimension = {
    id: string;
    name: string;
    weight: number;
    score: number | null;
    evidence: string;
    action: string;
    details?: DimensionDetail;
};
export type SubScores = {seoScore: number | null; aeoScore: number | null; geoScore: number | null};

// --- AI Visibility / Probe types ---
export type ProbeSentiment = 'positive' | 'neutral' | 'negative' | 'absent';

export type ProbeResult = {
    engine: string;       // 'openai' | 'gemini' | 'perplexity'
    model: string;
    prompt: string;
    response: string;
    brandMentioned: boolean;
    sentiment: ProbeSentiment;
    sentimentReason: string;
    citations: string[];
    citesClientDomain: boolean;
    competitorsMentioned: string[];  // which competitors appear in response
    probedAt: string;     // ISO
    tokenCount?: number;             // total tokens used (prompt + completion)
    estimatedCostUsd?: number;       // estimated cost in USD for this probe
};

export type ProbeRun = {
    id: string;
    clientId: string;
    created: string;
    prompts: string[];
    results: ProbeResult[];
    // Aggregate KPIs
    mentionRate: number | null;         // % prompts where brand is mentioned
    citationRate: number | null;        // % prompts where client domain is cited
    sentimentBreakdown: {positive: number; neutral: number; negative: number; absent: number};
    shareOfVoice: {competitor: string; mentionRate: number}[];  // competitor vs brand
    citingSources: {domain: string; count: number}[];           // top citing domains across responses
    engines: string[];
    totalTokens?: number;            // sum of tokenCount across all results
    totalEstimatedCostUsd?: number;  // sum of estimatedCostUsd across all results
    failedCount?: number;            // results where response was empty (provider error)
    failureRate?: number;            // % of tasks that failed (0-100)
    costByEngine?: {engine: string; tokens: number; estimatedCostUsd: number}[];
};

export type CompetitorScanResult = {
    url: string;
    name: string;
    score: number;
    coverage: number;
    subScores: SubScores;
    topGaps: string[];              // top 3 missing dimension names
    citationSources?: string[];     // cmp-3: top external domains citing this competitor
    topTopics?: string[];           // cmp-4: topic areas the competitor covers that client doesn't
    dimensionScores?: {id: string; name: string; score: number | null}[];  // all dimension scores for gap comparison
};

export type AuditFinding = {
    id: string;
    title: string;
    description: string;
    impact: 'critical' | 'serious' | 'moderate' | 'minor' | 'info';
    passed: boolean;
    detail?: string; // specific value or code snippet found
    howToFix?: string;
    table?: {headers: string[]; rows: string[][]};
};
export type CategoryReport = {
    id: string;
    label: string;
    score: number | null;
    findings: AuditFinding[];
};
export type Audit = {
    id: string;
    clientId: string;
    url: string;
    created: string;
    version: string;
    source: 'html-import';
    hash: string;
    score: number;
    coverage: number;
    dimensions: Dimension[];
    subScores: SubScores;
};
export type FindingStatus = 'open' | 'approved' | 'rejected' | 'implemented' | 'resolved';
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type Finding = {
    id: string;
    clientId: string;
    auditId: string;        // which audit produced this finding
    url: string;
    dimensionId: string;    // scoring.ts dimension id (e.g. 'schema', 'query')
    dimensionName: string;
    severity: FindingSeverity;
    title: string;          // short one-line description
    evidence: string;       // what was found (from dimension.evidence)
    action: string;         // what to fix (from dimension.action)
    missing: string[];      // specific missing items (from dimension.details.missing)
    status: FindingStatus;
    owner?: string;         // assigned team / person
    resolvedAuditId?: string; // audit that confirmed this was fixed
    scoreBefore?: number;   // dimension score when finding was opened
    scoreAfter?: number;    // dimension score after retest
    created: string;
    updated: string;
};

export type Recommendation = {
    id: string;
    clientId: string;
    findingId: string;
    title: string;
    proposal: string;       // specific change to make
    owner: string;          // 'content' | 'engineering' | 'seo' | 'devops'
    effort: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    status: 'draft' | 'approved' | 'rejected' | 'implemented';
    reviewNote?: string;    // reviewer comment on approve/reject
    created: string;
    updated: string;
};

export type Observation = {
    id: string;
    clientId: string;
    engine: string;
    surface: string;
    model: string;
    prompt: string;
    response: string;
    citations: string[];
    observedAt: string;
    created: string;
    source: 'manual-import' | 'ai-provider';
    providerResponseId?: string;
    annotations?: {url: string; startIndex: number; endIndex: number}[];
    tokenCount?: number;
    estimatedCostUsd?: number;
};
export interface Repository {
    listClients(owner: string): Promise<Client[]>;
    getClient(owner: string, id: string): Promise<Client | null>;
    saveClient(owner: string, client: Client): Promise<void>;
    deleteClient(owner: string, id: string): Promise<boolean>;
    listRecords<T>(owner: string, clientId: string, kind: 'audit' | 'observation'): Promise<T[]>;
    saveRecords(owner: string, clientId: string, kind: 'audit' | 'observation', records: {
        id: string;
        created: string;
    }[]): Promise<void>;
    deleteRecord(owner: string, clientId: string, kind: 'audit' | 'observation', recordId: string): Promise<boolean>;
    saveProbeRun(owner: string, clientId: string, run: ProbeRun): Promise<void>;
    listProbeRuns(owner: string, clientId: string, limit?: number): Promise<ProbeRun[]>;
}
export type PageSnapshot = {
    url: string;
    html: string;
    fetchedAt: string;
    status: number;
    headers: Record<string, string>;
};
export interface Crawler {
    capture(url: string): Promise<PageSnapshot>;
}
export interface AIProvider {
    readonly id: string;
    observe(prompt: string, market: string): Promise<Omit<Observation, 'id' | 'clientId' | 'created' | 'source'>>;
}
export interface CMSConnector {
    readonly id: string;
    readPage(id: string): Promise<PageSnapshot & {
        version: string;
    }>;
    stageDraft(pageId: string, html: string, expectedVersion: string): Promise<{
        draftId: string;
    }>;
}
export interface JobQueue {
    enqueue(job: {
        id: string;
        tenantId: string;
        type: string;
        version: 1;
        payload: unknown;
    }): Promise<void>;
}

/** Exact lookup supports replaying a completed request without another paid call. */
export interface ObservationLookup {
    findObservation(owner: string, clientId: string, id: string): Promise<Observation | null>;
}
export type ProviderInfo = {id: string; label: string; model: string; configured: boolean};
export class CollectionError extends Error {
    constructor(message: string, readonly status = 502) { super(message); }
}

export type ClientIdentity = {name: string; brandAliases: string[]};
export interface ClientIdentityStore {
    updateIdentity(owner: string, clientId: string, identity: ClientIdentity, updatedAt: string): Promise<Client | null>;
}

export type ProbeSchedule = {
    id: string;
    clientId: string;
    owner: string;
    cadence: 'daily' | 'weekly' | 'monthly';
    providers: string[];
    prompts: string[];
    lastRunAt?: string;
    nextRunAt: string;
    enabled: boolean;
    created: string;
};

export type Alert = {
    id: string;
    clientId: string;
    owner: string;
    metric: 'mentionRate' | 'citationRate' | 'score';
    threshold: number;
    direction: 'below' | 'above';
    lastTriggeredAt?: string;
    enabled: boolean;
    created: string;
};

export type AuditLogEntry = {
    id: string;
    owner: string;
    action: 'client.create' | 'client.delete' | 'audit.save' | 'finding.update' | 'recommendation.update' | 'probe.run' | 'scan.save';
    entityType: string;
    entityId: string;
    clientId?: string;
    detail: Record<string, unknown>;
    created: string;
};

export interface FindingStore {
    saveFindings(owner: string, clientId: string, findings: Finding[]): void;
    listFindings(owner: string, clientId: string, status?: FindingStatus): Finding[];
    getFinding(owner: string, clientId: string, id: string): Finding | null;
    updateFinding(owner: string, id: string, patch: Partial<Pick<Finding, 'status' | 'owner' | 'resolvedAuditId' | 'scoreAfter'>>): Finding | null;
    saveRecommendation(owner: string, rec: Recommendation): void;
    listRecommendations(owner: string, clientId: string): Recommendation[];
    updateRecommendation(owner: string, id: string, patch: Partial<Pick<Recommendation, 'status' | 'reviewNote' | 'owner' | 'effort' | 'impact'>>): Recommendation | null;
}

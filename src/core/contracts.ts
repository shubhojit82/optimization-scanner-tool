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
};

export type CompetitorScanResult = {
    url: string;
    name: string;
    score: number;
    coverage: number;
    subScores: SubScores;
    topGaps: string[];   // top 3 missing dimension names
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

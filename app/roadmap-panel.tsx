import {useState} from 'react';
import {CheckCircle2, Circle, Clock, Layers, Zap, Search, BarChart2, FileBarChart, Settings, Shield, Globe, Database, Code2, Target, TrendingUp, AlertTriangle, ChevronDown, ChevronRight} from 'lucide-react';

// ─── Data model ─────────────────────────────────────────────────────────────

type Status = 'done' | 'partial' | 'planned' | 'later';

interface Feature {
  id: string;
  label: string;
  status: Status;
  note?: string;
}

interface FeatureGroup {
  title: string;
  priority: string;
  icon: React.ComponentType<{size?: number}>;
  features: Feature[];
}

interface Phase {
  id: string;
  number: string;
  title: string;
  duration: string;
  goal: string;
  items: string[];
  exit: string;
  release: string;
}

// ─── Feature checklist data ──────────────────────────────────────────────────

function makeFeatureGroups(): FeatureGroup[] { return [
  {
    title: 'Client onboarding and configuration',
    priority: 'P0',
    icon: Settings,
    features: [
      {id:'onb-1', label:'Register clients with domain, industry, market, products', status:'done'},
      {id:'onb-2', label:'Industry, geography, audience and language targeting', status:'partial', note:'Industry & market captured; locale/audience segmentation not yet separate fields'},
      {id:'onb-3', label:'CMS and technology detection', status:'done', note:'detectTechStack() in src/core/tech-detect.ts — detects WordPress, AEM, Shopify, Next.js, Drupal, Sitecore, CDN, server from HTML + response headers; exposed via ScanResult.techStack; surfaced in Scanner UI as TechStackSection (crl-7 partial)'},
      {id:'onb-4', label:'Products, services and business objectives', status:'done', note:'Products captured; formal objectives field not yet modeled'},
      {id:'onb-5', label:'Competitor and brand-alias configuration', status:'done'},
      {id:'onb-6', label:'Configurable assessment scope (page limits, depth, exclusions, schedules)', status:'partial', note:'Schedules implemented; per-client crawl limits not yet configurable via UI'},
    ],
  },
  {
    title: 'Website discovery and technical crawler',
    priority: 'P0',
    icon: Search,
    features: [
      {id:'crl-1', label:'Crawl website pages and sitemaps', status:'done'},
      {id:'crl-2', label:'Check robots.txt and distinct AI crawler policies (OAI-SearchBot, GPTBot, ChatGPT-User)', status:'done', note:'Per-bot status (GPTBot, OAI-SearchBot, ChatGPT-User, Anthropic, PerplexityBot, Googlebot, Bingbot) surfaced in AiBotAccessSection in Scanner panel with allowed/blocked/unknown pills and remediation hint'},
      {id:'crl-3', label:'Check HTTP responses, canonicals and redirects', status:'done'},
      {id:'crl-4', label:'Inspect client-side vs server-rendered HTML (Playwright fallback)', status:'done', note:'Raw vs rendered DOM delta computed in computeRawVsRendered() — JS-injected content detection, heading order issues, schema-only-in-rendered; surfaced in Scanner UI RawVsRenderedSection when GEO_USE_BROWSER=true'},
      {id:'crl-5', label:'Inspect metadata, headings and internal linking', status:'done'},
      {id:'crl-6', label:'Analyze JSON-LD and Schema.org markup', status:'done'},
      {id:'crl-7', label:'Check CDN, WAF and accessibility barriers', status:'partial', note:'CDN/server detection done via detectTechStack() — Cloudflare, Fastly, Akamai, Nginx, Apache etc. surfaced in Scanner UI TechStackSection; WAF detection not yet implemented'},
      {id:'crl-8', label:'Capture snapshots and technical evidence (reproducible, auditable)', status:'partial', note:'Content hash stored; full page snapshots in object storage not yet implemented'},
    ],
  },
  {
    title: 'Content quality and answer-readiness analysis',
    priority: 'P0',
    icon: FileBarChart,
    features: [
      {id:'cnt-1', label:'Identify questions answered by every page', status:'done', note:'mapQuestionsToPage() in src/core/question-mapping.ts — scores each query-universe prompt against page text; POST /api/v1/scan/questions'},
      {id:'cnt-2', label:'Find topic and question coverage gaps', status:'done', note:'QuestionMappingResult.topGaps returns top unanswered questions; coveragePct shows % of query universe the page addresses'},
      {id:'cnt-3', label:'Measure factual clarity and specificity', status:'done', note:'Evidence, passage-density and reasoning-cue dimensions assessed'},
      {id:'cnt-4', label:'Detect outdated and contradictory information', status:'done', note:'freshness dimension now extracts dates from JSON-LD, <time> tags, meta article:modified_time and visible text; scores fresh (<6m)=100, aging (6-18m)=60, stale (>18m)=30; staleness flag on finding'},
      {id:'cnt-5', label:'Assess evidence, authorship and credibility', status:'done', note:'Authorship detection in analyzeHtml(): JSON-LD author/datePublished/dateModified, meta article:author/published_time/modified_time, rel=author link, itemprop=author; evidence dimension score now blends external links (60%) + authorship signals (40%); Signal/Detected/Source table shown in Scanner Reference cues drill-down'},
      {id:'cnt-6', label:'Analyze duplicate and thin content', status:'done', note:'content dimension now detects thin content (< 300 words, no lists/tables) and near-duplicate paragraphs via trigram Jaccard similarity; penalties applied to score'},
      {id:'cnt-7', label:'Support industry-specific rules (finance, health, retail)', status:'partial', note:'RGPS YMYL flag applied for health/money URLs — raises pass bar from 17 to 19; scr-5 industry profiles still planned'},
      {id:'rgps-1', label:'RGPS v3.6.0 — Retrieval-Grade Passage Standard scoring', status:'done', note:'12-dimension passage scorer in src/core/rgps.ts: R1–R9 mandatory (zero = automatic fail), S6–S8 scored recommendations, 25 pts total, YMYL bar 19. Integrated into ScanResult.rgps; surfaced in Scanner UI with score meter, step breakdown, dimension pills, remediation actions'},
      {id:'cnt-8', label:'Suggest content improvements with source references', status:'partial', note:'Content Brief AI generation implemented; grounding to source citations pending'},
    ],
  },
  {
    title: 'AI engine visibility monitoring',
    priority: 'P0',
    icon: Zap,
    features: [
      {id:'vis-1', label:'Customer question library with persona / topic / funnel stage', status:'done', note:'queryUniverse() now returns QueryItem[] with funnel stage (awareness/consideration/decision/retention) on every question; 8 questions per product including retention prompts'},
      {id:'vis-2', label:'Integrate AI search providers (OpenAI, Gemini, Claude, Perplexity)', status:'done'},
      {id:'vis-3', label:'Capture answers, citations, timestamps and model context', status:'done'},
      {id:'vis-4', label:'Calculate brand mentions and domain citations', status:'done'},
      {id:'vis-5', label:'Identify competitor mentions and comparisons', status:'partial', note:'Competitor scanner runs separately; cross-observation competitor tracking not yet unified'},
      {id:'vis-6', label:'Classify answer accuracy and tone / sentiment', status:'partial', note:'Sentiment classification implemented in probe runner; reviewer overrides not yet available'},
      {id:'vis-7', label:'Repeat controlled evaluations and track variability', status:'done', note:'Scheduling and AI Monitor implemented'},
      {id:'vis-8', label:'Track testing cost and failure rates', status:'done', note:'failedCount + failureRate on ProbeRun; totalTokens + totalEstimatedCostUsd + costByEngine on ProbeRun; Spend tab in AI Visibility with KPI strip, per-engine cost bars, and run-by-run cost log'},
    ],
  },
  {
    title: 'Competitor and market intelligence',
    priority: 'P1',
    icon: BarChart2,
    features: [
      {id:'cmp-1', label:'Create competitor comparison groups per market and offering', status:'partial', note:'Competitors configured per client; formal group segmentation not yet implemented'},
      {id:'cmp-2', label:'Compare visibility on identical question sets', status:'done', note:'Benchmark panel scores multiple URLs against the same rubric'},
      {id:'cmp-3', label:'Identify competitor citation sources', status:'done', note:'extractCitationSources() in node-server.ts extracts cited domains from AI probe responses; citationSources[] on CompetitorScanResult; surfaced in Competitor panel as Competitor Citation Sources section'},
      {id:'cmp-4', label:'Analyze topic coverage and content gaps vs competitors', status:'done', note:'extractTopTopics() in node-server.ts extracts topic areas from AI probe responses; topTopics[] on CompetitorScanResult; surfaced in Competitor panel as Topic Coverage Gaps + Per-Competitor Intelligence sections'},
      {id:'cmp-5', label:'Track relative visibility and statistically meaningful changes', status:'done', note:'VisibilityTrendSection in competitor-panel.tsx: SVG sparkline of mention rate over time, delta badges vs previous run, KPI cards (mention rate, citation rate), sentiment shift, share-of-voice bars with delta. Fetches probe history on mount.'},
    ],
  },
  {
    title: 'Scoring and insights engine',
    priority: 'P0',
    icon: TrendingUp,
    features: [
      {id:'scr-1', label:'Separate readiness score from observed AI visibility', status:'done'},
      {id:'scr-2', label:'Transparent weighted scoring with rule IDs, evidence and versions', status:'done'},
      {id:'scr-3', label:'Page, topic, site and brand scores with drill-down', status:'done', note:'SiteScanResult includes dimensionAggregates (per-dimension avg/min/max/pagesBelow70), avgSubScores, topPage and bottomPage; DimensionAggregatesSection and top/bottom page callouts surfaced in Site Crawler UI'},
      {id:'scr-4', label:'Rank opportunities by impact, confidence and effort', status:'done', note:'Findings ranked by severity (score gap × weight); effort + impact fields on Recommendation'},
      {id:'scr-5', label:'Industry-specific scoring profiles', status:'planned'},
      {id:'scr-6', label:'Store historical score snapshots for before/after comparison', status:'done', note:'scoreBefore + scoreAfter on Finding; retest creates new audit for full before/after delta'},
    ],
  },
  {
    title: 'Recommendation and remediation workflow',
    priority: 'P0',
    icon: Target,
    features: [
      {id:'rec-1', label:'Evidence-backed remediation recommendations with affected URLs', status:'done', note:'Finding records persisted per audit with URL, evidence, action and missing items'},
      {id:'rec-2', label:'Classify implementation ownership (marketing / content / engineering)', status:'done', note:'ownerFromDimension() maps each dimension to content / engineering / seo / devops'},
      {id:'rec-3', label:'Estimate severity, complexity and effort', status:'done', note:'Severity derived from dimension score + weight; effort field on Recommendation record'},
      {id:'rec-4', label:'Technical and content change proposals with before/after', status:'done', note:'Recommendation records store proposal text; retest captures scoreBefore + scoreAfter'},
      {id:'rec-5', label:'Reviewer approval and rejection workflow', status:'done', note:'Approve / reject / implement with review note; status flows open → approved → implemented → resolved'},
      {id:'rec-6', label:'Retest resolved findings to confirm fixes', status:'done', note:'POST /api/v1/findings/:id/retest re-crawls live URL, creates new audit, auto-resolves on score 100'},
    ],
  },
  {
    title: 'CMS integration framework',
    priority: 'P1',
    icon: Code2,
    features: [
      {id:'cms-1', label:'Read-only generic website integration (no CMS credentials required)', status:'done'},
      {id:'cms-2', label:'CMS adapter registry and capability discovery', status:'done', note:'CMS_ADAPTERS registry + generateChangeInstructions() deterministic function built'},
      {id:'cms-3', label:'Adobe AEM integration', status:'partial', note:'Port defined in adapter registry; read connector not yet wired'},
      {id:'cms-4', label:'WordPress integration', status:'partial', note:'Port defined in adapter registry; connector not yet wired'},
      {id:'cms-5', label:'Headless CMS integration (Contentful, Strapi)', status:'partial', note:'Contentful read connector implemented; Strapi port defined'},
      {id:'cms-6', label:'Secure credential and permission handling', status:'partial', note:'Env-based secrets for AI providers; CMS credential management not yet implemented'},
      {id:'cms-7', label:'Draft, review, preview and publish workflow (human-controlled)', status:'planned'},
      {id:'cms-8', label:'Rollback and publishing audit history', status:'planned'},
    ],
  },
  {
    title: 'Reporting and analytics',
    priority: 'P1',
    icon: FileBarChart,
    features: [
      {id:'rep-1', label:'Executive dashboard with readiness, visibility and trends', status:'done', note:'Executive Summary and Dashboard panels implemented'},
      {id:'rep-2', label:'Technical assessment report (findings, URLs, fixes)', status:'done', note:'HTML report export implemented'},
      {id:'rep-3', label:'Marketing and content report (missing topics, content updates)', status:'done', note:'Full marketing report export in Content Brief panel: dimension gap table (all failing dimensions with score/weight/action) + executive summary + all brief sections as structured Markdown; downloads as geo-marketing-report-{client}.md'},
      {id:'rep-4', label:'Export PDF, Excel, CSV and JSON', status:'partial', note:'JSON and XLSX export implemented; PDF export planned'},
      {id:'rep-5', label:'Integrate webmaster and analytics sources (Bing AI, GA)', status:'planned'},
      {id:'rep-6', label:'Scheduled reports and threshold-based alerts', status:'partial', note:'Alert rules implemented; scheduled report generation not yet available'},
    ],
  },
  {
    title: 'Enterprise security and tenancy',
    priority: 'P0',
    icon: Shield,
    features: [
      {id:'sec-1', label:'Tenant-isolated data and access control', status:'partial', note:'Owner-scoped storage implemented; full multi-tenant org model not yet built'},
      {id:'sec-2', label:'Role-based permissions (admin, analyst, reviewer, viewer)', status:'partial', note:'Admin and read-only viewer roles implemented; analyst and reviewer roles planned'},
      {id:'sec-3', label:'SSO and enterprise identity (OIDC/SAML)', status:'planned'},
      {id:'sec-4', label:'Secrets management and encryption', status:'partial', note:'Env-file secrets in use; vault integration and rotation not yet implemented'},
      {id:'sec-5', label:'Audit logging and retention policies', status:'partial', note:'audit_log table (migration v5) records client.create, scan.save actions; GET /api/v1/audit-log endpoint; retention policies not yet implemented'},
      {id:'sec-6', label:'Safe crawling and SSRF protection', status:'partial', note:'Domain validation exists; formal SSRF allowlist and redirect chain verification planned'},
      {id:'sec-7', label:'Data residency and AI data-sharing controls', status:'planned'},
      {id:'sec-8', label:'Deletion, export and backup workflows', status:'done', note:'GET /api/v1/clients/:id/export returns full JSON dump (client + audits + observations + findings + probe runs) with Content-Disposition download header; Export data button in client bar; DELETE /api/v1/clients/:id (with 2-click confirm) already existed'},
    ],
  },
  {
    title: 'Platform operations and performance',
    priority: 'P1',
    icon: Database,
    features: [
      {id:'ops-1', label:'Asynchronous scanning and job processing', status:'partial', note:'Scheduler runs background probes; crawler runs inline in some flows'},
      {id:'ops-2', label:'Caching and content fingerprinting (skip unchanged content)', status:'partial', note:'ScanCache (5-min LRU) and content hash implemented; incremental crawl planned'},
      {id:'ops-3', label:'API quotas, retry logic and circuit breakers', status:'partial', note:'withRetry() in probe-runner.ts: exponential back-off on 429/502 errors — retries up to 2× with 1s/2s delays before failing; circuit breakers not yet implemented'},
      {id:'ops-4', label:'Distributed rate limits and concurrency control', status:'planned'},
      {id:'ops-5', label:'Structured logging, tracing and monitoring', status:'planned'},
      {id:'ops-6', label:'Cost budgets per client and scan (AI token tracking)', status:'planned'},
      {id:'ops-7', label:'Cloud deployment and CI/CD pipeline', status:'partial', note:'Local Docker and Next.js cloud deploy available; full CI/CD pipeline not yet automated'},
      {id:'ops-8', label:'Performance and resilience testing', status:'planned'},
    ],
  },
  {
    title: 'Administration and extensibility',
    priority: 'P2',
    icon: Globe,
    features: [
      {id:'adm-1', label:'Central rule and policy configuration (without code changes)', status:'planned'},
      {id:'adm-2', label:'Plugin SDK and adapter documentation', status:'planned'},
      {id:'adm-3', label:'Custom industry assessment templates (finance, retail, healthcare)', status:'planned'},
      {id:'adm-4', label:'Organization and subscription management', status:'planned'},
      {id:'adm-5', label:'White-label client reports (agency PDF branding)', status:'planned'},
      {id:'adm-6', label:'Public and integration APIs', status:'partial', note:'Internal REST API versioned at /api/v1; public API documentation and SDK not yet built'},
    ],
  },
  {
    title: 'Content generation and publishing',
    priority: 'P1',
    icon: Zap,
    features: [
      {id:'gen-1', label:'RGPS rewrite assistant — AI rewrites passage using only facts on the page', status:'done', note:'RgpsRewriteService in src/application/rgps-rewrite.ts — sends failing RGPS dimensions + original passage to AI, returns rewrite using only existing facts; POST /api/v1/rgps/rewrite; inline Rewrite with AI button in Scanner RGPS section'},
      {id:'gen-2', label:'Full article draft from content brief (AI-generated, RGPS-scored)', status:'done', note:'ArticleDraftService in src/application/article-draft.ts + POST /api/v1/article-draft; Article Draft tab in Content Brief panel with RGPS score display, dimension pills, Markdown/HTML download, and auto-fail warning'},
      {id:'gen-3', label:'Before/after RGPS score preview on any proposed rewrite', status:'done', note:'scoreAfter/scoreBefore + pointsGained + dimensionsMoved returned from rewrite endpoint and shown inline in Scanner UI'},
      {id:'gen-4', label:'CMS auto-publish — push approved article draft to WordPress/Contentful/Shopify', status:'planned'},
      {id:'gen-5', label:'Content calendar — schedule when each brief/article goes live', status:'planned'},
      {id:'gen-6', label:'Multi-language content generation (150+ languages)', status:'planned'},
    ],
  },
  {
    title: 'Search performance and backlink intelligence',
    priority: 'P1',
    icon: TrendingUp,
    features: [
      {id:'srp-1', label:'Google Search Console integration — keyword rankings, impressions, CTR', status:'planned'},
      {id:'srp-2', label:'Bing Webmaster Tools integration — AI Answers performance data', status:'planned'},
      {id:'srp-3', label:'Backlink profile analysis — inbound authority signals per domain', status:'planned'},
      {id:'srp-4', label:'Third-party citation tracking — brand mentions on external sites', status:'planned'},
      {id:'srp-5', label:'Keyword gap analysis — queries competitors rank for that client does not', status:'planned'},
      {id:'srp-6', label:'Google Business Profile signals (local AI search pack presence)', status:'planned'},
    ],
  },
  {
    title: 'Cost and usage intelligence',
    priority: 'P1',
    icon: Database,
    features: [
      {id:'cst-1', label:'Token count and estimated cost per probe run', status:'done', note:'tokenCount + estimatedCostUsd on ProbeResult (all 4 providers); totalTokens + totalEstimatedCostUsd aggregated on ProbeRun; shown in AI Visibility run header and probe history table'},
      {id:'cst-2', label:'Per-client AI spend dashboard and monthly budget cap', status:'partial', note:'Spend Dashboard tab in AI Visibility shows KPI strip (total cost, tokens, failure rate, cost per probe) + per-engine bars + run-by-run cost log; monthly budget cap not yet enforced'},
      {id:'cst-3', label:'Cost breakdown by provider (OpenAI vs Gemini vs Claude vs Perplexity)', status:'done', note:'costByEngine[] on ProbeRun; SpendDashboard component renders Cost by Provider bar chart with per-engine tokens and estimated cost; aggregated across all history runs'},
      {id:'cst-4', label:'Crawl bandwidth and page-count quota tracking', status:'planned'},
    ],
  },
]; }

// ─── Phase roadmap data ──────────────────────────────────────────────────────

function makePhases(): Phase[] { return [
  {
    id:'p0', number:'Phase 0', title:'Platform Foundation', duration:'1–2 weeks',
    goal:'Establish production-oriented codebase, database schema, auth and background jobs.',
    items:['✅ Modular contracts and repo structure','✅ SQLite + D1 versioned migrations (v5 — audit log)','✅ Authentication (local / basic / viewer)','✅ Background scheduler','✅ Vite + Node dual-stack dev environment','✅ Structured audit log (logEvent / listAuditLog)','⬜ Structured server logging and CI pipeline'],
    exit:'Sign-in, client registration and background jobs run locally and in a cloud environment.',
    release:'✅ Complete',
  },
  {
    id:'p1', number:'Phase 1', title:'GEO Website Assessment', duration:'3–4 weeks',
    goal:'Deliver a complete evidence-based GEO readiness audit without any AI provider or CMS credentials.',
    items:['✅ Client onboarding API and UI','✅ Sitemap and robots.txt crawl','✅ HTTP fetch + Playwright rendering','✅ 11-dimension assessment rubric (versioned)','✅ JSON-LD validation per schema type','✅ GEO Readiness Score with sub-scores','✅ HTML + XLSX report export','⬜ Full page snapshot in object storage'],
    exit:'A user can scan 25+ public pages, inspect evidence and generate a repeatable report.',
    release:'✅ Complete — v0.1',
  },
  {
    id:'p2', number:'Phase 2', title:'AI Visibility Intelligence', duration:'3–4 weeks',
    goal:'Move beyond readiness into observed brand and citation presence in AI-generated answers.',
    items:['✅ Provider adapters (OpenAI, Gemini, Claude, Perplexity)','✅ Answer, citation and timestamp capture','✅ Brand mention + citation + sentiment metrics','✅ Share-of-voice vs competitors per engine','✅ Scheduled probe runs + alerts','✅ AI Monitor dashboard','⬜ Formal question approval library','⬜ Budget / token cost tracking'],
    exit:'Reproducible question-set tests preserved with full evidence, labeled by provider and surface.',
    release:'✅ Complete — v0.5',
  },
  {
    id:'p3', number:'Phase 3', title:'Recommendations and Workflows', duration:'3–4 weeks',
    goal:'Turn raw findings and AI observations into a prioritized, reviewable improvement plan.',
    items:['✅ Finding records derived from every audit (severity, evidence, action, missing)','✅ Owner classification per dimension (content / engineering / seo / devops)','✅ Recommendation records with effort + impact fields','✅ Approve / reject / implement workflow with review note','✅ Score before/after tracking on findings','✅ Retest endpoint — re-crawl + auto-resolve + delta','✅ Findings panel with filter tabs and KPI counts','⬜ Implementation backlog ticket export (Jira)'],
    exit:'A finding moves from evidence to approved recommendation to retested and resolved.',
    release:'✅ Complete — v0.5',
  },
  {
    id:'p4', number:'Phase 4', title:'CMS Integration and Execution', duration:'4–6 weeks',
    goal:'Enable approved recommendations to become actual CMS changes through governed adapters.',
    items:['✅ CMS adapter registry (6 adapters: generic, Contentful, WordPress, AEM, Strapi, Drupal)','✅ Deterministic change instructions per finding per adapter','✅ CMS panel with per-finding proposal generation and copy-to-clipboard','✅ /api/v1/cms/adapters and /api/v1/cms/change-instructions endpoints','⬜ Adobe AEM write connector (read + draft + publish)','⬜ WordPress REST write connector','⬜ Strapi write connector','⬜ Draft, review, preview and publish workflow','⬜ Rollback and publishing audit history'],
    exit:'A reviewer approves a change, creates a draft, validates it and publishes through the CMS.',
    release:'v1.0 — In Progress',
  },
  {
    id:'p5', number:'Phase 5', title:'Analytics and Continuous Optimization', duration:'3–4 weeks',
    goal:'Make GEO measurable over time and operationally sustainable for ongoing client delivery.',
    items:['✅ Probe run history table with KPI row and sparklines','✅ Mention rate / citation rate trends over time','✅ Share-of-voice bar chart aggregated across all runs','✅ Top citation sources aggregated across all runs','✅ Change impact analysis — dimension score deltas between any two audits','✅ Analytics panel registered in nav','⬜ Bing Webmaster AI Performance integration','⬜ Web analytics correlation (GA / referral data)','⬜ Automated scheduled reports'],
    exit:'A client can compare two assessment periods and distinguish observed improvements from unproven claims.',
    release:'v1.0 — In Progress',
  },
  {
    id:'p6', number:'Phase 6', title:'Content Generation and Publishing', duration:'4–6 weeks',
    goal:'Close the gap with content-factory competitors by generating, scoring and publishing AI-ready content — without removing human control.',
    items:['RGPS rewrite assistant — AI rewrites any passage using only facts already on the page, scores before/after','Full article draft from content brief — GPT/Claude generates article, RGPS-scored before delivery','Before/after RGPS delta shown inline in Scanner and Content Brief panels','CMS auto-publish — push approved draft to WordPress, Contentful or Shopify via adapter','Content calendar view — schedule briefs and drafts with publish dates','Probe token/cost tracking — tokenCount + estimatedCostUsd on every probe run'],
    exit:'A user can scan a failing passage, get an AI rewrite that scores 19+/25, review it and push it to their CMS in one flow.',
    release:'v1.5 — Planned',
  },
  {
    id:'p7', number:'Phase 7', title:'Search Performance and Intelligence', duration:'3–4 weeks',
    goal:'Add real-world search signal data alongside GEO scoring so clients can correlate AI visibility with actual traffic and rankings.',
    items:['Google Search Console OAuth integration — keyword rankings, impressions, CTR per page','Bing Webmaster AI Answers performance data','Backlink and citation tracking — inbound authority signals per domain','Third-party brand mention tracking — external site citations','Keyword gap analysis — queries competitors rank for that the client does not','Google Business Profile local presence signals'],
    exit:'A client can see which keywords drive impressions and which pages rank vs which are GEO-ready, correlated in one view.',
    release:'v2.0 — Planned',
  },
  {
    id:'p8', number:'Phase 8', title:'Enterprise SaaS Hardening', duration:'4–6 weeks',
    goal:'Prepare the platform for multiple enterprise clients, consulting teams and external SaaS customers.',
    items:['Full multi-tenant org management and isolation','SSO, OIDC/SAML and enterprise identity','Secrets vault and credential rotation','Audit logging and configurable retention','Horizontal API and worker scaling','Public API, plugin SDK and adapter registry','Industry assessment templates (finance, health, retail)','Subscription management and white-label reports'],
    exit:'Multiple enterprise clients operate concurrently with full data isolation and operational monitoring.',
    release:'v3.0 Enterprise SaaS',
  },
]; }

// ─── Utility ─────────────────────────────────────────────────────────────────

function statusBadge(s: Status) {
  if (s === 'done')    return {label:'Implemented',   color:'#10b981', bg:'#d1fae5'};
  if (s === 'partial') return {label:'Partial',       color:'#f59e0b', bg:'#fef3c7'};
  if (s === 'planned') return {label:'Planned',       color:'#6366f1', bg:'#ede9fe'};
  return                      {label:'Later',         color:'#9ca3af', bg:'#f3f4f6'};
}

function groupCounts(features: Feature[]) {
  const done    = features.filter(f => f.status === 'done').length;
  const partial = features.filter(f => f.status === 'partial').length;
  const planned = features.filter(f => f.status === 'planned').length + features.filter(f => f.status === 'later').length;
  return {done, partial, planned, total: features.length};
}

function totalCounts(groups: FeatureGroup[]) {
  const all = groups.flatMap(g => g.features);
  return groupCounts(all);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({status}: {status: Status}) {
  const {color, bg} = statusBadge(status);
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:20,background:bg,fontSize:11,fontWeight:600,color,flexShrink:0}}>
      {status === 'done'    && <CheckCircle2 size={11}/>}
      {status === 'partial' && <Clock size={11}/>}
      {status === 'planned' && <Circle size={11}/>}
      {status === 'later'   && <Circle size={11}/>}
      {statusBadge(status).label}
    </span>
  );
}

function FeatureGroupCard({group}: {group: FeatureGroup}) {
  const [open, setOpen] = useState(false);
  const {done, partial, planned, total} = groupCounts(group.features);
  const Icon = group.icon;
  const pct = Math.round((done + partial * 0.5) / total * 100);
  return (
    <div style={{border:'1px solid #e4e6ef',borderRadius:10,overflow:'hidden',marginBottom:12}}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'14px 18px',background:'#fafbff',border:'none',cursor:'pointer',textAlign:'left'}}
      >
        <span style={{display:'flex',alignItems:'center',justifyContent:'center',width:34,height:34,borderRadius:8,background:'#eef1ff',color:'#4f6ef7',flexShrink:0}}>
          <Icon size={16}/>
        </span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span style={{fontWeight:600,fontSize:14,color:'#1e2a3a'}}>{group.title}</span>
            <span style={{fontSize:11,fontWeight:700,padding:'1px 6px',borderRadius:4,background:group.priority==='P0'?'#fee2e2':group.priority==='P1'?'#fef3c7':'#ede9fe',color:group.priority==='P0'?'#dc2626':group.priority==='P1'?'#d97706':'#7c3aed'}}>{group.priority}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginTop:4}}>
            <div style={{flex:1,height:4,background:'#e4e6ef',borderRadius:2,overflow:'hidden',maxWidth:180}}>
              <div style={{width:`${pct}%`,height:'100%',background:pct===100?'#10b981':pct>50?'#f59e0b':'#6366f1',borderRadius:2,transition:'width .3s'}}/>
            </div>
            <span style={{fontSize:12,color:'#6b7280',flexShrink:0}}>
              {done} done · {partial} partial · {planned} planned
            </span>
          </div>
        </div>
        {open ? <ChevronDown size={16} style={{color:'#9ca3af',flexShrink:0}}/> : <ChevronRight size={16} style={{color:'#9ca3af',flexShrink:0}}/>}
      </button>
      {open && (
        <div style={{padding:'4px 0 8px 0'}}>
          {group.features.map(f => (
            <div key={f.id} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'10px 18px 10px 66px',borderTop:'1px solid #f0f1f5'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:'#1e2a3a',lineHeight:1.5}}>{f.label}</div>
                {f.note && <div style={{fontSize:12,color:'#6b7280',marginTop:3,lineHeight:1.4}}>{f.note}</div>}
              </div>
              <StatusDot status={f.status}/>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PhaseCard({phase, index}: {phase: Phase; index: number}) {
  const [open, setOpen] = useState(false);
  const phaseColors = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];
  const color = phaseColors[index % phaseColors.length];
  return (
    <div style={{border:'1px solid #e4e6ef',borderRadius:10,overflow:'hidden',marginBottom:12}}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{width:'100%',display:'flex',alignItems:'center',gap:14,padding:'16px 18px',background:'#fafbff',border:'none',cursor:'pointer',textAlign:'left'}}
      >
        <span style={{width:36,height:36,borderRadius:'50%',background:color,color:'#fff',fontWeight:800,fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{index}</span>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span style={{fontWeight:700,fontSize:14,color:'#1e2a3a'}}>{phase.number} — {phase.title}</span>
            <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'#f3f4f6',color:'#6b7280',fontWeight:600}}>{phase.duration}</span>
            <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'#ede9fe',color:'#7c3aed',fontWeight:600}}>{phase.release}</span>
          </div>
          <div style={{fontSize:12,color:'#6b7280',marginTop:3}}>{phase.goal}</div>
        </div>
        {open ? <ChevronDown size={16} style={{color:'#9ca3af',flexShrink:0}}/> : <ChevronRight size={16} style={{color:'#9ca3af',flexShrink:0}}/>}
      </button>
      {open && (
        <div style={{padding:'16px 18px 16px 68px',borderTop:'1px solid #f0f1f5',background:'#fff'}}>
          <div style={{fontSize:13,fontWeight:600,color:'#6b7280',marginBottom:10,textTransform:'uppercase',letterSpacing:'.05em'}}>Deliverables</div>
          <ul style={{margin:'0 0 16px 0',padding:'0 0 0 16px'}}>
            {phase.items.map((item, i) => (
              <li key={i} style={{fontSize:13,color:'#374151',lineHeight:1.6,marginBottom:4}}>{item}</li>
            ))}
          </ul>
          <div style={{background:'#f0f7ff',border:'1px solid #bfdbfe',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#1e40af'}}>
            <strong>Exit criterion:</strong> {phase.exit}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RoadmapPanel() {
  const [activeView, setActiveView] = useState<'checklist'|'phases'|'lifecycle'>('checklist');
  // Computed fresh every render — ensures HMR picks up data changes immediately
  const FEATURE_GROUPS = makeFeatureGroups();
  const PHASES = makePhases();
  const totals = totalCounts(FEATURE_GROUPS);
  const overallPct = Math.round((totals.done + totals.partial * 0.5) / totals.total * 100);

  const lifecycle = [
    {step:'Discover',   desc:'Client onboarding, domain registration, technology detection, crawl scope'},
    {step:'Assess',     desc:'Technical audit, content quality analysis, JSON-LD and schema validation'},
    {step:'Benchmark',  desc:'Side-by-side URL scoring, competitor comparison on identical question sets'},
    {step:'Recommend',  desc:'Evidence-backed remediation, impact × effort prioritization, change proposals'},
    {step:'Implement',  desc:'CMS adapter drafts, human approval workflow, governed publishing'},
    {step:'Validate',   desc:'Retest resolved findings, before/after score comparison, deployment verification'},
    {step:'Monitor',    desc:'Scheduled re-assessments, AI visibility tracking, threshold-based alerts'},
    {step:'Optimize',   desc:'Trend analytics, content opportunity backlog, continuous improvement cycle'},
  ];

  const implementedSteps = ['Discover','Assess','Benchmark','Recommend','Validate','Monitor','Optimize'];
  const partialSteps: string[] = [];

  return (
    <section className="panel" style={{padding:0,overflow:'hidden'}}>
      {/* Header */}
      <div style={{padding:'28px 28px 20px',borderBottom:'1px solid #e4e6ef',background:'linear-gradient(135deg,#f8faff 0%,#f0f4ff 100%)'}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:16}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:'.08em',color:'#6366f1',marginBottom:6}}>PRODUCT BLUEPRINT</div>
            <h2 style={{margin:'0 0 6px',fontSize:22,fontWeight:700,color:'#1e2a3a'}}>GEO Intelligence Platform</h2>
            <p style={{margin:0,fontSize:14,color:'#6b7280',maxWidth:560}}>
              Enterprise-grade Generative Engine Optimization platform — complete lifecycle from discovery through continuous optimization.
              Tracks {totals.total} product features across {FEATURE_GROUPS.length} modules and {PHASES.length} development phases.
            </p>
          </div>
          {/* Overall progress ring */}
          <div style={{display:'flex',alignItems:'center',gap:16,background:'#fff',border:'1px solid #e4e6ef',borderRadius:12,padding:'14px 20px',flexShrink:0}}>
            <svg width={56} height={56} viewBox="0 0 56 56">
              <circle cx={28} cy={28} r={24} fill="none" stroke="#e4e6ef" strokeWidth={5}/>
              <circle cx={28} cy={28} r={24} fill="none" stroke="#4f6ef7" strokeWidth={5}
                strokeDasharray={`${overallPct * 1.508} ${150.8 - overallPct * 1.508}`}
                strokeDashoffset={37.7} strokeLinecap="round"/>
              <text x={28} y={33} textAnchor="middle" fontSize={13} fontWeight={700} fill="#1e2a3a">{overallPct}%</text>
            </svg>
            <div>
              <div style={{fontWeight:700,fontSize:15,color:'#1e2a3a'}}>{totals.done + totals.partial} / {totals.total}</div>
              <div style={{fontSize:12,color:'#6b7280'}}>features built or partial</div>
              <div style={{display:'flex',gap:6,marginTop:4,flexWrap:'wrap'}}>
                <span style={{fontSize:11,padding:'2px 7px',borderRadius:20,background:'#d1fae5',color:'#065f46',fontWeight:600}}>{totals.done} done</span>
                <span style={{fontSize:11,padding:'2px 7px',borderRadius:20,background:'#fef3c7',color:'#92400e',fontWeight:600}}>{totals.partial} partial</span>
                <span style={{fontSize:11,padding:'2px 7px',borderRadius:20,background:'#ede9fe',color:'#5b21b6',fontWeight:600}}>{totals.planned} planned</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{display:'flex',gap:4,marginTop:20}}>
          {(['checklist','phases','lifecycle'] as const).map(v => (
            <button key={v} onClick={() => setActiveView(v)}
              style={{padding:'7px 16px',borderRadius:8,border:'1px solid',fontSize:13,fontWeight:600,cursor:'pointer',
                borderColor: activeView===v ? '#4f6ef7' : '#e4e6ef',
                background:  activeView===v ? '#4f6ef7' : '#fff',
                color:       activeView===v ? '#fff'    : '#374151'}}>
              {v === 'checklist' ? 'Feature checklist' : v === 'phases' ? 'Development phases' : 'Lifecycle map'}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{padding:'24px 28px'}}>

        {/* ── Checklist view ───────────────────────────────────────────────── */}
        {activeView === 'checklist' && (
          <>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:20}}>
              <AlertTriangle size={15} style={{color:'#f59e0b'}}/>
              <span style={{fontSize:13,color:'#6b7280'}}>
                Expand each module to see individual feature status. <strong>Partial</strong> means the core capability exists but key sub-features are still to be built.
              </span>
            </div>
            {FEATURE_GROUPS.map(g => <FeatureGroupCard key={g.title} group={g}/>)}
          </>
        )}

        {/* ── Phases view ───────────────────────────────────────────────────── */}
        {activeView === 'phases' && (
          <>
            <div style={{marginBottom:20}}>
              <p style={{margin:'0 0 16px',fontSize:13,color:'#6b7280'}}>
                Seven sequential phases from foundation through enterprise SaaS readiness.
                Phases 0–2 constitute the MVP. Phases 0–5 deliver a complete consulting platform.
                Phase 6 prepares the platform for commercial multi-tenant operation.
              </p>
              <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:4}}>
                {[{label:'v0.1 Assessment MVP',desc:'Phases 0–1'},
                  {label:'v0.5 GEO Intelligence Beta',desc:'Phases 0–3'},
                  {label:'v1.0 Client Delivery Platform',desc:'Phases 0–5'},
                  {label:'v2.0 Enterprise SaaS',desc:'Phase 6'}].map(r=>(
                  <div key={r.label} style={{padding:'8px 14px',background:'#f8faff',border:'1px solid #e4e6ef',borderRadius:8}}>
                    <div style={{fontSize:12,fontWeight:700,color:'#4f6ef7'}}>{r.label}</div>
                    <div style={{fontSize:11,color:'#9ca3af'}}>{r.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            {PHASES.map((p, i) => <PhaseCard key={p.id} phase={p} index={i}/>)}
          </>
        )}

        {/* ── Lifecycle view ────────────────────────────────────────────────── */}
        {activeView === 'lifecycle' && (
          <>
            <p style={{margin:'0 0 24px',fontSize:13,color:'#6b7280'}}>
              The complete client engagement lifecycle — from initial discovery through continuous optimization.
              Green steps are implemented today. Amber steps are partially available. Grey steps are on the roadmap.
            </p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
              {lifecycle.map(({step, desc}, i) => {
                const isImpl    = implementedSteps.includes(step);
                const isPartial = partialSteps.includes(step);
                const border = isImpl ? '#10b981' : isPartial ? '#f59e0b' : '#e4e6ef';
                const bg     = isImpl ? '#f0fdf4' : isPartial ? '#fffbeb' : '#fafbff';
                const numBg  = isImpl ? '#10b981' : isPartial ? '#f59e0b' : '#6366f1';
                return (
                  <div key={step} style={{border:`1px solid ${border}`,borderRadius:10,padding:'16px 18px',background:bg}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                      <span style={{width:28,height:28,borderRadius:'50%',background:numBg,color:'#fff',fontWeight:800,fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{i+1}</span>
                      <span style={{fontWeight:700,fontSize:14,color:'#1e2a3a'}}>{step}</span>
                      {isImpl    && <span style={{marginLeft:'auto',fontSize:11,padding:'1px 7px',borderRadius:20,background:'#d1fae5',color:'#065f46',fontWeight:600}}>Live</span>}
                      {isPartial && <span style={{marginLeft:'auto',fontSize:11,padding:'1px 7px',borderRadius:20,background:'#fef3c7',color:'#92400e',fontWeight:600}}>Partial</span>}
                      {!isImpl&&!isPartial && <span style={{marginLeft:'auto',fontSize:11,padding:'1px 7px',borderRadius:20,background:'#ede9fe',color:'#5b21b6',fontWeight:600}}>Roadmap</span>}
                    </div>
                    <p style={{margin:0,fontSize:13,color:'#4b5563',lineHeight:1.5}}>{desc}</p>
                  </div>
                );
              })}
            </div>

            {/* Next milestone callout */}
            <div style={{marginTop:28,background:'linear-gradient(135deg,#f0f4ff 0%,#ede9fe 100%)',border:'1px solid #c7d2fe',borderRadius:12,padding:'20px 24px'}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:'.08em',color:'#10b981',marginBottom:6}}>PHASES 0–5 FOUNDATIONS BUILT</div>
              <h3 style={{margin:'0 0 8px',fontSize:16,fontWeight:700,color:'#1e2a3a'}}>Next: Phase 4 completion — CMS write connectors</h3>
              <p style={{margin:'0 0 12px',fontSize:13,color:'#4b5563',lineHeight:1.6}}>
                Analytics trends and CMS change instructions are live. The next milestone is wiring the write
                connectors (AEM, WordPress, Strapi) so approved recommendations can be staged as CMS drafts,
                reviewed in preview, and published with a single click.
              </p>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {['Adobe AEM write connector','WordPress REST write connector','Strapi write connector','Draft/preview/publish workflow','Human approval before any publish'].map(s=>(
                  <span key={s} style={{fontSize:12,padding:'4px 12px',borderRadius:20,background:'#fff',border:'1px solid #c7d2fe',color:'#4f6ef7',fontWeight:600}}>{s}</span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

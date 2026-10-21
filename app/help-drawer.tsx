import { X } from 'lucide-react';

type Feature = {
  icon: string;
  name: string;
  tagline: string;
  body: string;
  steps?: string[];
  badge?: 'done' | 'partial';
};

const SECTIONS: { title: string; features: Feature[] }[] = [
  {
    title: 'Setup & client management',
    features: [
      {
        icon: '＋', name: 'Add / Edit Client', badge: 'done',
        tagline: 'One client = one brand + domain. All data is owner-scoped.',
        body: 'Create a client with brand name, domain, industry, market, up to 10 products, and 5 competitors. Use Edit client to add brand aliases (e.g. "WFG") so mention matching covers all known names.',
        steps: ['Add client → fill form', 'Edit client → add brand aliases', 'Import page → establish baseline', 'Delete client → two-click confirmation, removes all data'],
      },
    ],
  },
  {
    title: 'Page analysis',
    features: [
      {
        icon: '📊', name: 'Overview', badge: 'done',
        tagline: 'Composite SEO / AEO / GEO score with per-dimension breakdown and priority actions.',
        body: 'Shows the weighted readiness score (0–100), rubric coverage %, and three sub-scores. Click any sub-score ring to drill into a full breakdown. Priority actions are ordered by weighted gap so the highest-impact missing cues appear first. Export as HTML report, PDF, or JSON.',
      },
      {
        icon: '🔍', name: 'Scanner', badge: 'done',
        tagline: 'Scan any public URL — live HTTP fetch, instant GEO readiness report.',
        body: 'Paste any URL; the server fetches it and scores it immediately. Results are cached 5 min. Save to client to persist the audit (deduplicates by hash + URL). Export XLSX for client presentations.',
        steps: ['Paste URL → Scan', 'Review findings', 'Save to client (optional)', 'Export XLSX'],
      },
      {
        icon: '🗺️', name: 'Site Crawler', badge: 'done',
        tagline: 'Discover and score multiple pages from one domain automatically.',
        body: 'Enter a root URL; the crawler finds pages via sitemap.xml or internal links, scores each page, and returns a ranked list with SEO/AEO/GEO sub-scores and top gaps. Includes XLSX export of the full site report.',
      },
      {
        icon: '📈', name: 'Progress', badge: 'done',
        tagline: 'Before-and-after dimension comparison across any two saved audits.',
        body: 'Select any two audits from history. Green = improvement, red = regression. Answers: "Did the fix actually land?"',
      },
    ],
  },
  {
    title: 'AI visibility & probing',
    features: [
      {
        icon: '⚡', name: 'AI Visibility', badge: 'done',
        tagline: 'Fire prompts at live AI engines — measure mention rate, sentiment, share-of-voice.',
        body: 'Runs prompts against OpenAI, Gemini, Claude, or Perplexity. Measures: brand mentioned, sentiment (positive/neutral/negative/absent), domain cited, competitors mentioned. Aggregates into Mention Rate, Citation Rate, Sentiment Breakdown, Share of Voice, and Top Citing Domains.',
      },
      {
        icon: '👁️', name: 'AI Monitor', badge: 'done',
        tagline: 'Run a single prompt against one provider and save the observation instantly.',
        body: 'Lighter-weight than a full probe. Pick a provider, type or select a prompt, get the live response with citations, save to observation history. Good for spot-checking without burning all-provider credits.',
      },
      {
        icon: '🔔', name: 'Schedules', badge: 'done',
        tagline: 'Automated recurring probe runs — daily, weekly, or monthly.',
        body: 'Set a cadence, choose providers and prompts, and the built-in scheduler fires probes automatically in the background. No external cron needed.',
      },
      {
        icon: '🚨', name: 'Alerts', badge: 'done',
        tagline: 'Threshold alerts on mention rate, citation rate, or overall score.',
        body: 'Define a metric, direction (below/above), and threshold (0–100). After each probe run the server checks all enabled alerts and timestamps those that triggered.',
      },
    ],
  },
  {
    title: 'Competitive intelligence',
    features: [
      {
        icon: '📉', name: 'Competitors', badge: 'done',
        tagline: 'Score up to 5 competitor URLs side-by-side against the GEO rubric.',
        body: 'Enter competitor URLs; the scanner fetches and scores each page. Returns a ranked table with score, coverage, SEO/AEO/GEO sub-scores, and top 3 gaps per competitor.',
      },
      {
        icon: '🏆', name: 'Benchmark', badge: 'done',
        tagline: 'League-table scoring of 2–6 URLs with gap analysis vs the leader.',
        body: "Score any mix of URLs in a single ranked table. Highlights the leader per sub-score and shows each entry's gap vs the top performer. Useful for client presentations.",
      },
    ],
  },
  {
    title: 'AI-powered content & strategy',
    features: [
      {
        icon: '🪄', name: 'Smart Prompts', badge: 'done',
        tagline: 'AI-generated probe prompts tailored to your audit gaps and personas.',
        body: 'Requires a prior audit. Sends gap data to the selected AI provider, which returns intent-matched, persona-targeted questions designed to test brand visibility in the areas where the client scores lowest.',
      },
      {
        icon: '✏️', name: 'Content Brief', badge: 'done',
        tagline: 'AI-generated brief — headings, FAQs, schema markup, entity links.',
        body: 'Requires a prior audit. The AI provider analyses dimension gaps and outputs: H2/H3 headings to add, FAQ questions, schema types and properties, entity link targets (Wikidata, Wikipedia, LinkedIn), and passage blocks. Ready to hand to a content writer.',
      },
    ],
  },
  {
    title: 'Reporting & export',
    features: [
      {
        icon: '🎯', name: 'Action Plan', badge: 'done',
        tagline: 'Prioritised fix list ordered by effort vs impact — start with quick wins.',
        body: 'Ranks dimension gaps by weighted impact across SEO, AEO, and GEO tracks. Each action includes what to change, why it matters, and expected score impact.',
      },
      {
        icon: '📋', name: 'Executive Summary', badge: 'done',
        tagline: 'Client-ready PDF report — 5-pillar scores, AI visibility KPIs, top recommendations.',
        body: 'Generates a polished, printable HTML report: 5-pillar readiness scores, AI visibility metrics from the latest probe run, top 5 recommendations, and competitor comparison. Print to PDF from the browser.',
      },
      {
        icon: '📑', name: 'Full Report / XLSX Export', badge: 'done',
        tagline: 'Lighthouse-style HTML audit report and spreadsheet export.',
        body: 'HTML Report — from the Evidence Ledger in Overview. Covers all dimensions, findings, and how-to-fix for every assessed cue. XLSX Export — available from Scanner. Spreadsheet with sub-scores and top gaps.',
      },
    ],
  },
  {
    title: 'Queries & observations',
    features: [
      {
        icon: '🔎', name: 'Query Universe', badge: 'done',
        tagline: 'Auto-generated prompt set by intent — Education, Evaluation, Implementation, Comparison.',
        body: 'Deterministically generated from products, market, and competitors — no LLM needed. Run any prompt directly into AI Monitor, export all as JSON, or add and save custom prompts to extend the set.',
      },
      {
        icon: '🌐', name: 'Observations', badge: 'done',
        tagline: 'View, import, and manage saved AI engine responses with citation tracking.',
        body: 'Rates computed over the latest 200 observations per client. Three import paths: (A) Live AI Monitor — run and save in one click. (B) JSON import — paste a JSON array. (C) CSV import wizard — bulk import with column mapping.',
      },
    ],
  },
  {
    title: 'Workspace',
    features: [
      {
        icon: '🖥️', name: 'Dashboard', badge: 'done',
        tagline: 'Multi-client overview — all clients ranked by score at a glance.',
        body: "Summary table of all clients with their latest audit score and sub-scores. Click any row to jump to that client's Overview.",
      },
      {
        icon: '🔗', name: 'Integrations', badge: 'partial',
        tagline: 'Configure AI providers and CMS connectors via .env on the server.',
        body: 'OpenAI (OPENAI_API_KEY), Gemini (GEMINI_API_KEY), Claude (ANTHROPIC_API_KEY), Perplexity (PERPLEXITY_API_KEY), Contentful (CONTENTFUL_SPACE_ID + CONTENTFUL_ACCESS_TOKEN). Enable browser crawler with GEO_USE_BROWSER=true.',
      },
    ],
  },
];

export function HelpDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <div className="help-overlay" onClick={onClose} aria-hidden />}
      <aside className={`help-drawer${open ? ' open' : ''}`} aria-label="Feature guide" aria-hidden={!open}>
        <div className="help-drawer-header">
          <div>
            <div className="help-drawer-eyebrow">AI Search Intelligence</div>
            <h2 className="help-drawer-title">Feature Guide</h2>
          </div>
          <button className="help-drawer-close" onClick={onClose} aria-label="Close help"><X size={18} /></button>
        </div>

        <div className="help-drawer-score-legend">
          <span className="help-pill"><span className="help-dot seo" />SEO</span>
          <span className="help-pill"><span className="help-dot aeo" />AEO</span>
          <span className="help-pill"><span className="help-dot geo" />GEO</span>
          <span className="help-pill-note">Rubric sub-scores</span>
        </div>

        <div className="help-drawer-body">
          {SECTIONS.map(s => (
            <div key={s.title} className="help-section">
              <div className="help-section-title">{s.title}</div>
              {s.features.map(f => (
                <div key={f.name} className="help-feature">
                  <div className="help-feature-hd">
                    <span className="help-feature-icon">{f.icon}</span>
                    <div className="help-feature-meta">
                      <span className="help-feature-name">{f.name}</span>
                      {f.badge && <span className={`help-badge help-badge-${f.badge}`}>{f.badge === 'done' ? 'Live' : 'Partial'}</span>}
                    </div>
                  </div>
                  <p className="help-feature-tagline">{f.tagline}</p>
                  <p className="help-feature-body">{f.body}</p>
                  {f.steps && (
                    <ol className="help-steps">
                      {f.steps.map((step, i) => <li key={i}>{step}</li>)}
                    </ol>
                  )}
                </div>
              ))}
            </div>
          ))}

          <div className="help-workflow">
            <div className="help-section-title">Recommended workflow</div>
            <div className="help-workflow-steps">
              {['Add Client','Scanner','Save audit','AI Visibility probe','Smart Prompts','Content Brief','Action Plan','Executive Summary'].map((s, i, arr) => (
                <span key={s} className="help-wf-row">
                  <span className="help-wf-step">{s}</span>
                  {i < arr.length - 1 && <span className="help-wf-arrow">→</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

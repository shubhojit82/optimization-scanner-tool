import type {Audit, Client, ProbeRun} from '../core/contracts';

function esc(s: string): string {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const PILLAR_MAP: Record<string, string> = {
    'crawl':'AI Visibility','technical':'Technical AI Optimization','schema':'Technical AI Optimization',
    'freshness':'Technical AI Optimization','content':'Content Analysis','entity':'Content Analysis',
    'evidence':'Content Analysis','query':'Content Analysis','reasoning-cues':'Content Analysis',
    'passage-density':'Content Analysis','entity-links':'Sentiment & Reputation',
    'measurement':'AI-era KPIs','authority':'AI-era KPIs',
};

const PILLAR_COLOR: Record<string, string> = {
    'AI Visibility':'#3b82d4','Technical AI Optimization':'#b45309',
    'Content Analysis':'#0d8073','Sentiment & Reputation':'#7c5cd8','AI-era KPIs':'#db2777',
};

const ALL_PILLARS = ['AI Visibility','Technical AI Optimization','Content Analysis','Sentiment & Reputation','AI-era KPIs'];

function scoreGrade(s: number | null): {grade: string; color: string; bg: string} {
    if (s === null) return {grade:'N/A',color:'#57606a',bg:'#f0f2f5'};
    if (s >= 80) return {grade:'A',color:'#15803d',bg:'#dcfce7'};
    if (s >= 65) return {grade:'B',color:'#0369a1',bg:'#e0f2fe'};
    if (s >= 45) return {grade:'C',color:'#b45309',bg:'#fef3c7'};
    if (s >= 25) return {grade:'D',color:'#b91c1c',bg:'#fee2e2'};
    return {grade:'F',color:'#7f1d1d',bg:'#fee2e2'};
}

function ring(score: number | null, color: string, size = 80): string {
    const v = score ?? 0;
    const r = size / 2 - 7;
    const circ = 2 * Math.PI * r;
    const cx = size / 2;
    const dash = circ * v / 100;
    const gap = circ - dash;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="7"/>
        <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${color}" stroke-width="7"
            stroke-dasharray="${dash.toFixed(1)} ${gap.toFixed(1)}" stroke-linecap="round"
            transform="rotate(-90 ${cx} ${cx})"/>
        <text x="${cx}" y="${cx}" text-anchor="middle" dominant-baseline="central"
            font-size="${score === null ? 10 : size > 70 ? 18 : 13}" font-weight="700"
            fill="${score === null ? '#9ca3af' : '#1f2328'}">${score === null ? 'N/A' : score}</text>
    </svg>`;
}

function progressBar(pct: number | null, color: string): string {
    if (pct === null) {
        return `<div style="height:8px;background:repeating-linear-gradient(90deg,#e5e7eb 0,#e5e7eb 6px,transparent 6px,transparent 12px);border-radius:4px"></div>`;
    }
    return `<div style="height:8px;background:#f0f2f5;border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:4px"></div>
    </div>`;
}

export function buildExecSummaryReport(client: Client, audit: Audit, latestRun: ProbeRun | null): string {
    const {seoScore, aeoScore, geoScore} = audit.subScores ?? {};
    const assessedDate = new Date(audit.created).toLocaleDateString('en-US', {month:'long',day:'numeric',year:'numeric'});
    const generatedAt = new Date().toLocaleDateString('en-US', {month:'long',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});

    // Projected uplift
    const QUICK: Record<string,boolean> = {'technical':true,'entity':true,'evidence':true,'query':true,'freshness':true,'reasoning-cues':true,'passage-density':true};
    let gain = 0;
    for (const d of audit.dimensions) {
        if (d.score === null || d.score >= 100 || !QUICK[d.id]) continue;
        gain += (Math.max(d.score, 80) - d.score) * d.weight / 100;
    }
    const uplift = audit.score !== null ? Math.min(100, Math.round(audit.score + gain)) - audit.score : null;

    // Top 3 priority actions
    const topActions = audit.dimensions
        .filter(d => d.score !== null && d.score < 100 && d.weight > 0)
        .map(d => ({...d, gap: Math.round(d.weight * (100 - d.score!) / 100)}))
        .sort((a,b) => b.gap - a.gap)
        .slice(0, 3);

    // Score cards row
    const scoreCards = ([
        {label:'SEO', score: seoScore ?? null, color:'#3b82d4', desc:'Crawlability, structure & schema'},
        {label:'AEO', score: aeoScore ?? null, color:'#7c5cd8', desc:'Answer-engine content signals'},
        {label:'GEO', score: geoScore ?? null, color:'#0d8073', desc:'AI visibility & brand mentions'},
    ] as const).map(({label, score, color, desc}) => {
        const {grade, bg, color: gc} = scoreGrade(score);
        return `<div class="score-card">
            <div class="score-card-top">
                <div>
                    <div class="score-label" style="color:${score===null?'#9ca3af':color}">${label}</div>
                    <div class="score-desc">${esc(desc)}</div>
                </div>
                ${score !== null ? `<span class="grade-badge" style="color:${gc};background:${bg}">${grade}</span>` : ''}
            </div>
            <div class="score-card-body">
                ${ring(score, score===null?'#d1d5db':color, 60)}
                <div class="score-num">${score === null ? '<span class="na">Not measured</span>' : `<strong>${score}</strong><span>/100</span>`}</div>
            </div>
        </div>`;
    }).join('');

    // Pillar rows
    const pillarRows = ALL_PILLARS.map(pillar => {
        const color = PILLAR_COLOR[pillar] ?? '#57606a';
        const dims = audit.dimensions.filter(d => PILLAR_MAP[d.id] === pillar);
        const assessed = dims.filter(d => d.score !== null);
        const avg = assessed.length ? Math.round(assessed.reduce((n,d) => n + d.score!, 0) / assessed.length) : null;
        const dimNames = dims.map(d => d.name).join(' · ');
        const note = avg === null ? (pillar === 'AI-era KPIs' ? 'Requires AI visibility probe runs' : 'Requires live data') : '';
        return `<div class="pillar-row">
            <div class="pillar-meta">
                <span class="pillar-name">${esc(pillar)}</span>
                <span class="pillar-dims">${esc(dimNames)}</span>
                <span class="pillar-score" style="color:${avg===null?'#9ca3af':color}">${avg === null ? '—' : avg}</span>
            </div>
            ${progressBar(avg, color)}
            ${note ? `<div class="pillar-note">${esc(note)}</div>` : ''}
        </div>`;
    }).join('');

    // AI KPI block
    let kpiHtml = '';
    if (latestRun) {
        const totalResponses = latestRun.results.length;
        const topCompetitorRate = latestRun.shareOfVoice.length
            ? Math.max(...latestRun.shareOfVoice.map(sv => sv.mentionRate)) : null;
        const sov = topCompetitorRate !== null && latestRun.mentionRate !== null
            ? latestRun.mentionRate - topCompetitorRate : null;
        const positivePct = totalResponses ? Math.round(latestRun.sentimentBreakdown.positive / totalResponses * 100) : null;
        const probeDate = new Date(latestRun.created).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'});
        const kpis = [
            {label:'Brand Mention Rate', value: latestRun.mentionRate, suffix:'%', color:'#3b82d4'},
            {label:'Domain Citation Rate', value: latestRun.citationRate, suffix:'%', color:'#7c5cd8'},
            {label:'Positive Sentiment', value: positivePct, suffix:'%', color:'#15803d'},
            {label:'Share of Voice vs #1', value: sov, suffix:' pts', color: sov !== null && sov >= 0 ? '#0d8073' : '#dc2626'},
        ];
        kpiHtml = `<section class="section">
            <div class="section-header">
                <h2>Live AI Visibility KPIs</h2>
                <p class="section-sub">From probe run on ${esc(probeDate)} · ${esc(latestRun.engines.join(', '))}</p>
            </div>
            <div class="kpi-grid">
                ${kpis.map(k => `<div class="kpi-card" style="border-top:3px solid ${k.color}">
                    <div class="kpi-label">${esc(k.label)}</div>
                    <div class="kpi-value" style="color:${k.value===null?'#9ca3af':k.color}">${k.value === null ? '—' : `${k.value}${k.suffix}`}</div>
                </div>`).join('')}
            </div>
        </section>`;
    }

    // Top actions
    const actionsHtml = topActions.map((d, i) => {
        const pillar = PILLAR_MAP[d.id] ?? 'Content Analysis';
        const pc = PILLAR_COLOR[pillar] ?? '#57606a';
        return `<div class="action-row ${i===0?'action-top':''}">
            <div class="action-num" style="background:${i===0?'#15803d':'#e5e7eb'};color:${i===0?'#fff':'#57606a'}">${i+1}</div>
            <div class="action-body">
                <div class="action-title">
                    <span class="action-name">${esc(d.name)}</span>
                    <span class="action-pillar" style="background:${pc}">${esc(pillar)}</span>
                    <span class="action-gain">+${d.gap} pts</span>
                </div>
                <p class="action-text">${esc(d.action)}</p>
                <div class="action-meta">Current score: ${d.score}/100 · Weight: ${d.weight}%</div>
            </div>
        </div>`;
    }).join('');

    // Full dimension scorecard table
    const tableRows = audit.dimensions.filter(d => d.weight > 0).map((d, i) => {
        const {grade, color, bg} = scoreGrade(d.score);
        const pillar = PILLAR_MAP[d.id] ?? '';
        const pc = PILLAR_COLOR[pillar] ?? '#57606a';
        const gap = d.score !== null ? Math.round(d.weight * (100 - d.score) / 100) : 0;
        const gapColor = gap > 10 ? '#b91c1c' : gap > 4 ? '#b45309' : '#57606a';
        return `<tr style="background:${i%2===0?'#fff':'#fafbfc'}">
            <td class="td-name">${esc(d.name)}</td>
            <td><span class="pillar-chip" style="color:${pc};background:${pc}18">${esc(pillar)}</span></td>
            <td class="td-score" style="color:${d.score===null?'#9ca3af':color}">${d.score === null ? 'N/A' : d.score}</td>
            <td><span class="grade-sm" style="color:${color};background:${bg}">${grade}</span></td>
            <td class="td-muted">${d.weight}%</td>
            <td style="color:${gapColor};font-weight:${gap>5?700:400}">${d.score!==null?`+${gap}`:'—'}</td>
            <td class="td-action">${esc(d.action)}</td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GEO Executive Summary — ${esc(client.name)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,"Segoe UI",system-ui,sans-serif;font-size:14px;line-height:1.6;color:#1f2328;background:#f7f8fa}
.page{max-width:960px;margin:0 auto;padding:32px 24px}
/* Header */
.header{background:#0f3b52;color:#fff;border-radius:12px;padding:32px 36px;margin-bottom:24px}
.header-eyebrow{font-size:11px;font-weight:700;letter-spacing:.1em;color:#78ddc6;text-transform:uppercase;margin-bottom:10px}
.header-title{font-size:1.8rem;font-weight:800;color:#fff;line-height:1.2}
.header-sub{font-size:13px;color:#92ded0;margin-top:8px}
.header-meta{font-size:11px;color:#6ab8ab;margin-top:6px}
.header-body{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:20px}
.header-rings{display:flex;gap:24px;align-items:center;flex-shrink:0}
.ring-block{text-align:center}
.ring-label{font-size:11px;font-weight:700;color:#78ddc6;margin-top:5px;letter-spacing:.06em;text-transform:uppercase}
.uplift-block{text-align:center}
.uplift-val{font-size:2rem;font-weight:800;color:#57e3c2;line-height:1}
.uplift-label{font-size:10px;font-weight:700;color:#78ddc6;margin-top:4px;letter-spacing:.06em;text-transform:uppercase}
.uplift-hint{font-size:10px;color:#6ab8ab;margin-top:2px}
/* Score cards */
.score-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px}
.score-card{background:#fff;border:1px solid #e0e7ed;border-radius:10px;padding:18px 20px}
.score-card-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
.score-label{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
.score-desc{font-size:12px;color:#57606a;margin-top:2px}
.grade-badge{font-size:18px;font-weight:800;border-radius:8px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.score-card-body{display:flex;align-items:center;gap:12px}
.score-num{font-size:13px;color:#57606a}
.score-num strong{font-size:22px;font-weight:800;color:#213f50}
.score-num span{font-size:13px;font-weight:400;color:#8b9aa6}
.na{font-size:12px;color:#8b9aa6}
/* Sections */
.section{background:#fff;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:20px;overflow:hidden}
.section-header{padding:18px 24px;border-bottom:1px solid #f0f2f5}
.section-header h2{font-size:15px;font-weight:700;color:#213f50}
.section-header p.section-sub{font-size:12px;color:#8b9aa6;margin-top:2px}
.section-body{padding:16px 24px 20px}
/* Pillars */
.pillar-row{margin-bottom:16px}
.pillar-row:last-child{margin-bottom:0}
.pillar-meta{display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap}
.pillar-name{font-size:13px;font-weight:650;color:#213f50}
.pillar-dims{font-size:11px;color:#8b9aa6;flex:1}
.pillar-score{font-size:14px;font-weight:800;min-width:36px;text-align:right}
.pillar-note{font-size:10px;color:#9ca3af;margin-top:3px}
/* AI KPIs */
.kpi-grid{display:flex;gap:16px;flex-wrap:wrap;padding:16px 24px 20px}
.kpi-card{flex:1 1 160px;background:#f7f8fa;border-radius:9px;padding:14px 16px}
.kpi-label{font-size:10px;font-weight:700;color:#8b9aa6;letter-spacing:.07em;text-transform:uppercase;margin-bottom:6px}
.kpi-value{font-size:26px;font-weight:800;line-height:1}
/* Actions */
.actions-body{padding:14px 24px 20px;display:flex;flex-direction:column;gap:12px}
.action-row{display:flex;gap:14px;align-items:flex-start;padding:14px 16px;background:#fafbfc;border-radius:9px;border:1px solid #e5e7eb}
.action-top{background:#f0fdf4;border-color:#bbf7d0}
.action-num{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0}
.action-body{flex:1;min-width:0}
.action-title{display:flex;align-items:center;gap:8px;margin-bottom:5px;flex-wrap:wrap}
.action-name{font-weight:700;font-size:.92rem;color:#213f50}
.action-pillar{font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;color:#fff}
.action-gain{font-size:11px;font-weight:700;color:#15803d}
.action-text{font-size:.83rem;color:#374151;line-height:1.6}
.action-meta{font-size:11px;color:#8b9aa6;margin-top:5px}
/* Scorecard table */
.scorecard-wrap{overflow-x:auto;padding-bottom:8px}
table{width:100%;border-collapse:collapse;font-size:12px}
thead tr{background:#f7f8fa;border-bottom:2px solid #e5e7eb}
th{padding:8px 14px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.07em;color:#8b9aa6;text-transform:uppercase;white-space:nowrap}
td{padding:9px 14px;border-bottom:1px solid #f0f2f5}
.td-name{font-weight:600;color:#213f50}
.td-score{font-weight:700}
.td-muted{color:#57606a}
.td-action{color:#57606a;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pillar-chip{font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px}
.grade-sm{font-size:11px;font-weight:800;padding:2px 8px;border-radius:6px}
/* Footer */
.footer{text-align:center;font-size:11px;color:#8b9aa6;margin-top:28px;padding-top:14px;border-top:1px solid #e5e7eb;line-height:1.7}
/* Print */
@media print {
    body{background:#fff}
    .page{padding:16px}
    .header{background:#0f3b52 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .score-cards,.section,.kpi-grid,.actions-body{page-break-inside:avoid}
    .score-card,.action-row,.kpi-card{break-inside:avoid}
    @page{margin:1.5cm 1.8cm}
}
@media(max-width:640px){
    .score-cards{grid-template-columns:1fr}
    .header-body{flex-direction:column}
    .header-rings{justify-content:flex-start}
}
</style>
</head>
<body>
<div class="page">

<!-- Header -->
<div class="header">
    <div class="header-body">
        <div>
            <div class="header-eyebrow">GEO Readiness Assessment</div>
            <div class="header-title">${esc(client.name)}</div>
            <div class="header-sub">${esc(client.domain.replace('https://', ''))} · ${esc(client.industry)} · ${esc(client.market)}</div>
            <div class="header-meta">Assessed ${esc(assessedDate)} · Rubric ${esc(audit.version)} · ${audit.coverage}% coverage</div>
        </div>
        <div class="header-rings">
            <div class="ring-block">
                ${ring(audit.score, '#57e3c2', 90)}
                <div class="ring-label">Overall</div>
            </div>
            ${uplift !== null && uplift > 0 ? `<div class="uplift-block">
                <div class="uplift-val">+${uplift}</div>
                <div class="uplift-label">Pts Uplift</div>
                <div class="uplift-hint">with quick wins</div>
            </div>` : ''}
        </div>
    </div>
</div>

<!-- Score cards -->
<div class="score-cards">${scoreCards}</div>

${kpiHtml}

<!-- GEO Readiness Pillars -->
<section class="section">
    <div class="section-header">
        <h2>GEO Readiness Pillars</h2>
        <p class="section-sub">Score contribution per GEO readiness framework pillar — all 5 pillars shown; unmeasured pillars shown with dashes</p>
    </div>
    <div class="section-body">${pillarRows}</div>
</section>

<!-- Top 3 recommendations -->
<section class="section">
    <div class="section-header">
        <h2>Top 3 Priority Recommendations</h2>
        <p class="section-sub">Highest weighted-impact actions — present these to the client as immediate next steps</p>
    </div>
    <div class="actions-body">${actionsHtml}</div>
</section>

<!-- Full dimension scorecard -->
<section class="section">
    <div class="section-header">
        <h2>Full Dimension Scorecard</h2>
        <p class="section-sub">All rubric dimensions with scores, weights, and gap analysis</p>
    </div>
    <div class="scorecard-wrap">
        <table>
            <thead>
                <tr>
                    <th>Dimension</th><th>Pillar</th><th>Score</th><th>Grade</th>
                    <th>Weight</th><th>Gap</th><th>Action</th>
                </tr>
            </thead>
            <tbody>${tableRows}</tbody>
        </table>
    </div>
</section>

<div class="footer">
    Assessment based on page-level HTML analysis · Rubric ${esc(audit.version)} · ${audit.coverage}% rubric coverage<br>
    Scores reflect implementation cues only — not a ranking guarantee. Live AI visibility requires probe runs.<br>
    Generated ${esc(generatedAt)} · AI Search Intelligence
</div>

</div>
</body>
</html>`;
}

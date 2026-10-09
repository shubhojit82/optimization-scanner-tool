import type {CategoryReport, AuditFinding} from '../core/contracts';
import type {FullReport} from '../core/report-analysis';

function esc(s: string): string {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function ring(score: number | null, color: string, label: string, size = 90): string {
    const s = score ?? 0;
    const pct = s / 100;
    const r = (size / 2) - 8;
    const circ = 2 * Math.PI * r;
    const dash = circ * pct;
    const gap = circ - dash;
    const cx = size / 2;
    return `<div class="ring-wrap"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="8"/>
        <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${color}" stroke-width="8"
            stroke-dasharray="${dash.toFixed(1)} ${gap.toFixed(1)}"
            stroke-linecap="round" transform="rotate(-90 ${cx} ${cx})"/>
        <text x="${cx}" y="${cx}" text-anchor="middle" dominant-baseline="central" font-size="${score===null?11:18}" font-weight="700" fill="${score===null?'#8b9aa6':color}">${score === null ? 'N/A' : score}</text>
    </svg><div class="ring-label">${esc(label)}</div></div>`;
}

function impactBadge(impact: AuditFinding['impact']): string {
    const map: Record<string, [string, string]> = {
        critical: ['#b91c1c', '#fee2e2'],
        serious: ['#b45309', '#fef3c7'],
        moderate: ['#1d4ed8', '#dbeafe'],
        minor: ['#57606a', '#f0f2f5'],
        info: ['#0d8073', '#e0f7f4'],
    };
    const [color, bg] = map[impact] ?? ['#57606a', '#f0f2f5'];
    return `<span class="badge" style="color:${color};background:${bg}">${esc(impact)}</span>`;
}

function findingRow(f: AuditFinding): string {
    const icon = f.passed
        ? `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="#dcfce7" stroke="#15803d"/><path d="M5 8l2 2 4-4" stroke="#15803d" stroke-width="1.5" stroke-linecap="round"/></svg>`
        : `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="#fee2e2" stroke="#b91c1c"/><path d="M5.5 10.5l5-5M10.5 10.5l-5-5" stroke="#b91c1c" stroke-width="1.5" stroke-linecap="round"/></svg>`;

    return `<div class="finding ${f.passed ? 'passed' : 'failed'}">
        <div class="finding-head">
            <span class="finding-icon">${icon}</span>
            <span class="finding-title">${esc(f.title)}</span>
            ${!f.passed ? impactBadge(f.impact) : ''}
        </div>
        <div class="finding-body">
            <p class="finding-desc">${esc(f.description)}</p>
            ${f.detail ? `<div class="finding-detail"><span class="detail-label">FOUND</span><code>${esc(f.detail)}</code></div>` : ''}
            ${!f.passed && f.howToFix ? `<div class="finding-fix"><span class="detail-label">HOW TO FIX</span>${esc(f.howToFix)}</div>` : ''}
        </div>
    </div>`;
}

function scoreColor(score: number | null): string {
    if (score === null) return '#8b9aa6';
    if (score >= 90) return '#15803d';
    if (score >= 50) return '#b45309';
    return '#b91c1c';
}

function categorySection(cat: CategoryReport): string {
    const color = cat.id === 'seo' ? '#3b82d4' : cat.id === 'aeo' ? '#7c5cd8' : cat.id === 'geo' ? '#0d8073' : cat.id === 'accessibility' ? '#b45309' : '#1d4ed8';
    const failed = cat.findings.filter(f => !f.passed);
    const passed = cat.findings.filter(f => f.passed);
    const desc: Record<string, string> = {
        seo: 'Technical crawlability, page structure, structured data and content freshness. Ensures search and AI crawlers can discover and index the page.',
        aeo: 'Answer structure, brand clarity and reference cues. Ensures the page directly answers questions AI engines are likely to ask.',
        geo: 'AI visibility monitoring and external authority signals. Measures whether AI engines mention and cite this brand in generated answers.',
        accessibility: 'Conformance with WCAG 2.1 accessibility guidelines. Automated checks for the most impactful issues — manual testing is also required.',
        'best-practices': 'Security headers, performance hints and modern web standards. Issues here affect trust, security and load behaviour.',
    };

    return `<section class="cat-section" id="${esc(cat.id)}">
        <div class="cat-header">
            <div class="cat-title-row">
                ${ring(cat.score, color, cat.label, 80)}
                <div>
                    <h2 class="cat-title" style="color:${color}">${esc(cat.label)}</h2>
                    <p class="cat-desc">${esc(desc[cat.id] ?? '')}</p>
                </div>
            </div>
            <div class="cat-summary">
                <span class="summary-pill fail-pill">${failed.length} issue${failed.length !== 1 ? 's' : ''}</span>
                <span class="summary-pill pass-pill">${passed.length} passed</span>
            </div>
        </div>

        ${failed.length > 0 ? `<div class="findings-group">
            <div class="findings-group-label">FAILED AUDITS (${failed.length})</div>
            ${failed.map(findingRow).join('')}
        </div>` : ''}

        ${passed.length > 0 ? `<details class="passed-details">
            <summary>PASSED AUDITS (${passed.length})</summary>
            <div class="findings-group no-top">
                ${passed.map(findingRow).join('')}
            </div>
        </details>` : ''}
    </section>`;
}

export function buildHtmlReport(report: FullReport): string {
    const categories = report.categories;
    const dominated: {id: string; label: string; color: string}[] = [
        {id: 'seo', label: 'SEO', color: '#3b82d4'},
        {id: 'aeo', label: 'AEO', color: '#7c5cd8'},
        {id: 'geo', label: 'GEO', color: '#0d8073'},
        {id: 'accessibility', label: 'Accessibility', color: '#b45309'},
        {id: 'best-practices', label: 'Best Practices', color: '#1d4ed8'},
    ];
    const totalFailed = categories.reduce((n: number, c: CategoryReport) => n + c.findings.filter((f: AuditFinding) => !f.passed).length, 0);
    const totalPassed = categories.reduce((n: number, c: CategoryReport) => n + c.findings.filter((f: AuditFinding) => f.passed).length, 0);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GEO Workbench Report — ${esc(report.url)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,"Segoe UI",system-ui,sans-serif;font-size:14px;line-height:1.6;color:#1f2328;background:#f7f8fa}
a{color:#0d8073;text-decoration:none}
a:hover{text-decoration:underline}
code{font-family:ui-monospace,monospace;font-size:12px;background:#f0f2f5;padding:2px 6px;border-radius:4px;word-break:break-all}
.page{max-width:900px;margin:0 auto;padding:32px 24px}
/* Header */
.report-header{background:#0f3b52;color:#fff;border-radius:12px;padding:32px;margin-bottom:28px}
.report-url{font-size:13px;color:#78ddc6;margin-bottom:8px;word-break:break-all}
.report-url a{color:#78ddc6}
.report-title{font-size:22px;font-weight:800;margin-bottom:4px}
.report-meta{font-size:12px;color:#8bb8c8;margin-top:8px}
/* Score rings summary */
.scores-row{display:flex;gap:20px;flex-wrap:wrap;margin:24px 0 0;align-items:flex-end}
.ring-wrap{display:flex;flex-direction:column;align-items:center;gap:5px}
.ring-label{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#78ddc6}
/* Summary bar */
.summary-bar{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:18px 24px;margin-bottom:24px;display:flex;gap:24px;flex-wrap:wrap;align-items:center}
.summary-stat{display:flex;flex-direction:column;gap:2px}
.summary-stat-value{font-size:22px;font-weight:800;color:#213f50}
.summary-stat-label{font-size:11px;color:#8b9aa6;font-weight:600;letter-spacing:.05em;text-transform:uppercase}
/* Nav */
.cat-nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px}
.cat-nav a{font-size:12px;font-weight:700;padding:6px 14px;border-radius:20px;border:1px solid #e5e7eb;background:#fff;cursor:pointer;text-decoration:none;color:#57606a;transition:all .15s}
.cat-nav a:hover{background:#f0f6f7;border-color:#c9d6dc}
/* Category section */
.cat-section{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:0;margin-bottom:20px;overflow:hidden}
.cat-header{padding:22px 24px;border-bottom:1px solid #f0f2f5}
.cat-title-row{display:flex;gap:18px;align-items:flex-start;margin-bottom:12px}
.cat-title{font-size:18px;font-weight:800;margin-bottom:4px}
.cat-desc{font-size:12px;color:#57606a;line-height:1.6;max-width:600px}
.cat-summary{display:flex;gap:8px;flex-wrap:wrap}
.summary-pill{font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px}
.fail-pill{background:#fee2e2;color:#b91c1c}
.pass-pill{background:#dcfce7;color:#15803d}
/* Findings */
.findings-group{padding:0 24px 16px}
.findings-group-label{font-size:10px;font-weight:700;letter-spacing:.08em;color:#8b9aa6;padding:14px 0 8px;text-transform:uppercase}
.findings-group.no-top{padding-top:0}
.finding{border:1px solid #e5e7eb;border-radius:8px;margin-bottom:10px;overflow:hidden}
.finding.passed{border-color:#d1fae5}
.finding.failed{border-color:#fde8e8}
.finding-head{display:flex;align-items:center;gap:10px;padding:11px 14px;background:#fafbfc;flex-wrap:wrap;cursor:pointer}
.finding.failed .finding-head{background:#fff8f8}
.finding.passed .finding-head{background:#f0fdf4}
.finding-icon{display:flex;align-items:center;flex-shrink:0}
.finding-title{font-weight:700;font-size:13px;color:#213f50;flex:1}
.badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;text-transform:uppercase;letter-spacing:.05em}
.finding-body{padding:12px 14px 14px;border-top:1px solid #f0f2f5}
.finding.passed .finding-body{display:none}
.finding-desc{font-size:12px;color:#57606a;line-height:1.6;margin-bottom:8px}
.finding-detail{margin-bottom:8px}
.finding-fix{font-size:12px;color:#1c1917;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px 12px;line-height:1.7}
.detail-label{display:block;font-size:10px;font-weight:700;letter-spacing:.07em;color:#92400e;margin-bottom:4px}
.finding-detail .detail-label{color:#57606a}
/* Passed details */
.passed-details{padding:0 24px 0}
.passed-details summary{font-size:11px;font-weight:700;letter-spacing:.07em;color:#15803d;padding:12px 0 6px;cursor:pointer;list-style:none;text-transform:uppercase}
.passed-details summary::-webkit-details-marker{display:none}
/* Footer */
.report-footer{text-align:center;font-size:11px;color:#8b9aa6;margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb}
@media print{
    body{background:#fff}
    .page{padding:20px}
    .report-header{background:#0f3b52 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .finding.passed .finding-body{display:none}
    .passed-details{display:none}
    details[open] summary::after{content:''}
}
@media(max-width:640px){.scores-row{gap:14px}.cat-title-row{flex-direction:column}.page{padding:18px 14px}}
</style>
</head>
<body>
<div class="page">

    <!-- Header -->
    <div class="report-header">
        <div class="report-url"><a href="${esc(report.url)}" target="_blank" rel="noopener">${esc(report.url)}</a></div>
        <div class="report-title">GEO Workbench — Full Audit Report</div>
        <div class="report-meta">
            Client: <strong>${esc(report.client.name)}</strong> · ${esc(report.client.industry)} · ${esc(report.client.market)}<br>
            Generated: ${new Date(report.generatedAt).toLocaleString()} · Audit ID: ${esc(report.auditId.slice(0, 8))}…
        </div>
        <div class="scores-row">
            ${dominated.map((d: {id: string; label: string; color: string}) => {
                const cat = categories.find((c: CategoryReport) => c.id === d.id);
                return ring(cat?.score ?? null, d.color, d.label, 80);
            }).join('')}
        </div>
    </div>

    <!-- Summary bar -->
    <div class="summary-bar">
        <div class="summary-stat"><span class="summary-stat-value">${totalFailed}</span><span class="summary-stat-label">Issues to fix</span></div>
        <div class="summary-stat"><span class="summary-stat-value">${totalPassed}</span><span class="summary-stat-label">Passed audits</span></div>
        <div class="summary-stat"><span class="summary-stat-value">${report.overallScore}</span><span class="summary-stat-label">Overall score</span></div>
        <div class="summary-stat" style="margin-left:auto;font-size:12px;color:#57606a;max-width:260px;line-height:1.5">
            This report covers SEO, AEO, GEO, Accessibility, and Best Practices.<br>
            Share with your development team to apply fixes.
        </div>
    </div>

    <!-- Category nav -->
    <div class="cat-nav">
        ${dominated.map(d => `<a href="#${esc(d.id)}">${esc(d.label)}</a>`).join('')}
    </div>

    <!-- Categories -->
    ${categories.map(categorySection).join('')}

    <div class="report-footer">
        Generated by GEO Workbench · ${new Date(report.generatedAt).toLocaleDateString()} · ${esc(report.url)}
        <br><small>Automated analysis only. Manual review is required for accessibility and performance testing.</small>
    </div>
</div>
</body>
</html>`;
}

import ExcelJS from 'exceljs';
import type {SiteScanResult} from './site-crawler';
import type {Client} from '../core/contracts';

const HDR: Partial<ExcelJS.Style> = {
    fill: {type:'pattern', pattern:'solid', fgColor:{argb:'FF0F3B52'}},
    font: {color:{argb:'FFFFFFFF'}, bold:true},
};

export async function buildSiteXlsx(client: Client, result: SiteScanResult): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'GEO Workbench';
    wb.created = new Date();

    // ── Sheet 1: Summary ────────────────────────────────────────────────────
    const sum = wb.addWorksheet('Site Summary');
    sum.columns = [{key:'f',width:28},{key:'v',width:60}];
    const addRow = (f: string, v: string | number) => sum.addRow({f, v});
    sum.addRow({f:'GEO Workbench — Site Scan Report', v:''}).getCell('f').font = {bold:true, size:14};
    sum.addRow({});
    addRow('Client', client.name);
    addRow('Domain', client.domain);
    addRow('Start URL', result.startUrl);
    addRow('Crawled at', result.crawledAt);
    sum.addRow({});
    addRow('Pages crawled', result.pagesAttempted);
    addRow('Pages scored', result.pagesScored);
    addRow('Average GEO score', result.avgScore !== null ? `${result.avgScore} / 100` : 'N/A');
    addRow('Average coverage', result.avgCoverage !== null ? `${result.avgCoverage}%` : 'N/A');
    sum.addRow({});
    addRow('Most common gaps', result.commonGaps.slice(0,5).map(g=>`${g.name} (${g.count} pages)`).join(', '));
    sum.getRow(1).eachCell(c => Object.assign(c, HDR));

    // ── Sheet 2: All pages ───────────────────────────────────────────────────
    const pages = wb.addWorksheet('All Pages');
    pages.columns = [
        {header:'URL', key:'url', width:55},
        {header:'Score', key:'score', width:10},
        {header:'vs Avg', key:'vsAvg', width:10},
        {header:'Coverage', key:'cov', width:12},
        {header:'HTTP', key:'status', width:8},
        {header:'Depth', key:'depth', width:8},
        {header:'Top gap', key:'gap', width:45},
        {header:'Flags', key:'flags', width:40},
    ];
    pages.getRow(1).eachCell(c => Object.assign(c, HDR));
    for (const p of result.pages) {
        const score = p.audit?.score ?? null;
        const vsAvg = score !== null && result.avgScore !== null ? score - result.avgScore : null;
        const topGap = p.audit?.dimensions
            .filter(d => d.score !== null && d.score < 100)
            .sort((a,b) => b.weight*(100-b.score!) - a.weight*(100-a.score!))[0];
        const row = pages.addRow({
            url: p.url,
            score: score !== null ? score : 'Failed',
            vsAvg: vsAvg !== null ? (vsAvg >= 0 ? `+${vsAvg}` : `${vsAvg}`) : '',
            cov: p.audit ? `${p.audit.coverage}%` : '',
            status: p.status,
            depth: p.depth,
            gap: topGap ? topGap.action : p.flags[0]?.message ?? '',
            flags: p.flags.map(f=>f.code).join(', '),
        });
        row.alignment = {wrapText:true, vertical:'top'};
        if (score !== null) {
            const c = row.getCell('score');
            c.fill = {type:'pattern',pattern:'solid',fgColor:{argb: score>=75?'FF57E3C2':score>=40?'FFFFD966':'FFFF7C7C'}};
        }
        if (vsAvg !== null) {
            const c = row.getCell('vsAvg');
            c.font = {color:{argb: vsAvg>0?'FF15803D':vsAvg<0?'FFB91C1C':'FF57606A'}, bold:Math.abs(vsAvg)>=5};
        }
    }

    // ── Sheet 3: Dimension breakdown ─────────────────────────────────────────
    const dims = wb.addWorksheet('Dimension Breakdown');
    dims.columns = [
        {header:'URL', key:'url', width:45},
        {header:'Dimension', key:'dim', width:22},
        {header:'Weight', key:'wt', width:10},
        {header:'Score', key:'score', width:10},
        {header:'Action', key:'action', width:55},
    ];
    dims.getRow(1).eachCell(c => Object.assign(c, HDR));
    for (const p of result.pages) {
        if (!p.audit) continue;
        for (const d of p.audit.dimensions) {
            const row = dims.addRow({url:p.url, dim:d.name, wt:`${d.weight}%`, score:d.score??'Not assessed', action:d.action});
            row.alignment = {wrapText:true, vertical:'top'};
            if (d.score !== null) {
                const c = row.getCell('score');
                c.fill = {type:'pattern',pattern:'solid',fgColor:{argb:d.score>=75?'FF57E3C2':d.score>=40?'FFFFD966':'FFFF7C7C'}};
            }
        }
    }

    // ── Sheet 4: Site-wide gaps ───────────────────────────────────────────────
    const gaps = wb.addWorksheet('Site Gaps');
    gaps.columns = [
        {header:'Dimension', key:'dim', width:24},
        {header:'Weight', key:'wt', width:10},
        {header:'Pages affected', key:'count', width:16},
        {header:'% of scored pages', key:'pct', width:20},
    ];
    gaps.getRow(1).eachCell(c => Object.assign(c, HDR));
    for (const g of result.commonGaps) {
        gaps.addRow({dim:g.name, wt:`${g.weight}%`, count:g.count, pct: result.pagesScored ? `${Math.round(g.count/result.pagesScored*100)}%` : ''});
    }

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
}

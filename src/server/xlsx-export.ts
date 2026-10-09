import ExcelJS from 'exceljs';
import type {ScanResult} from '../application/scanner';
import type {Client} from '../core/contracts';

export async function buildXlsx(client: Client, result: ScanResult): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'GEO Workbench';
    wb.created = new Date();

    // ── Sheet 1: Summary ─────────────────────────────────────────────────────
    const summary = wb.addWorksheet('Summary');
    summary.columns = [
        {key: 'field', width: 28},
        {key: 'value', width: 60},
    ];
    const headerStyle: Partial<ExcelJS.Style> = {
        fill: {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FF0F3B52'}},
        font: {color: {argb: 'FFFFFFFF'}, bold: true},
    };
    const addRow = (field: string, value: string | number, bold = false) => {
        const r = summary.addRow({field, value});
        if (bold) r.getCell('field').font = {bold: true};
    };
    summary.addRow({field: 'GEO Workbench — Site Scan Report', value: ''}).getCell('field').font = {bold: true, size: 14};
    summary.addRow({});
    addRow('Client', client.name, true);
    addRow('Domain', client.domain);
    addRow('Industry', client.industry);
    addRow('Market', client.market);
    addRow('Scanned URL', result.url);
    addRow('Fetched at', result.fetchedAt);
    addRow('HTTP status', result.status);
    summary.addRow({});
    if (result.audit) {
        addRow('Overall Readiness Score', `${result.audit.score} / 100`, true);
        addRow('SEO Score', result.audit.subScores.seoScore !== null ? `${result.audit.subScores.seoScore} / 100` : 'Not assessed (needs live crawl)');
        addRow('AEO Score', result.audit.subScores.aeoScore !== null ? `${result.audit.subScores.aeoScore} / 100` : 'Not assessed');
        addRow('GEO Score', result.audit.subScores.geoScore !== null ? `${result.audit.subScores.geoScore} / 100` : 'Not assessed (run observations)');
        addRow('Rubric coverage', `${result.audit.coverage}%`);
        addRow('Rubric version', result.audit.version);
    } else {
        addRow('Overall Readiness Score', 'Not assessed — page could not be fetched');
    }
    summary.addRow({});
    addRow('Blocking flags', result.flags.length ? result.flags.map(f => `[${f.code}] ${f.message}`).join('\n') : 'None');
    summary.getRow(1).eachCell(c => Object.assign(c, headerStyle));
    summary.getRow(1).height = 22;

    // ── Sheet 2: Dimensions ───────────────────────────────────────────────────
    const dims = wb.addWorksheet('Dimensions');
    dims.columns = [
        {header: 'Dimension', key: 'name', width: 24},
        {header: 'Weight %', key: 'weight', width: 12},
        {header: 'Score', key: 'score', width: 10},
        {header: 'Evidence', key: 'evidence', width: 55},
        {header: 'Recommended action', key: 'action', width: 55},
    ];
    dims.getRow(1).eachCell(c => { Object.assign(c, headerStyle); });
    dims.getRow(1).height = 20;

    if (result.audit) {
        for (const d of result.audit.dimensions) {
            const row = dims.addRow({
                name: d.name,
                weight: d.weight,
                score: d.score === null ? 'Not assessed' : d.score,
                evidence: d.evidence,
                action: d.action,
            });
            row.alignment = {wrapText: true, vertical: 'top'};
            // Colour-code score cell
            if (d.score !== null) {
                const cell = row.getCell('score');
                cell.fill = {
                    type: 'pattern', pattern: 'solid',
                    fgColor: {argb: d.score >= 75 ? 'FF57E3C2' : d.score >= 40 ? 'FFFFD966' : 'FFFF7C7C'},
                };
            }
        }
    } else {
        dims.addRow({name: 'No data', weight: '', score: '', evidence: 'Page fetch failed — resolve blocking flags and rescan.', action: ''});
    }

    // ── Sheet 3: Blocking flags ───────────────────────────────────────────────
    const flagSheet = wb.addWorksheet('Blocking flags');
    flagSheet.columns = [
        {header: 'Code', key: 'code', width: 28},
        {header: 'Description', key: 'message', width: 80},
    ];
    flagSheet.getRow(1).eachCell(c => { Object.assign(c, headerStyle); });
    if (result.flags.length) {
        for (const f of result.flags) {
            flagSheet.addRow({code: f.code, message: f.message}).alignment = {wrapText: true};
        }
    } else {
        flagSheet.addRow({code: 'NONE', message: 'No blocking issues detected.'});
    }

    // ── Sheet 4: Priority actions ─────────────────────────────────────────────
    const actions = wb.addWorksheet('Priority actions');
    actions.columns = [
        {header: 'Priority', key: 'priority', width: 10},
        {header: 'Dimension', key: 'name', width: 24},
        {header: 'Weighted gap', key: 'gap', width: 14},
        {header: 'Recommended action', key: 'action', width: 70},
        {header: 'Evidence', key: 'evidence', width: 60},
    ];
    actions.getRow(1).eachCell(c => { Object.assign(c, headerStyle); });
    if (result.audit) {
        const opportunities = result.audit.dimensions
            .filter(d => d.score !== null && d.score < 100)
            .sort((a, b) => b.weight * (100 - b.score!) - a.weight * (100 - a.score!));
        opportunities.forEach((d, i) => {
            actions.addRow({
                priority: i + 1,
                name: d.name,
                gap: `${(d.weight * (100 - d.score!) / 100).toFixed(1)} pts`,
                action: d.action,
                evidence: d.evidence,
            }).alignment = {wrapText: true, vertical: 'top'};
        });
        if (!opportunities.length) {
            actions.addRow({priority: '-', name: 'None', gap: '0', action: 'All assessed dimensions are at 100. Review unassessed dimensions.', evidence: ''});
        }
    }

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
}

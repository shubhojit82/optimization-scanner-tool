import type {ReactNode, ElementType} from 'react';

/**
 * Lightweight markdown → React renderer.
 * Handles: h1-h3, bold, italic, inline code, links, hr,
 * unordered/ordered lists, blockquotes, fenced code blocks, tables.
 * No external deps — uses only React primitives.
 */

// ─── inline renderer ─────────────────────────────────────────────────────────

function inlineNodes(text: string, key?: string): ReactNode {
    const parts: ReactNode[] = [];
    // Pattern order matters: code > bold+italic > bold > italic > link
    const re = /(`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|\[([^\]]+)\]\(([^)]+)\))/g;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) parts.push(text.slice(last, m.index));
        const t = m[0];
        if (t.startsWith('`')) {
            parts.push(<code key={m.index} style={{background:'#f0f2f5',borderRadius:3,padding:'1px 5px',fontSize:'.87em',fontFamily:'monospace'}}>{t.slice(1,-1)}</code>);
        } else if (t.startsWith('***')) {
            parts.push(<strong key={m.index}><em>{t.slice(3,-3)}</em></strong>);
        } else if (t.startsWith('**')) {
            parts.push(<strong key={m.index}>{t.slice(2,-2)}</strong>);
        } else if (t.startsWith('*')) {
            parts.push(<em key={m.index}>{t.slice(1,-1)}</em>);
        } else if (m[2] && m[3]) {
            parts.push(<a key={m.index} href={m[3]} target="_blank" rel="noreferrer" style={{color:'#0d7a6b',textDecoration:'underline'}}>{m[2]}</a>);
        }
        last = m.index + t.length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts.length === 1 ? parts[0] : <span key={key}>{parts}</span>;
}

// ─── block tokeniser ─────────────────────────────────────────────────────────

type Block =
    | {type:'heading'; level:1|2|3; text:string}
    | {type:'hr'}
    | {type:'blockquote'; lines:string[]}
    | {type:'code'; lang:string; lines:string[]}
    | {type:'table'; head:string[]; align:string[]; rows:string[][]}
    | {type:'ul'; items:string[][]}   // nested: item can have sub-lines
    | {type:'ol'; items:string[][]}
    | {type:'p'; lines:string[]};

function tokenise(md: string): Block[] {
    const lines = md.split('\n');
    const blocks: Block[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Blank line — skip
        if (line.trim() === '') { i++; continue; }

        // Fenced code block
        if (/^```/.test(line)) {
            const lang = line.slice(3).trim();
            const code: string[] = [];
            i++;
            while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
            i++; // closing ```
            blocks.push({type:'code', lang, lines:code});
            continue;
        }

        // Heading
        const hm = line.match(/^(#{1,3})\s+(.*)/);
        if (hm) {
            blocks.push({type:'heading', level: hm[1].length as 1|2|3, text: hm[2].trim()});
            i++; continue;
        }

        // HR
        if (/^[-*_]{3,}\s*$/.test(line.trim())) {
            blocks.push({type:'hr'});
            i++; continue;
        }

        // Blockquote
        if (/^>/.test(line)) {
            const bq: string[] = [];
            while (i < lines.length && /^>/.test(lines[i])) {
                bq.push(lines[i].replace(/^>\s?/, ''));
                i++;
            }
            blocks.push({type:'blockquote', lines:bq});
            continue;
        }

        // Table (must have separator row)
        if (/^\|/.test(line) && i + 1 < lines.length && /^\|[-:| ]+\|/.test(lines[i+1])) {
            const head = line.split('|').slice(1,-1).map(s => s.trim());
            const align = lines[i+1].split('|').slice(1,-1).map(s => s.trim());
            i += 2;
            const rows: string[][] = [];
            while (i < lines.length && /^\|/.test(lines[i])) {
                rows.push(lines[i].split('|').slice(1,-1).map(s => s.trim()));
                i++;
            }
            blocks.push({type:'table', head, align, rows});
            continue;
        }

        // Unordered list
        if (/^[-*+]\s/.test(line)) {
            const items: string[][] = [];
            while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
                const item = [lines[i].replace(/^[-*+]\s/, '')];
                i++;
                while (i < lines.length && /^\s{2,}/.test(lines[i])) { item.push(lines[i].trim()); i++; }
                items.push(item);
            }
            blocks.push({type:'ul', items});
            continue;
        }

        // Ordered list
        if (/^\d+\.\s/.test(line)) {
            const items: string[][] = [];
            while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
                const item = [lines[i].replace(/^\d+\.\s/, '')];
                i++;
                while (i < lines.length && /^\s{2,}/.test(lines[i])) { item.push(lines[i].trim()); i++; }
                items.push(item);
            }
            blocks.push({type:'ol', items});
            continue;
        }

        // Paragraph — collect until blank or block-start
        const pLines: string[] = [];
        while (
            i < lines.length &&
            lines[i].trim() !== '' &&
            !/^(#{1,3}\s|```|>|[-*+]\s|\d+\.\s|[-*_]{3,}\s*$|\|)/.test(lines[i])
        ) {
            pLines.push(lines[i]);
            i++;
        }
        if (pLines.length) blocks.push({type:'p', lines: pLines});
    }
    return blocks;
}

// ─── block renderer ────────────────────────────────────────────────────────

const H: Record<number, ElementType> = {1:'h2', 2:'h3', 3:'h4'};
const hStyle: Record<number, React.CSSProperties> = {
    1: {fontSize:'1.1rem', fontWeight:700, margin:'20px 0 6px', color:'#0f3b52'},
    2: {fontSize:'1rem',   fontWeight:650, margin:'16px 0 4px', color:'#1a3f52'},
    3: {fontSize:'.95rem', fontWeight:650, margin:'12px 0 4px', color:'#213f50'},
};

function renderBlock(block: Block, idx: number): ReactNode {
    switch (block.type) {
        case 'heading': {
            const Tag = H[block.level] as ElementType;
            return <Tag key={idx} style={hStyle[block.level]}>{inlineNodes(block.text)}</Tag>;
        }
        case 'hr':
            return <hr key={idx} style={{border:'none',borderTop:'1px solid #e5e7eb',margin:'14px 0'}}/>;
        case 'blockquote':
            return (
                <blockquote key={idx} style={{borderLeft:'3px solid #57e3c2',margin:'10px 0',padding:'6px 14px',background:'#f4fbf9',borderRadius:'0 5px 5px 0',fontSize:'.9rem',color:'#213f50'}}>
                    {block.lines.map((l,i) => <p key={i} style={{margin:0}}>{inlineNodes(l)}</p>)}
                </blockquote>
            );
        case 'code':
            return (
                <pre key={idx} style={{background:'#1e2d38',color:'#a8d8cc',borderRadius:7,padding:'12px 16px',fontSize:'.82rem',overflowX:'auto',margin:'10px 0',lineHeight:1.55,fontFamily:'monospace'}}>
                    <code>{block.lines.join('\n')}</code>
                </pre>
            );
        case 'table':
            return (
                <div key={idx} style={{overflowX:'auto',margin:'12px 0'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.87rem'}}>
                        <thead>
                            <tr style={{background:'#f0f6f7'}}>
                                {block.head.map((h,i) => (
                                    <th key={i} style={{padding:'8px 12px',textAlign:'left',fontWeight:650,borderBottom:'2px solid #d0dde3',color:'#213f50',whiteSpace:'nowrap'}}>
                                        {inlineNodes(h)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {block.rows.map((row, ri) => (
                                <tr key={ri} style={{background: ri%2===0?'#fff':'#f9fafb'}}>
                                    {row.map((cell,ci) => (
                                        <td key={ci} style={{padding:'7px 12px',borderBottom:'1px solid #e8eef2',verticalAlign:'top',lineHeight:1.5}}>
                                            {inlineNodes(cell)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        case 'ul':
            return (
                <ul key={idx} style={{margin:'6px 0',paddingLeft:20,lineHeight:1.7}}>
                    {block.items.map((item, ii) => (
                        <li key={ii} style={{marginBottom:2,fontSize:'.9rem',color:'#213f50'}}>
                            {inlineNodes(item[0])}
                            {item.length > 1 && <ul style={{paddingLeft:16}}>{item.slice(1).map((s,si)=><li key={si}>{inlineNodes(s)}</li>)}</ul>}
                        </li>
                    ))}
                </ul>
            );
        case 'ol':
            return (
                <ol key={idx} style={{margin:'6px 0',paddingLeft:20,lineHeight:1.7}}>
                    {block.items.map((item, ii) => (
                        <li key={ii} style={{marginBottom:2,fontSize:'.9rem',color:'#213f50'}}>
                            {inlineNodes(item[0])}
                            {item.length > 1 && <ul style={{paddingLeft:16}}>{item.slice(1).map((s,si)=><li key={si}>{inlineNodes(s)}</li>)}</ul>}
                        </li>
                    ))}
                </ol>
            );
        case 'p':
            return (
                <p key={idx} style={{margin:'6px 0',lineHeight:1.7,fontSize:'.9rem',color:'#213f50'}}>
                    {block.lines.map((l,i) => [i>0 && <br key={`br${i}`}/>, inlineNodes(l, `l${i}`)])}
                </p>
            );
    }
}

export function Markdown({text}: {text: string}) {
    const blocks = tokenise(text);
    return (
        <div style={{padding:'2px 0'}}>
            {blocks.map((b, i) => renderBlock(b, i))}
        </div>
    );
}

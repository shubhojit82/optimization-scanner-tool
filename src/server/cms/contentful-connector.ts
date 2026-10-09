import type {CMSConnector,PageSnapshot} from '../../core/contracts';
import {CollectionError} from '../../core/contracts';

type RichTextNode={nodeType:string;value?:string;content?:RichTextNode[];data?:Record<string,unknown>};

function richTextToHtml(node:RichTextNode):string{
    const t=node.nodeType;
    const c=(node.content||[]).map(richTextToHtml).join('');
    if(t==='document')return c;
    if(t==='paragraph')return `<p>${c}</p>`;
    if(t==='heading-1')return `<h1>${c}</h1>`;
    if(t==='heading-2')return `<h2>${c}</h2>`;
    if(t==='heading-3')return `<h3>${c}</h3>`;
    if(t==='heading-4')return `<h4>${c}</h4>`;
    if(t==='unordered-list')return `<ul>${c}</ul>`;
    if(t==='ordered-list')return `<ol>${c}</ol>`;
    if(t==='list-item')return `<li>${c}</li>`;
    if(t==='blockquote')return `<blockquote>${c}</blockquote>`;
    if(t==='hr')return `<hr>`;
    if(t==='text'){let s=node.value||'';if(Array.isArray((node as {marks?:{type:string}[]}).marks))for(const m of (node as {marks?:{type:string}[]}).marks||[]){if(m.type==='bold')s=`<strong>${s}</strong>`;else if(m.type==='italic')s=`<em>${s}</em>`;else if(m.type==='underline')s=`<u>${s}</u>`;}return s;}
    if(t==='embedded-asset-block'){const title=String((node.data?.target as {fields?:{title?:unknown}})?.fields?.title||'');const url=String((node.data?.target as {fields?:{file?:{url?:unknown}}})?.fields?.file?.url||'');return url?`<figure><img src="${url}" alt="${title}"/></figure>`:''}
    return c;
}

export class ContentfulConnector implements CMSConnector {
    readonly id='contentful';
    constructor(private spaceId:string,private token:string,private request:typeof fetch=fetch){}
    async readPage(entryId:string):Promise<PageSnapshot&{version:string}>{
        let res:Response;
        try{res=await this.request(`https://cdn.contentful.com/spaces/${encodeURIComponent(this.spaceId)}/entries/${encodeURIComponent(entryId)}?access_token=${encodeURIComponent(this.token)}`,{signal:AbortSignal.timeout(20000)});}
        catch{throw new CollectionError('Contentful connection failed or timed out.');}
        if(!res.ok){const msg=res.status===401?'Invalid Contentful access token.':res.status===404?'Contentful entry not found.':'Contentful request failed.';throw new CollectionError(msg,res.status===404?404:502);}
        let data:unknown;try{data=await res.json();}catch{throw new CollectionError('Contentful returned invalid JSON.');}
        const d=data as {sys?:{id?:string;version?:number};fields?:Record<string,unknown>};
        const fields=d?.fields||{};
        let html='';
        for(const v of Object.values(fields)){if(typeof v==='object'&&v!==null&&(v as {nodeType?:string}).nodeType==='document'){html+=richTextToHtml(v as RichTextNode);}}
        if(!html){const textFields=Object.values(fields).filter(v=>typeof v==='string');html=textFields.map(t=>`<p>${t}</p>`).join('');}
        const version=String(d?.sys?.version||'1');
        const url=`https://app.contentful.com/spaces/${this.spaceId}/entries/${entryId}`;
        return {url,html:`<!DOCTYPE html><html><body>${html}</body></html>`,fetchedAt:new Date().toISOString(),status:200,headers:{},version};
    }
    async stageDraft(_pageId:string,_html:string,_expectedVersion:string):Promise<{draftId:string}>{
        // Contentful Management API staging is not implemented in this iteration
        throw new CollectionError('Contentful draft staging is not yet implemented.',501);
    }
}

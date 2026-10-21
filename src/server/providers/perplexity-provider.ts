import type {AIProvider, Observation} from '../../core/contracts';
import {CollectionError} from '../../core/contracts';

function safeUrl(v:string){try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password}catch{return false}}

export class PerplexityProvider implements AIProvider {
    readonly id='perplexity';
    constructor(private key:string, readonly model='sonar', private request:typeof fetch=fetch){}
    async observe(prompt:string, market:string):Promise<Omit<Observation,'id'|'clientId'|'created'|'source'>> {
        let result:Response;
        try {
            result=await this.request('https://api.perplexity.ai/chat/completions',{
                method:'POST',signal:AbortSignal.timeout(60000),
                headers:{'Authorization':`Bearer ${this.key}`,'Content-Type':'application/json'},
                body:JSON.stringify({model:this.model,stream:false,messages:[
                    {role:'system',content:`Answer for the following market: ${market}. Cite your sources.`},
                    {role:'user',content:prompt}
                ]})
            });
        } catch {
            throw new CollectionError('Perplexity connection failed or exceeded 60 seconds. No observation was saved.');
        }
        if(!result.ok){
            const msg=result.status===401?'Perplexity rejected the API key. Check PERPLEXITY_API_KEY on the server.'
                :result.status===429?'Perplexity rate or quota limit reached. Check account usage before retrying.'
                :'Perplexity could not complete the request. No observation was saved.';
            throw new CollectionError(msg,result.status===429?429:502);
        }
        let raw:unknown;
        try{raw=await result.json()}catch{throw new CollectionError('Perplexity returned invalid JSON. No observation was saved.')}
        const data=raw as {choices?:{message?:{content?:string;citations?:string[]}}[];model?:string;id?:string;citations?:string[];usage?:{prompt_tokens?:number;completion_tokens?:number;total_tokens?:number}};
        // Perplexity sonar: ~$1/M input, $1/M output tokens (approximate)
        const pCost=(i:number,o:number)=>(i+o)/1_000_000;
        const content=data?.choices?.[0]?.message?.content?.trim()||'';
        if(!content||content.length>12000) throw new CollectionError('Perplexity returned an empty or oversized answer. No observation was saved.');
        // Perplexity returns citations at both response root and message level
        const rawCitations:unknown[]=Array.isArray(data.citations)?data.citations
            :Array.isArray(data?.choices?.[0]?.message?.citations)?data.choices![0].message!.citations!:[];
        const citations=[...new Set(rawCitations.filter((u):u is string=>typeof u==='string'&&safeUrl(u)))];
        const inTok=data.usage?.prompt_tokens??0;
        const outTok=data.usage?.completion_tokens??0;
        const tokenCount=(data.usage?.total_tokens||(inTok+outTok))||undefined;
        const estimatedCostUsd=tokenCount?pCost(inTok,outTok):undefined;
        return {engine:this.id,surface:'Chat Completions API · web search',model:data.model||this.model,
            prompt,response:content,citations,providerResponseId:data.id,observedAt:new Date().toISOString(),
            tokenCount,estimatedCostUsd};
    }
}

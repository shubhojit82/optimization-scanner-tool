import type {Crawler,PageSnapshot} from '../core/contracts';

export class BrowserCrawler implements Crawler {
    async capture(url:string):Promise<PageSnapshot> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let pw:any;
        try{pw=await (Function('return import("playwright")')() as Promise<any>);}catch{throw new Error('playwright package not installed. Run: npx playwright install chromium');}
        const browser=await pw.chromium.launch({headless:true});
        try{
            const ctx=await browser.newContext({userAgent:'Mozilla/5.0 (compatible; GEOBot/1.0)',javaScriptEnabled:true});
            const page=await ctx.newPage();
            let status=200;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            page.on('response',(r:any)=>{if(r.url()===url)status=r.status();});
            await page.goto(url,{waitUntil:'networkidle',timeout:25000});
            const html=await page.content();
            const headers:Record<string,string>={};
            return {url,html,fetchedAt:new Date().toISOString(),status,headers};
        }finally{await browser.close();}
    }
}

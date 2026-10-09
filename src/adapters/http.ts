import { z } from 'zod';
import { D1Repository } from './d1-repository';
import { Workbench } from '../application/workbench';
export const repo = new D1Repository();
export const workbench = new Workbench(repo);
export {urlSchema,clientSchema,auditSchema,observationSchema} from './validation';
export function identity(r: Request) { const id = r.headers.get('oai-authenticated-user-id'); if (!id)
    throw new Error('Sign in required'); if (r.method !== 'GET') {
    const origin = r.headers.get('origin');
    if (!origin || origin !== new URL(r.url).origin)
        throw new Error('Origin denied');
} return id; }
export async function body(r: Request) { const reader = r.body?.getReader(); if (!reader)
    throw new Error('Request body required'); let size = 0; const chunks: Uint8Array[] = []; while (true) {
    const v = await reader.read();
    if (v.done)
        break;
    size += v.value.length;
    if (size > 600000) {
        await reader.cancel();
        throw new Error('Request too large');
    }
    chunks.push(v.value);
} const joined = new Uint8Array(size); let at = 0; for (const c of chunks) {
    joined.set(c, at);
    at += c.length;
} return JSON.parse(new TextDecoder().decode(joined)); }
export async function endpoint(fn: () => Promise<unknown>) { try {
    return Response.json(await fn(), { headers: { 'Cache-Control': 'no-store' } });
}
catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message : e instanceof SyntaxError ? 'Invalid JSON' : e instanceof Error ? e.message : 'Request failed';
    const status = message === 'Sign in required' ? 401 : message === 'Origin denied' ? 403 : message === 'Client not found' ? 404 : e instanceof z.ZodError || e instanceof SyntaxError || ['Page URL must belong to the client domain', 'Request too large', 'Request body required'].includes(message) ? 400 : 503;
    if (status === 503)
        console.error('Workbench request failed', e);
    return Response.json({ error: status === 503 ? 'Storage is temporarily unavailable. Please retry.' : message }, { status });
} }

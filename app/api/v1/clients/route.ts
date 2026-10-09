import {body,clientSchema,endpoint,identity,repo} from '../../../../src/adapters/http';
export const dynamic='force-dynamic';
export function GET(r:Request){return endpoint(()=>repo.listClients(identity(r)))}
export function POST(r:Request){return endpoint(async()=>{const owner=identity(r);const data=clientSchema.parse(await body(r));const client={...data,domain:new URL(data.domain).origin,id:crypto.randomUUID(),created:new Date().toISOString()};await repo.saveClient(owner,client);return client})}

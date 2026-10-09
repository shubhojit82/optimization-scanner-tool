import {auditSchema,body,endpoint,identity,workbench} from '../../../../../../src/adapters/http';
export function POST(r:Request,c:{params:Promise<{id:string}>}){return endpoint(async()=>{const owner=identity(r);const data=auditSchema.parse(await body(r));return workbench.audit(owner,(await c.params).id,data.url,data.html)})}

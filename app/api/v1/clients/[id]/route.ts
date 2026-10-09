import {endpoint,identity,workbench} from '../../../../../src/adapters/http';
export const dynamic='force-dynamic';
export function GET(r:Request,c:{params:Promise<{id:string}>}){return endpoint(async()=>workbench.detail(identity(r),(await c.params).id))}

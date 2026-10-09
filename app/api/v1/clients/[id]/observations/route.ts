import {observationSchema,body,endpoint,identity,workbench} from '../../../../../../src/adapters/http';
export function POST(r:Request,c:{params:Promise<{id:string}>}){return endpoint(async()=>{const owner=identity(r);return workbench.observations(owner,(await c.params).id,observationSchema.parse(await body(r)))})}

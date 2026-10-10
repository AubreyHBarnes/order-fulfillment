import { Functions, Query, Client } from 'node-appwrite';
import { env } from './env.js';
const fns = new Functions(new Client().setEndpoint(env.APPWRITE_ENDPOINT).setProject(env.APPWRITE_PROJECT_ID).setKey(env.APPWRITE_API_KEY));
const f = await fns.get({ functionId: 'auto-assignment' });
console.log('active deployment:', f.deploymentId, 'logging:', f.logging);
const ex = await fns.listExecutions({ functionId: 'auto-assignment', queries: [Query.orderDesc('$createdAt'), Query.limit(40)] });
for (const e of ex.executions.reverse()) console.log(e.$createdAt, e.deploymentId, e.trigger, e.status, e.responseStatusCode, (e.logs||'').slice(0,100).replace(/\n/g,' / '), (e.errors||'').slice(0,200));

// Shared setup for the race-condition scripts: reads the repo .env and
// returns a TablesDB client authenticated with the dev API key.
import { readFileSync } from 'node:fs';
import { Client, TablesDB, Query, ID } from 'node-appwrite';

export { Query, ID };

export const env = Object.fromEntries(
  readFileSync(new URL('../../../../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

export const db = new TablesDB(
  new Client().setEndpoint(env.APPWRITE_ENDPOINT).setProject(env.APPWRITE_PROJECT_ID).setKey(env.APPWRITE_API_KEY)
);
export const DB = env.APPWRITE_DATABASE_ID;
export const ORDERS = env.APPWRITE_ORDERS_COLLECTION_ID;
export const SHOPPERS = env.APPWRITE_SHOPPER_STATUS_COLLECTION_ID;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

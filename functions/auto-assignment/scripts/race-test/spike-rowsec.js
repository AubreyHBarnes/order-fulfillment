// Issue #5 spike: row-level read permissions + Teams. Throwaway table/team/user; everything is deleted at the end.
// Questions: (1) does a client-created row give the creator update rights by default? (2) does read(team:X) work for
// members and not for non-members/guests? (3) does Realtime honour row permissions?
// Needs the dev key to have teams.write + memberships.write + users.write (the error says which if missing).
import { Client as ServerClient, Users, Teams, Permission, Role } from 'node-appwrite';
import { Client as WebClient, Realtime } from 'appwrite';
import { db, DB, ID, Query, env, sleep } from './env.js';

const T = 'spike_rowsec';
const TEAM = 'spike_team';
const server = new ServerClient().setEndpoint(env.APPWRITE_ENDPOINT).setProject(env.APPWRITE_PROJECT_ID).setKey(env.APPWRITE_API_KEY);
const users = new Users(server);
const teams = new Teams(server);
const err = (e) => `${e.code ?? ''} ${e.type ?? e.message ?? ''}`.trim();
const tryIt = async (label, fn) => { try { return await fn(); } catch (e) { console.log(`  ${label}: ERROR ${err(e)}`); return null; } };

const findUser = async (email) => (await users.list([Query.equal('email', email)])).users[0];
const customer = await findUser('rush.tester@example.com');
const shopper = await findUser('shopper.tester@example.com');
if (!customer || !shopper) throw new Error('test accounts not found');
globalThis.window ??= globalThis; // the browser SDK's Realtime heartbeat expects window
for (const u of (await users.list([], 'spike.outsider')).users) await users.delete(u.$id).catch(() => {}); // leftovers from a crashed run
const outsider = await users.create(ID.unique(), `spike.outsider.${Date.now()}@example.com`, undefined, 'SpikePass123!', 'Spike Outsider');

const sessionFor = async (u) => (await users.createSession(u.$id)).secret;
const asUser = async (u) => {
  const secret = await sessionFor(u);
  const c = new ServerClient().setEndpoint(env.APPWRITE_ENDPOINT).setProject(env.APPWRITE_PROJECT_ID).setSession(secret);
  const w = new WebClient().setEndpoint(env.APPWRITE_ENDPOINT).setProject(env.APPWRITE_PROJECT_ID).setSession(secret);
  return { tables: new (db.constructor)(c), web: w };
};
const guestTables = new (db.constructor)(new ServerClient().setEndpoint(env.APPWRITE_ENDPOINT).setProject(env.APPWRITE_PROJECT_ID));

let teamMade = false;
try {
  await db.deleteTable(DB, T).catch(() => {});
  await teams.delete(TEAM).catch(() => {});
  await sleep(1500);
  await db.createTable(DB, T, T, [Permission.create(Role.users())], true); // rowSecurity ON, no table-level read
  await db.createStringColumn(DB, T, 'note', 64, false, '');
  for (let i = 0; i < 30; i++) { const c = (await db.listColumns(DB, T)).columns; if (c.length === 1 && c[0].status === 'available') break; await sleep(1000); }
  await teams.create(TEAM, TEAM); teamMade = true;
  await teams.createMembership(TEAM, ['member'], undefined, shopper.$id);

  const cust = await asUser(customer), shop = await asUser(shopper), out = await asUser(outsider);

  console.log('\n(1) Client create with NO permissions given - what does the creator get?');
  const r1 = await tryIt('customer create', () => cust.tables.createRow(DB, T, ID.unique(), { note: 'client-made' }));
  if (r1) {
    console.log('  $permissions:', JSON.stringify(r1.$permissions));
    const upd = await tryIt('customer update own row', () => cust.tables.updateRow(DB, T, r1.$id, { note: 'edited-by-client' }));
    console.log('  creator can update own row:', !!upd);
  }

  console.log('\n(2) Server-made row: read(user:customer) + read(team)');
  const r2 = await db.createRow(DB, T, ID.unique(), { note: 'server-made' }, [Permission.read(Role.user(customer.$id)), Permission.read(Role.team(TEAM))]);
  const probe = async (who, t) => {
    const got = await tryIt(`${who} get`, () => t.getRow(DB, T, r2.$id));
    const list = await tryIt(`${who} list`, () => t.listRows(DB, T));
    console.log(`  ${who.padEnd(22)} get:${got ? 'OK' : 'denied'}  list sees ${list ? list.rows.filter((r) => r.$id === r2.$id).length : '?'} of the server row (${list ? list.total : '?'} rows total)`);
  };
  await probe('customer (owner)', cust.tables);
  await probe('shopper (team member)', shop.tables);
  await probe('outsider (other user)', out.tables);
  await probe('guest (no session)', guestTables);
  const upd2 = await tryIt('customer update server row', () => cust.tables.updateRow(DB, T, r2.$id, { note: 'x' }));
  console.log('  customer can update server-made row:', !!upd2, '(expect false)');

  console.log('\n(3) Realtime: who receives an update to the server-made row?');
  const got = { customer: 0, shopper: 0, outsider: 0 };
  const subs = [];
  for (const [name, who] of [['customer', cust], ['shopper', shop], ['outsider', out]]) {
    try {
      const sub = await new Realtime(who.web).subscribe(`databases.${DB}.tables.${T}.rows`, () => { got[name]++; });
      subs.push(sub);
    } catch (e) { console.log(`  ${name} subscribe ERROR ${err(e)}`); }
  }
  await sleep(2500);
  await db.updateRow(DB, T, r2.$id, { note: 'realtime-poke' });
  await sleep(4000);
  console.log('  events received:', JSON.stringify(got), '(expect customer>0, shopper>0, outsider 0)');
  for (const s of subs) await s.close?.().catch(() => {});
} finally {
  await db.deleteTable(DB, T).catch(() => {});
  if (teamMade) await teams.delete(TEAM).catch(() => {});
  await users.delete(outsider.$id).catch(() => {});
  console.log('\ncleaned up');
  process.exit(0);
}

#!/usr/bin/env node
/**
 * Deploy script for the auto-assignment Function
 * File: functions/auto-assignment/scripts/deploy.js
 *
 * WHY A HAND-ROLLED SCRIPT INSTEAD OF THE APPWRITE CLI?
 * The Appwrite CLI isn't installed in this environment (see
 * docs/DECISIONS.md's auto-assignment primer entry), and installing it
 * would need an interactive browser-based login this environment can't
 * do unattended. This script does the same job - package the function's
 * code, create/update the Function resource, upload+activate a
 * deployment - using the project's existing dev API key (now widened with
 * Functions scope), which the harness *can* run directly.
 *
 * It calls Appwrite's REST API with plain `fetch`, not the `node-appwrite`
 * SDK: the SDK's HTTP layer fails on Node 26 ("invalid onError method"),
 * and the handful of calls used here are simple.
 *
 * USAGE: node functions/auto-assignment/scripts/deploy.js
 * (reads the repo root .env for endpoint/project/key - same file every
 * other server-side script in this project already uses)
 */
import { execSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FUNCTION_DIR = join(__dirname, '..'); // functions/auto-assignment
const REPO_ROOT = join(__dirname, '..', '..', '..');

// ---- Load repo-root .env (same simple KEY=value format used elsewhere) ----
function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv(join(REPO_ROOT, '.env'));
const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY,
  APPWRITE_DATABASE_ID,
  APPWRITE_ORDERS_COLLECTION_ID,
  APPWRITE_SHOPPER_STATUS_COLLECTION_ID,
  APPWRITE_CUSTOMER_ARRIVALS_COLLECTION_ID,
  APPWRITE_PICKUP_ZONES_COLLECTION_ID,
  APPWRITE_CUSTOMER_TRIPS_COLLECTION_ID,
} = env;

const FUNCTION_ID = 'auto-assignment';
const FUNCTION_NAME = 'Auto Assignment';

const EVENTS = [
  `databases.${APPWRITE_DATABASE_ID}.collections.${APPWRITE_ORDERS_COLLECTION_ID}.documents.*.create`,
  `databases.${APPWRITE_DATABASE_ID}.collections.${APPWRITE_ORDERS_COLLECTION_ID}.documents.*.update`,
  `databases.${APPWRITE_DATABASE_ID}.collections.${APPWRITE_SHOPPER_STATUS_COLLECTION_ID}.documents.*.update`,
];

// Every minute - the finest granularity standard cron supports - drives
// the arrival hand-off timeout sweep (handleScheduledSweep in
// src/main.js). The actual timeout is 60s (ARRIVAL_TIMEOUT_MS), so a
// stale arrival is caught within one sweep interval of crossing it, not
// exactly at the 60s mark - see docs/DECISIONS.md's arrival hand-off
// entry for why cron's 1-minute floor means this is "60-119s" in the
// worst case, not a precise 60s.
const SCHEDULE = '* * * * *';

async function api(method, path, body) {
  const headers = { 'x-appwrite-project': APPWRITE_PROJECT_ID, 'x-appwrite-key': APPWRITE_API_KEY };
  const isForm = body instanceof FormData; // fetch sets the multipart boundary itself
  if (body && !isForm) headers['content-type'] = 'application/json';
  const res = await fetch(`${APPWRITE_ENDPOINT}${path}`, {
    method,
    headers,
    body: body && (isForm ? body : JSON.stringify(body)),
  });
  const json = await res.json();
  if (!res.ok) {
    // code/type mirror the SDK's AppwriteException, which the callers below branch on
    throw Object.assign(new Error(`${method} ${path}: ${res.status} ${json.message}`), { code: res.status, type: json.type });
  }
  return json;
}
const fn = `/functions/${FUNCTION_ID}`;

async function ensureFunction() {
  const config = {
    functionId: FUNCTION_ID,
    name: FUNCTION_NAME,
    runtime: 'node-22',
    events: EVENTS,
    schedule: SCHEDULE,
    timeout: 15,
    enabled: true,
    logging: true,
    entrypoint: 'src/main.js',
    commands: 'npm install',
    scopes: ['databases.read', 'databases.write', 'documents.read', 'documents.write', 'teams.write'],
    // Open to any caller - this Appwrite plan has no way to scope
    // execute to "logged-in users" (confirmed live: Role.users() is
    // rejected, only any/guests are allowed - see docs/DECISIONS.md's
    // "Permission tightening" entry). Every HTTP action authenticates
    // its own caller via a JWT it verifies internally
    // (resolveCaller() in main.js) - that check, not this permission,
    // is the real authorization boundary.
    execute: ['any'],
  };

  // The project's plan stopped allowing cron schedules (found 2026-10-22:
  // the live schedule had been cleared to '' on 2026-10-19). Rather than
  // block every deploy on that, fall back to no schedule - which is what
  // production already has - and say so loudly, since the stuck-arrival
  // and stale-trip sweeps don't run without it.
  const withScheduleFallback = async (call) => {
    try {
      return await call(config);
    } catch (err) {
      if (err.type !== 'billing_feature_unsupported') throw err;
      console.warn(
        `WARNING: plan rejected cron schedule "${SCHEDULE}" - deploying with NO schedule.\n` +
          '  The scheduled sweeps (stuck arrival hand-offs, stale trips) will not run.'
      );
      return call({ ...config, schedule: '' });
    }
  };

  try {
    const existing = await api('GET', fn);
    console.log(`Function ${FUNCTION_ID} already exists - updating config (events/runtime).`);
    console.log(`  previous active deployment (rollback target): ${existing.deploymentId || '(none)'}`);
    await withScheduleFallback((c) => api('PUT', fn, c));
    return existing;
  } catch (err) {
    if (err.code !== 404) throw err;
    console.log(`Creating function ${FUNCTION_ID}...`);
    return withScheduleFallback((c) => api('POST', '/functions', c));
  }
}

async function ensureVariables() {
  const required = {
    APPWRITE_DATABASE_ID,
    APPWRITE_ORDERS_COLLECTION_ID,
    APPWRITE_SHOPPER_STATUS_COLLECTION_ID,
    APPWRITE_CUSTOMER_ARRIVALS_COLLECTION_ID,
    // proximity check-in tables; skipped until they exist (see trips.js)
    ...(APPWRITE_PICKUP_ZONES_COLLECTION_ID && { APPWRITE_PICKUP_ZONES_COLLECTION_ID }),
    ...(APPWRITE_CUSTOMER_TRIPS_COLLECTION_ID && { APPWRITE_CUSTOMER_TRIPS_COLLECTION_ID }),
  };
  const existing = await api('GET', `${fn}/variables`);
  for (const [key, value] of Object.entries(required)) {
    const found = existing.variables.find((v) => v.key === key);
    if (found) {
      if (found.value !== value) {
        await api('PUT', `${fn}/variables/${found.$id}`, { key, value });
        console.log(`Updated variable ${key}`);
      }
    } else {
      await api('POST', `${fn}/variables`, { key, value });
      console.log(`Created variable ${key}`);
    }
  }
}

function packageSource() {
  const tmpDir = mkdtempSync(join(tmpdir(), 'auto-assignment-'));
  const tarPath = join(tmpDir, 'code.tar.gz');
  // Only src/ and package.json go in the tarball - node_modules is
  // deliberately left out; the function's own "npm install" build
  // command (set above) installs node-appwrite during Appwrite's build
  // step instead, keeping the uploaded payload tiny.
  execSync(`tar -czf "${tarPath}" -C "${FUNCTION_DIR}" package.json src`, { stdio: 'inherit' });
  return tarPath;
}

async function deploy() {
  if (!APPWRITE_API_KEY) {
    throw new Error('APPWRITE_API_KEY missing from .env - cannot deploy.');
  }

  await ensureFunction();
  await ensureVariables();

  const tarPath = packageSource();
  console.log(`Uploading deployment from ${tarPath}...`);
  const form = new FormData();
  form.append('code', new Blob([readFileSync(tarPath)]), 'code.tar.gz'); // small: one request, no chunking
  form.append('activate', 'true');
  form.append('entrypoint', 'src/main.js');
  form.append('commands', 'npm install');
  const deployment = await api('POST', `${fn}/deployments`, form);
  console.log(`Deployment ${deployment.$id} created, status: ${deployment.status}`);

  // Poll until the build finishes (ready/failed) - createDeployment
  // returns immediately once the upload is accepted, before the build
  // (npm install + packaging) has actually run.
  let current = deployment;
  const start = Date.now();
  while (!['ready', 'failed'].includes(current.status) && Date.now() - start < 120000) {
    await new Promise((r) => setTimeout(r, 3000));
    current = await api('GET', `${fn}/deployments/${deployment.$id}`);
    console.log(`  ...status: ${current.status}`);
  }

  if (current.status === 'failed') {
    console.error('Build FAILED. Build logs:');
    console.error(current.buildLogs ?? '(no build logs available on this response)');
    process.exitCode = 1;
    return;
  }
  if (current.status !== 'ready') {
    console.error(`Build did not finish within timeout, last status: ${current.status}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Deployment ${current.$id} is READY and active.`);
  // Read back rather than echo SCHEDULE - the plan fallback above may have dropped it.
  const live = await api('GET', fn);
  console.log(`Function ${FUNCTION_ID} is now listening for:\n  - ${live.events.join('\n  - ')}\n  - schedule: ${live.schedule || '(none)'}`);
}

deploy().catch((err) => {
  console.error('Deploy failed:', err);
  process.exitCode = 1;
});

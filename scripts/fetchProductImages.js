/**
 * Product Image Script (Unsplash)
 *
 * Two phases, because Unsplash's demo tier allows only ~50 requests/hour:
 *
 *   search  - one Unsplash search per product, candidates cached in
 *             scripts/data/productImageCandidates.json. Resumable: re-run
 *             after the hourly limit resets and it continues where it stopped.
 *   apply   - writes the chosen candidate (default: first; override by editing
 *             "chosen" in the cache file) to each product, and calls Unsplash's
 *             download-tracking endpoint as their API guidelines require.
 *
 * Usage (needs Node 22, see docs/DECISIONS.md - Node 26 breaks node-appwrite):
 *   set -a; . ./.env; set +a
 *   ~/.nvm/versions/node/v22.18.0/bin/node scripts/fetchProductImages.js search
 *   ~/.nvm/versions/node/v22.18.0/bin/node scripts/fetchProductImages.js apply
 *
 * Requires UNSPLASH_ACCESS_KEY plus the APPWRITE_* vars in the environment.
 */

const fs = require('fs');
const path = require('path');
const sdk = require('node-appwrite');

const CACHE_PATH = path.join(__dirname, 'data', 'productImageCandidates.json');
const UTM = 'utm_source=GroceryFulfillmentApp&utm_medium=referral';
const CANDIDATES_PER_PRODUCT = 5;

const client = new sdk.Client();
client
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new sdk.Databases(client);
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const PRODUCTS_COLLECTION_ID = 'products';
const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

function loadCache() {
    try {
        return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    } catch {
        return {};
    }
}

function saveCache(cache) {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n');
}

async function listAllProducts() {
    const products = [];
    while (true) {
        const page = await databases.listDocuments(DATABASE_ID, PRODUCTS_COLLECTION_ID, [
            sdk.Query.limit(100),
            sdk.Query.offset(products.length),
        ]);
        products.push(...page.documents);
        if (page.documents.length < 100) break;
    }
    return products;
}

async function unsplash(pathAndQuery) {
    const res = await fetch(`https://api.unsplash.com${pathAndQuery}`, {
        headers: { Authorization: `Client-ID ${ACCESS_KEY}`, 'Accept-Version': 'v1' },
    });
    const remaining = Number(res.headers.get('x-ratelimit-remaining'));
    if (!res.ok) {
        const err = new Error(`Unsplash ${res.status}: ${(await res.text()).slice(0, 200)}`);
        err.status = res.status;
        throw err;
    }
    return { body: await res.json(), remaining };
}

function searchPhotos(query) {
    return unsplash(
        `/search/photos?query=${encodeURIComponent(query)}` +
            `&per_page=${CANDIDATES_PER_PRODUCT}&orientation=squarish&content_filter=high`
    );
}

async function search() {
    const cache = loadCache();
    const products = await listAllProducts();
    const todo = products.filter((p) => !cache[p.$id]);
    console.log(`${products.length} products, ${todo.length} still need a search`);

    for (const product of todo) {
        let result;
        try {
            result = await searchPhotos(product.name);
            if (result.body.results.length === 0 && product.subcategory) {
                // Specific names (e.g. "Ground Turkey") sometimes return nothing
                result = await searchPhotos(`${product.subcategory} ${product.name}`);
            }
        } catch (error) {
            if (error.status === 403 || error.status === 429) {
                console.log('Rate limit reached - re-run in an hour to continue.');
                break;
            }
            throw error;
        }

        if (result.body.results.length === 0) {
            console.log(`? ${product.name}: no results, left for a manual pick`);
            continue;
        }

        cache[product.$id] = {
            name: product.name,
            chosen: 0,
            candidates: result.body.results.map((photo) => ({
                id: photo.id,
                url: photo.urls.raw,
                alt: photo.alt_description || photo.description || '',
                photographer: photo.user.name,
                photographerUrl: `${photo.user.links.html}?${UTM}`,
                downloadLocation: photo.links.download_location,
            })),
        };
        saveCache(cache);
        console.log(`✓ ${product.name}: ${cache[product.$id].candidates.length} candidates (${result.remaining} requests left)`);

        if (result.remaining <= 1) {
            console.log('Rate limit reached - re-run in an hour to continue.');
            break;
        }
    }
}

async function apply() {
    const cache = loadCache();
    const products = await listAllProducts();
    let applied = 0;

    for (const product of products) {
        const entry = cache[product.$id];
        const photo = entry && entry.candidates[entry.chosen];
        if (!photo) {
            console.log(`- No candidate: ${product.name}`);
            continue;
        }
        if (product.imageUnsplashId === photo.id) continue;

        try {
            // Unsplash requires a download-tracking ping when a photo is used
            await unsplash(new URL(photo.downloadLocation).pathname + new URL(photo.downloadLocation).search);
            await databases.updateDocument(DATABASE_ID, PRODUCTS_COLLECTION_ID, product.$id, {
                imageURL: photo.url,
                imagePhotographer: photo.photographer,
                imagePhotographerUrl: photo.photographerUrl,
                imageUnsplashId: photo.id,
            });
            console.log(`✓ ${product.name} -> ${photo.id} by ${photo.photographer}`);
            applied++;
        } catch (error) {
            console.error(`✗ ${product.name}: ${error.message}`);
            if (error.status === 403 || error.status === 429) {
                console.log('Rate limit reached - re-run in an hour to continue.');
                break;
            }
        }
    }
    console.log(`Applied ${applied} images`);
}

const command = process.argv[2];
if (!ACCESS_KEY) {
    console.error('UNSPLASH_ACCESS_KEY is not set');
    process.exit(1);
}
const commands = { search, apply };
if (!commands[command]) {
    console.error('Usage: fetchProductImages.js <search|apply>');
    process.exit(1);
}
commands[command]().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});

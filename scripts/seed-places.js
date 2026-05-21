#!/usr/bin/env node
/**
 * Exhaustive OSM hotel seeder — catches every accommodation on earth.
 * Runs region by region, 3 query strategies per region to miss nothing.
 * Usage: SUPABASE_SERVICE_KEY=xxx node scripts/seed-places.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://rnkwadbefcdgzgxhxmfj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('Set SUPABASE_SERVICE_KEY env var (use service_role key)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Fine-grained regions to stay within Overpass timeouts
const REGIONS = [
  { name: 'West Europe',    bbox: [35, -25, 72,  20] },
  { name: 'East Europe',    bbox: [35,  20, 72,  45] },
  { name: 'North America',  bbox: [25, -170, 75, -50] },
  { name: 'Central America',bbox: [5,  -95, 25, -50] },
  { name: 'South America',  bbox: [-60, -85, 15, -30] },
  { name: 'North Africa',   bbox: [15, -20, 40,  55] },
  { name: 'Sub Saharan',    bbox: [-40, -20, 15,  55] },
  { name: 'Middle East',    bbox: [10,  30, 45,  65] },
  { name: 'Central Asia',   bbox: [30,  45, 60,  85] },
  { name: 'South Asia',     bbox: [5,   60, 40,  90] },
  { name: 'East Asia',      bbox: [20,  95, 55, 145] },
  { name: 'SE Asia',        bbox: [-15, 90, 30, 145] },
  { name: 'Oceania',        bbox: [-50, 110, 0, 180] },
  { name: 'Russia Far East',bbox: [40, 100, 75, 180] },
  { name: 'Caribbean',      bbox: [8,  -90, 30,  -58] },
];

// All OSM tags that indicate accommodation
const TOURISM_TAGS = [
  'hotel','hostel','motel','guest_house','resort',
  'apartment','chalet','camp_site','caravan_site',
  'bed_and_breakfast','inn',
];

function buildQuery(bbox, strategy) {
  const [s, w, n, e] = bbox;
  const bb = `${s},${w},${n},${e}`;

  if (strategy === 'tourism') {
    const tags = TOURISM_TAGS.map(t => `"tourism"="${t}"`).join('|');
    return `[out:json][timeout:180][bbox:${bb}];(node["tourism"~"${TOURISM_TAGS.join('|')}"];way["tourism"~"${TOURISM_TAGS.join('|')}"];relation["tourism"~"${TOURISM_TAGS.join('|')}"];);out center tags;`;
  }
  if (strategy === 'amenity') {
    return `[out:json][timeout:120][bbox:${bb}];(node["amenity"="hotel"];way["amenity"="hotel"];node["amenity"="hostel"];way["amenity"="hostel"];);out center tags;`;
  }
  if (strategy === 'building') {
    return `[out:json][timeout:120][bbox:${bb}];(node["building"="hotel"];way["building"="hotel"];node["building"="hostel"];way["building"="hostel"];);out center tags;`;
  }
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

async function fetchQuery(query, endpointIdx = 0) {
  await sleep(1500);
  const endpoint = OVERPASS_ENDPOINTS[endpointIdx % OVERPASS_ENDPOINTS.length];
  const params = new URLSearchParams({ data: query });

  const res = await fetch(endpoint, {
    method: 'POST',
    body: params.toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'SavvySignal/1.0 (hotel-seeder)',
    },
    signal: AbortSignal.timeout(210000),
  });

  if (!res.ok) {
    // Try next endpoint
    if (endpointIdx < OVERPASS_ENDPOINTS.length - 1) {
      await sleep(3000);
      return fetchQuery(query, endpointIdx + 1);
    }
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = await res.json();
  return json.elements || [];
}

function parseElement(el) {
  const tags = el.tags || {};

  // Get name — try multiple tag options
  const name = tags.name || tags['name:en'] || tags['name:latin'] ||
               tags['official_name'] || tags['brand'] ||
               (tags['addr:housenumber'] && tags['addr:street']
                 ? `${tags['addr:street']} ${tags['addr:housenumber']}`
                 : null);

  if (!name || name.trim().length < 2) return null;

  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!lat || !lon) return null;

  return {
    osm_id: el.id,
    name: name.trim().substring(0, 200),
    latitude: parseFloat(lat.toFixed(6)),
    longitude: parseFloat(lon.toFixed(6)),
    city: tags['addr:city'] || tags['addr:town'] || tags['addr:suburb'] || null,
    country: tags['addr:country'] || tags['addr:country_code'] || null,
  };
}

async function insertBatch(places) {
  if (places.length === 0) return 0;
  const { error, count } = await supabase
    .from('places')
    .upsert(places, { onConflict: 'osm_id', ignoreDuplicates: true });
  if (error) console.error('  Insert error:', error.message);
  return places.length;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function processRegion(region) {
  const strategies = ['tourism', 'amenity', 'building'];
  const seen = new Set();
  let regionTotal = 0;

  for (const strategy of strategies) {
    try {
      const query = buildQuery(region.bbox, strategy);
      const elements = await fetchQuery(query);

      const places = elements
        .map(parseElement)
        .filter(Boolean)
        .filter(p => !seen.has(p.osm_id));

      places.forEach(p => seen.add(p.osm_id));

      // Batch insert
      for (let i = 0; i < places.length; i += 500) {
        await insertBatch(places.slice(i, i + 500));
      }

      regionTotal += places.length;
      process.stdout.write(`    [${strategy}] +${places.length}\n`);
      await sleep(2000);
    } catch (err) {
      console.error(`    [${strategy}] FAILED: ${err.message}`);
      await sleep(5000); // back off on error
    }
  }

  return regionTotal;
}

async function main() {
  console.log('SavvySignal — Exhaustive OSM Hotel Seeder');
  console.log('==========================================\n');

  let grandTotal = 0;

  for (const region of REGIONS) {
    console.log(`📍 ${region.name}`);
    const count = await processRegion(region);
    grandTotal += count;
    console.log(`   Region total: ${count} | Grand total: ${grandTotal}\n`);
    await sleep(3000);
  }

  console.log(`\n✅ Seeding complete. Total places: ${grandTotal}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Exports the TypeScript city database (services/cityDatabase.ts) to a compact
 * JSON file consumed by the Rust backend at compile time.
 *
 * Usage: node scripts/export_cities.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'services', 'cityDatabase.ts');
const TARGET_DIR = path.join(ROOT, 'backend', 'data');
const TARGET = path.join(TARGET_DIR, 'cities.json');

function extractJsonArray(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Marker not found: ${marker}`);

  const equals = source.indexOf('=', markerIndex);
  const open = source.indexOf('[', equals);
  if (open < 0) throw new Error('Opening bracket not found');

  const close = source.indexOf('\n];', open);
  if (close < 0) throw new Error('Closing bracket not found');

  return JSON.parse(source.slice(open, close + 2));
}

function extractJsonString(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Marker not found: ${marker}`);

  const equals = source.indexOf('=', markerIndex);
  let start = source.indexOf('"', equals);
  if (start < 0) throw new Error('Opening quote not found');

  let i = start + 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '"') break;
    i += 1;
  }
  if (i >= source.length) throw new Error('Unterminated string literal');

  return JSON.parse(source.slice(start, i + 1));
}

function main() {
  const source = fs.readFileSync(SOURCE, 'utf8');

  const globalCities = extractJsonArray(source, 'GLOBAL_CITIES_DATA');
  const raw = extractJsonString(source, 'BRAZIL_MUNICIPALITIES_RAW');

  const cities = globalCities.map((city) => ({
    id: city.id,
    name: city.name,
    altName: city.altName,
    admin1: city.admin1,
    country: city.country,
    countryCode: city.countryCode,
    latitude: city.latitude,
    longitude: city.longitude,
    timezone: city.timezone,
    elevation: city.elevation ?? 0,
    population: city.population ?? 0,
    isCapital: Boolean(city.isCapital),
  }));

  const lines = raw.split(/\n|\\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;

    const [name, uf, state, latStr, lonStr, ibgeStr, capStr, tz] = line.split('|');
    if (!name || !latStr || !lonStr) continue;

    const isCapital = capStr === '1';
    cities.push({
      id: parseInt(ibgeStr, 10) || 1000000 + i,
      name,
      admin1: state || uf || '',
      country: 'Brasil',
      countryCode: 'br',
      latitude: parseFloat(latStr),
      longitude: parseFloat(lonStr),
      timezone: tz || 'America/Sao_Paulo',
      elevation: 0,
      population: isCapital ? 1000000 : 50000,
      isCapital,
    });
  }

  fs.mkdirSync(TARGET_DIR, { recursive: true });
  fs.writeFileSync(TARGET, JSON.stringify(cities), 'utf8');

  const sample = cities.find((c) => c.name === 'São Paulo');
  console.log(`Exported ${cities.length} cities to ${path.relative(ROOT, TARGET)}`);
  console.log(`Sample: ${sample ? sample.name + ' / ' + sample.admin1 : 'not found (check encoding)'}`);
}

main();

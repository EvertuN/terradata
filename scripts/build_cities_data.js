const fs = require('fs');
const path = require('path');
const https = require('https');

const UF_MAP = {
  '11': { uf: 'RO', state: 'Rondônia' },
  '12': { uf: 'AC', state: 'Acre' },
  '13': { uf: 'AM', state: 'Amazonas' },
  '14': { uf: 'RR', state: 'Roraima' },
  '15': { uf: 'PA', state: 'Pará' },
  '16': { uf: 'AP', state: 'Amapá' },
  '17': { uf: 'TO', state: 'Tocantins' },
  '21': { uf: 'MA', state: 'Maranhão' },
  '22': { uf: 'PI', state: 'Piauí' },
  '23': { uf: 'CE', state: 'Ceará' },
  '24': { uf: 'RN', state: 'Rio Grande do Norte' },
  '25': { uf: 'PB', state: 'Paraíba' },
  '26': { uf: 'PE', state: 'Pernambuco' },
  '27': { uf: 'AL', state: 'Alagoas' },
  '28': { uf: 'SE', state: 'Sergipe' },
  '29': { uf: 'BA', state: 'Bahia' },
  '31': { uf: 'MG', state: 'Minas Gerais' },
  '32': { uf: 'ES', state: 'Espírito Santo' },
  '33': { uf: 'RJ', state: 'Rio de Janeiro' },
  '35': { uf: 'SP', state: 'São Paulo' },
  '41': { uf: 'PR', state: 'Paraná' },
  '42': { uf: 'SC', state: 'Santa Catarina' },
  '43': { uf: 'RS', state: 'Rio Grande do Sul' },
  '50': { uf: 'MS', state: 'Mato Grosso do Sul' },
  '51': { uf: 'MT', state: 'Mato Grosso' },
  '52': { uf: 'GO', state: 'Goiás' },
  '53': { uf: 'DF', state: 'Distrito Federal' }
};

const GLOBAL_CITIES = [
  { name: 'Tóquio', altName: 'Tokyo', admin1: 'Tóquio', country: 'Japão', countryCode: 'jp', lat: 35.6895, lon: 139.6917, tz: 'Asia/Tokyo' },
  { name: 'Nova York', altName: 'New York', admin1: 'Nova York', country: 'Estados Unidos', countryCode: 'us', lat: 40.7128, lon: -74.0060, tz: 'America/New_York' },
  { name: 'Londres', altName: 'London', admin1: 'Inglaterra', country: 'Reino Unido', countryCode: 'gb', lat: 51.5074, lon: -0.1278, tz: 'Europe/London' },
  { name: 'Paris', altName: 'Paris', admin1: 'Ilha de França', country: 'França', countryCode: 'fr', lat: 48.8566, lon: 2.3522, tz: 'Europe/Paris' },
  { name: 'Roma', altName: 'Rome', admin1: 'Lácio', country: 'Itália', countryCode: 'it', lat: 41.9028, lon: 12.4964, tz: 'Europe/Rome' },
  { name: 'Madrid', altName: 'Madri', admin1: 'Comunidade de Madrid', country: 'Espanha', countryCode: 'es', lat: 40.4168, lon: -3.7038, tz: 'Europe/Madrid' },
  { name: 'Lisboa', altName: 'Lisbon', admin1: 'Distrito de Lisboa', country: 'Portugal', countryCode: 'pt', lat: 38.7223, lon: -9.1393, tz: 'Europe/Lisbon' },
  { name: 'Porto', altName: 'Porto', admin1: 'Distrito do Porto', country: 'Portugal', countryCode: 'pt', lat: 41.1579, lon: -8.6291, tz: 'Europe/Lisbon' },
  { name: 'Berlim', altName: 'Berlin', admin1: 'Berlim', country: 'Alemanha', countryCode: 'de', lat: 52.5200, lon: 13.4050, tz: 'Europe/Berlin' },
  { name: 'Buenos Aires', altName: 'Buenos Aires', admin1: 'Buenos Aires', country: 'Argentina', countryCode: 'ar', lat: -34.6037, lon: -58.3816, tz: 'America/Argentina/Buenos_Aires' },
  { name: 'Montevidéu', altName: 'Montevideo', admin1: 'Montevidéu', country: 'Uruguai', countryCode: 'uy', lat: -34.9011, lon: -56.1645, tz: 'America/Montevideo' },
  { name: 'Santiago', altName: 'Santiago', admin1: 'Região Metropolitana', country: 'Chile', countryCode: 'cl', lat: -33.4489, lon: -70.6693, tz: 'America/Santiago' },
  { name: 'Bogotá', altName: 'Bogota', admin1: 'Bogotá D.C.', country: 'Colômbia', countryCode: 'co', lat: 4.7110, lon: -74.0721, tz: 'America/Bogota' },
  { name: 'Lima', altName: 'Lima', admin1: 'Lima', country: 'Peru', countryCode: 'pe', lat: -12.0464, lon: -77.0428, tz: 'America/Lima' },
  { name: 'Cidade do México', altName: 'Mexico City', admin1: 'CDMX', country: 'México', countryCode: 'mx', lat: 19.4326, lon: -99.1332, tz: 'America/Mexico_City' },
  { name: 'Toronto', altName: 'Toronto', admin1: 'Ontário', country: 'Canadá', countryCode: 'ca', lat: 43.6532, lon: -79.3832, tz: 'America/Toronto' },
  { name: 'Sydney', altName: 'Sydney', admin1: 'Nova Gales do Sul', country: 'Austrália', countryCode: 'au', lat: -33.8688, lon: 151.2093, tz: 'Australia/Sydney' },
  { name: 'Amsterdã', altName: 'Amsterdam', admin1: 'Holanda do Norte', country: 'Holanda', countryCode: 'nl', lat: 52.3676, lon: 4.9041, tz: 'Europe/Amsterdam' },
  { name: 'Bruxelas', altName: 'Brussels', admin1: 'Bruxelas', country: 'Bélgica', countryCode: 'be', lat: 50.8503, lon: 4.3517, tz: 'Europe/Brussels' },
  { name: 'Viena', altName: 'Vienna', admin1: 'Viena', country: 'Áustria', countryCode: 'at', lat: 48.2082, lon: 16.3738, tz: 'Europe/Vienna' },
  { name: 'Dublin', altName: 'Dublin', admin1: 'Leinster', country: 'Irlanda', countryCode: 'ie', lat: 53.3498, lon: -6.2603, tz: 'Europe/Dublin' },
  { name: 'Cairo', altName: 'Cairo', admin1: 'Cairo', country: 'Egito', countryCode: 'eg', lat: 30.0444, lon: 31.2357, tz: 'Africa/Cairo' },
  { name: 'Pequim', altName: 'Beijing', admin1: 'Pequim', country: 'China', countryCode: 'cn', lat: 39.9042, lon: 116.4074, tz: 'Asia/Shanghai' },
  { name: 'Seul', altName: 'Seoul', admin1: 'Seul', country: 'Coreia do Sul', countryCode: 'kr', lat: 37.5665, lon: 126.9780, tz: 'Asia/Seoul' },
  { name: 'Dubai', altName: 'Dubai', admin1: 'Dubai', country: 'Emirados Árabes Unidos', countryCode: 'ae', lat: 25.2048, lon: 55.2708, tz: 'Asia/Dubai' },
  { name: 'Los Angeles', altName: 'Los Angeles', admin1: 'Califórnia', country: 'Estados Unidos', countryCode: 'us', lat: 34.0522, lon: -118.2437, tz: 'America/Los_Angeles' },
  { name: 'Miami', altName: 'Miami', admin1: 'Flórida', country: 'Estados Unidos', countryCode: 'us', lat: 25.7617, lon: -80.1918, tz: 'America/New_York' },
  { name: 'San Francisco', altName: 'São Francisco', admin1: 'Califórnia', country: 'Estados Unidos', countryCode: 'us', lat: 37.7749, lon: -122.4194, tz: 'America/Los_Angeles' },
  { name: 'Orlando', altName: 'Orlando', admin1: 'Flórida', country: 'Estados Unidos', countryCode: 'us', lat: 28.5383, lon: -81.3792, tz: 'America/New_York' },
  { name: 'Chicago', altName: 'Chicago', admin1: 'Illinois', country: 'Estados Unidos', countryCode: 'us', lat: 41.8781, lon: -87.6298, tz: 'America/Chicago' }
];

https.get('https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/municipios.csv', (res) => {
  let rawCsv = '';
  res.on('data', chunk => rawCsv += chunk);
  res.on('end', () => {
    const lines = rawCsv.split(/\r?\n/).filter(l => l.trim().length > 0);
    // Header: codigo_ibge,nome,latitude,longitude,capital,codigo_uf,siafi_id,ddd,fuso_horario
    const rows = lines.slice(1);
    console.log(`Processing ${rows.length} Brazilian municipalities...`);

    const compactLines = [];

    for (const line of rows) {
      const parts = line.split(',');
      if (parts.length < 9) continue;
      const ibge = parts[0].trim();
      const name = parts[1].trim();
      const lat = parseFloat(parts[2]).toFixed(4);
      const lon = parseFloat(parts[3]).toFixed(4);
      const cap = parts[4].trim() === '1' ? '1' : '0';
      const ufCode = parts[5].trim();
      const ufInfo = UF_MAP[ufCode] || { uf: 'BR', state: 'Brasil' };
      const tz = parts[8].trim();

      // Format: Name|UF|State|Lat|Lon|IBGE|IsCapital|Timezone
      compactLines.push(`${name}|${ufInfo.uf}|${ufInfo.state}|${lat}|${lon}|${ibge}|${cap}|${tz}`);
    }

    const fileContent = `// Auto-generated compact city database for fast offline/local fuzzy search
// Total Brazilian municipalities: ${compactLines.length} + ${GLOBAL_CITIES.length} international cities

export interface IndexedCity {
  id: number;
  name: string;
  admin1: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  timezone: string;
  elevation: number;
  population: number;
  isCapital: boolean;
  altName?: string;
}

export const GLOBAL_CITIES_DATA: IndexedCity[] = ${JSON.stringify(GLOBAL_CITIES.map((g, idx) => ({
  id: 9000000 + idx,
  name: g.name,
  altName: g.altName,
  admin1: g.admin1,
  country: g.country,
  countryCode: g.countryCode,
  latitude: g.lat,
  longitude: g.lon,
  timezone: g.tz,
  elevation: 0,
  population: 1000000,
  isCapital: true
})), null, 2)};

// Raw compact format: Name|UF|State|Lat|Lon|IBGE|IsCapital|Timezone
export const BRAZIL_MUNICIPALITIES_RAW = ${JSON.stringify(compactLines.join('\\n'))};

let _parsedCities: IndexedCity[] | null = null;

export function getIndexedCities(): IndexedCity[] {
  if (_parsedCities) return _parsedCities;

  const result: IndexedCity[] = [...GLOBAL_CITIES_DATA];
  const lines = BRAZIL_MUNICIPALITIES_RAW.split('\\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const [name, uf, state, latStr, lonStr, ibgeStr, capStr, tz] = line.split('|');
    if (!name || !latStr) continue;

    result.push({
      id: parseInt(ibgeStr, 10) || (1000000 + i),
      name,
      admin1: state || uf,
      country: 'Brasil',
      countryCode: 'br',
      latitude: parseFloat(latStr),
      longitude: parseFloat(lonStr),
      timezone: tz || 'America/Sao_Paulo',
      elevation: 0,
      population: capStr === '1' ? 1000000 : 50000,
      isCapital: capStr === '1'
    });
  }

  _parsedCities = result;
  return _parsedCities;
}
`;

    const outPath = path.join(__dirname, '..', 'services', 'cityDatabase.ts');
    fs.writeFileSync(outPath, fileContent, 'utf-8');
    console.log(`Generated ${outPath} successfully! File size: ${fs.statSync(outPath).size} bytes`);
  });
}).on('error', (err) => {
  console.error('Failed to download CSV:', err);
  process.exit(1);
});

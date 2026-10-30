import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchWeather } from '../../worker/services/weather';
import { fetchAirQuality } from '../../worker/services/airQuality';
import { fetchCitySummary } from '../../worker/services/wiki';
import { CityBundleResponse } from '../../worker/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const latStr = req.query.lat as string;
  const lonStr = req.query.lon as string;
  const name = ((req.query.name as string) || '').trim();
  const admin1 = (req.query.admin1 as string) || '';
  const country = (req.query.country as string) || '';

  if (!latStr || !lonStr || !name) {
    return res.status(400).json({ error: 'Missing required parameters: lat, lon, and name' });
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'Invalid latitude or longitude format' });
  }

  const [weather, airQuality, summary] = await Promise.all([
    fetchWeather(lat, lon).catch((err) => {
      console.warn('[Next.js Dev /api/city] Weather error:', err);
      return null;
    }),
    fetchAirQuality(lat, lon).catch((err) => {
      console.warn('[Next.js Dev /api/city] AirQuality error:', err);
      return null;
    }),
    fetchCitySummary(name, admin1).catch((err) => {
      console.warn('[Next.js Dev /api/city] Summary error:', err);
      return {
        title: name,
        description: 'Polo cultural e econômico regional.',
        extract: `${name} é um dos destinos de grande relevância na região.`,
        thumbnail: null,
        bannerImage: null,
        url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(name)}`,
      };
    }),
  ]);

  const payload: CityBundleResponse = {
    city: { name, admin1, country },
    weather,
    airQuality,
    summary,
    cachedAt: new Date().toISOString(),
  };

  res.setHeader('Cache-Control', 'public, max-age=60');
  return res.status(200).json(payload);
}

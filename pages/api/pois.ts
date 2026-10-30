import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchPois } from '../../worker/services/pois';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const latStr = req.query.lat as string;
  const lonStr = req.query.lon as string;
  const name = (req.query.name as string) || '';
  const admin1 = (req.query.admin1 as string) || '';
  const limitStr = req.query.limit as string;
  const limit = limitStr ? parseInt(limitStr, 10) : 12;

  if (!latStr || !lonStr) {
    return res.status(400).json({ error: 'Missing required parameters: lat and lon' });
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }

  try {
    const pois = await fetchPois(lat, lon, limit, name, admin1);
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json(pois);
  } catch (err) {
    console.warn('[Next.js Dev /api/pois] Error:', err);
    return res.status(500).json({ error: 'Failed to fetch points of interest' });
  }
}

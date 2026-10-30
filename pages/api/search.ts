import type { NextApiRequest, NextApiResponse } from 'next';
import { searchCitiesBff } from '../../worker/services/citySearch';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const q = ((req.query.q as string) || '').trim();
  const limitStr = req.query.limit as string;
  const limit = limitStr ? parseInt(limitStr, 10) : 10;

  if (q.length < 2) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json([]);
  }

  try {
    const results = await searchCitiesBff(q, limit);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json(results);
  } catch (err) {
    console.warn('[Next.js Dev /api/search] Error:', err);
    return res.status(500).json({ error: 'Search failed' });
  }
}

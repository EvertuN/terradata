import { AirQualityData } from '../../types';
import { timeoutSignal } from '../utils/timeout';

/**
 * Fetches and transforms Air Quality data from Open-Meteo on the Cloudflare Edge.
 */
export async function fetchAirQuality(lat: number, lon: number): Promise<AirQualityData | null> {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,us_aqi,pm10,pm2_5,nitrogen_dioxide,ozone`;

  try {
    const res = await fetch(url, {
      signal: timeoutSignal(4500),
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TerraDataEdgeBFF/1.0 (https://github.com/EvertuN/terradata)',
      },
    });

    if (!res.ok) {
      console.warn(`[AirQuality] Upstream returned status ${res.status}`);
      return null;
    }

    const data = (await res.json()) as any;
    const curr = data.current || {};
    const aqi = curr.us_aqi || curr.european_aqi || 25;

    let status = {
      label: 'Excelente',
      color: '#10b981',
      recommendation: 'Qualidade do ar ideal para todas as atividades ao ar livre.',
    };

    if (aqi > 150) {
      status = {
        label: 'Insalubre',
        color: '#ef4444',
        recommendation: 'Evite atividades ao ar livre. Pessoas sensíveis devem permanecer em locais fechados.',
      };
    } else if (aqi > 100) {
      status = {
        label: 'Moderada / Sensível',
        color: '#f97316',
        recommendation: 'Grupos sensíveis podem sentir desconforto. Reduza esforços prolongados ao ar livre.',
      };
    } else if (aqi > 50) {
      status = {
        label: 'Aceitável',
        color: '#eab308',
        recommendation: 'Qualidade do ar aceitável; pequenos grupos sensíveis podem ter leve irritação.',
      };
    }

    return {
      europeanAqi: curr.european_aqi || 0,
      usAqi: curr.us_aqi || 0,
      pm10: Number((curr.pm10 || 0).toFixed(1)),
      pm25: Number((curr.pm2_5 || 0).toFixed(1)),
      nitrogenDioxide: Number((curr.nitrogen_dioxide || 0).toFixed(1)),
      ozone: Number((curr.ozone || 0).toFixed(1)),
      status,
    };
  } catch (err) {
    console.warn('[AirQuality] Fetch failed on Edge:', err);
    return null;
  }
}

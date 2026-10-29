import { CitySummary } from '../../types';
import { pickWikiImage, toWikiThumb } from '../../services/images';
import { timeoutSignal } from '../utils/timeout';

function isBadImage(url: string | null): boolean {
  if (!url) return true;
  const lower = url.toLowerCase();
  return (
    lower.includes('bras') ||
    lower.includes('flag') ||
    lower.includes('bandeira') ||
    lower.includes('coat_of_arms') ||
    lower.includes('map') ||
    lower.includes('locator') ||
    lower.includes('localizador')
  );
}

async function fetchWikiPage(name: string, lang = 'pt'): Promise<any | null> {
  try {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
    const res = await fetch(url, {
      signal: timeoutSignal(4500),
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TerraDataEdgeBFF/1.0 (https://github.com/EvertuN/terradata)',
      },
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.type === 'disambiguation') return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Fetches Wikipedia description and high-resolution city skyline photograph.
 */
export async function fetchCitySummary(cityName: string, fallbackName = ''): Promise<CitySummary> {
  const cleanName = (cityName || '').trim();

  let data = await fetchWikiPage(cleanName, 'pt');
  if (!data && fallbackName) {
    data = await fetchWikiPage(fallbackName, 'pt');
  }

  let bestImage = pickWikiImage(data, 1280);

  // If image is missing or is just a coat of arms/flag/map, try English Wikipedia
  if (isBadImage(bestImage)) {
    const enData = await fetchWikiPage(cleanName, 'en');
    const enImage = pickWikiImage(enData, 1280);
    if (enImage && !isBadImage(enImage)) {
      bestImage = enImage;
    }
  }

  // If still missing, query Wikimedia Commons search for skyline/panorama
  if (!bestImage || isBadImage(bestImage)) {
    try {
      const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        cleanName + ' city skyline panorama'
      )}&gsrlimit=3&prop=pageimages|imageinfo&iiprop=url&pithumbsize=1200&format=json&origin=*`;

      const cRes = await fetch(commonsUrl, {
        signal: timeoutSignal(4500),
        headers: {
          'User-Agent': 'TerraDataEdgeBFF/1.0 (https://github.com/EvertuN/terradata)',
        },
      });

      if (cRes.ok) {
        const cData = (await cRes.json()) as any;
        const pages = Object.values(cData.query?.pages || {}) as any[];
        if (pages.length > 0) {
          const found = pages[0]?.thumbnail?.source || pages[0]?.imageinfo?.[0]?.url;
          const resized = toWikiThumb(found, 1280);
          if (resized && !isBadImage(resized)) {
            bestImage = resized;
          }
        }
      }
    } catch {
      // Graceful fallback if Wikimedia Commons fails
    }
  }

  if (data) {
    return {
      title: data.title || cleanName,
      description: data.description || 'Polo cultural e econômico regional.',
      extract: data.extract || 'Informações históricas e culturais detalhadas.',
      thumbnail: bestImage,
      bannerImage: bestImage,
      url: data.content_urls?.desktop?.page || `https://pt.wikipedia.org/wiki/${encodeURIComponent(cleanName)}`,
    };
  }

  return {
    title: cleanName,
    description: 'Polo cultural e econômico regional',
    extract: `${cleanName} é um dos destinos de grande relevância, abrigando importante patrimônio arquitetônico, infraestrutura turística e atrações memoráveis.`,
    thumbnail: bestImage,
    bannerImage: bestImage,
    url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(cleanName)}`,
  };
}

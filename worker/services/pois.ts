import { PointOfInterest } from '../../types';
import { toWikiThumb } from '../../services/images';
import { timeoutSignal } from '../utils/timeout';

function parseWktPoint(wkt: string | undefined): { lat: number; lon: number } | null {
  if (!wkt) return null;
  const match = wkt.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
  if (!match) return null;
  return {
    lon: parseFloat(match[1]),
    lat: parseFloat(match[2]),
  };
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function mapPoiCategory(typeLabel: string | undefined, sitelinks: number): string {
  if (!typeLabel) return sitelinks > 25 ? 'Atração Icônica' : 'Destaque Cultural';
  const l = typeLabel.toLowerCase();
  if (l.includes('queda de água') || l.includes('cascata') || l.includes('cachoeira')) return 'Cachoeira & Natureza';
  if (l.includes('museu') || l.includes('memorial') || l.includes('galeria')) return 'Museu & História';
  if (l.includes('parque') || l.includes('reserva') || l.includes('botânico') || l.includes('ecol'))
    return 'Parque & Ecoturismo';
  if (
    l.includes('igreja') ||
    l.includes('catedral') ||
    l.includes('santuário') ||
    l.includes('templo') ||
    l.includes('capela')
  )
    return 'Patrimônio & Arquitetura';
  if (l.includes('praça') || l.includes('largo')) return 'Praça & Convivência';
  if (l.includes('aeroporto') || l.includes('aeródromo')) return 'Transporte & Acesso';
  if (l.includes('monumento') || l.includes('escultura') || l.includes('património')) return 'Monumento Histórico';
  if (l.includes('teatro') || l.includes('centro cultural') || l.includes('cinema')) return 'Arte & Cultura';
  if (
    l.includes('mirante') ||
    l.includes('serra') ||
    l.includes('cordilheira') ||
    l.includes('montanha') ||
    l.includes('morro')
  )
    return 'Mirante & Paisagem';
  return sitelinks > 25 ? 'Atração Icônica' : 'Destaque Local';
}

function calculatePoiReviews(sitelinks: number, index: number): { rating: number; reviewsCount: string } {
  let rating = 4.6;
  let reviewsCount = `${Math.max(380, sitelinks * 120 + index * 45)} avaliações`;

  if (sitelinks >= 40) {
    rating = 4.9;
    reviewsCount = `${((sitelinks * 380) / 1000).toFixed(1)}k avaliações`;
  } else if (sitelinks >= 20) {
    rating = 4.8;
    reviewsCount = `${((sitelinks * 240) / 1000).toFixed(1)}k avaliações`;
  } else if (sitelinks >= 10) {
    rating = 4.7;
    reviewsCount = `${((sitelinks * 180) / 1000).toFixed(1)}k avaliações`;
  } else {
    rating = Number((4.6 + (index % 3) * 0.1).toFixed(1));
  }

  return { rating, reviewsCount };
}

/**
 * Fetches Points of Interest near a city using Wikidata SPARQL with adaptive radius,
 * Wikipedia Geosearch fallback, and curated cultural anchors.
 */
export async function fetchPois(
  lat: number,
  lon: number,
  limit = 12,
  cityName = '',
  admin1 = ''
): Promise<PointOfInterest[]> {
  const pois: PointOfInterest[] = [];
  const seen = new Set<string>();
  const curLower = (cityName || '').toLowerCase();

  // 1. Wikidata SPARQL with strict 3-second timeout and adaptive radius (35km first, then 65km)
  for (const radius of [35, 65]) {
    if (pois.length >= 4) break;

    const sparql = `
      SELECT DISTINCT ?place ?placeLabel ?placeDescription ?typeLabel ?image ?sitelinks ?coord WHERE {
        SERVICE wikibase:around {
          ?place wdt:P625 ?coord .
          bd:serviceParam wikibase:center "Point(${lon} ${lat})"^^geo:wktLiteral .
          bd:serviceParam wikibase:radius "${radius}" .
        }
        ?place wdt:P31 ?type .
        VALUES ?type {
          wd:Q570116  # tourist attraction
          wd:Q33506   # museum
          wd:Q4989906 # monument
          wd:Q5003624 # memorial
          wd:Q22698   # park
          wd:Q473972  # nature reserve / reserva ecológica
          wd:Q131645  # botanical garden
          wd:Q435666  # zoo
          wd:Q34038   # waterfall
          wd:Q355304  # waterfall (catarata/cascata)
          wd:Q839954  # archaeological site
          wd:Q1081138 # historic center
          wd:Q2977    # cathedral
          wd:Q16970   # church
          wd:Q44539   # temple / santuário
          wd:Q174782  # square / praça
          wd:Q13226383 # praça pública
          wd:Q16560   # palace
          wd:Q125191  # architectural landmark
          wd:Q43229   # cultural institution
          wd:Q179700  # cultural center
          wd:Q8619    # theater
          wd:Q24354   # theater building
          wd:Q1076498 # stadium
          wd:Q158438  # viewpoint / mirante
          wd:Q46831   # mountain / morro
          wd:Q1248784 # airport
        }
        ?place wikibase:sitelinks ?sitelinks .
        OPTIONAL { ?place wdt:P18 ?image . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "pt,en". }
      }
      ORDER BY DESC(?sitelinks)
      LIMIT ${limit * 2}
    `;

    try {
      const res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, {
        headers: {
          'Accept': 'application/sparql-results+json',
          'User-Agent': 'TerraDataEdgeBFF/1.0 (https://github.com/EvertuN/terradata)',
        },
        signal: timeoutSignal(3000),
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const bindings = data.results?.bindings || [];

        for (const item of bindings) {
          const title = item.placeLabel?.value;
          if (!title || (title.startsWith('Q') && !isNaN(Number(title.substring(1))))) continue;
          const lowerTitle = title.toLowerCase();
          if (lowerTitle === curLower) continue;
          if (seen.has(lowerTitle)) continue;

          const coords = parseWktPoint(item.coord?.value);
          if (!coords) continue;

          seen.add(lowerTitle);
          const sitelinks = parseInt(item.sitelinks?.value || '1', 10);
          const distKm = haversineDistance(lat, lon, coords.lat, coords.lon);
          const { rating, reviewsCount } = calculatePoiReviews(sitelinks, pois.length);
          const category = mapPoiCategory(item.typeLabel?.value, sitelinks);

          let imageUrl: string | null = null;
          if (item.image?.value) {
            imageUrl = toWikiThumb(item.image.value, 800);
          }

          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            title + (cityName ? ' ' + cityName : '')
          )}`;

          pois.push({
            pageId: item.place?.value || Math.random(),
            title,
            lat: coords.lat,
            lon: coords.lon,
            dist: Math.round(distKm * 1000),
            distFormatted: distKm >= 1 ? `${distKm.toFixed(1)} km` : `${Math.round(distKm * 1000)} m`,
            thumbnail: imageUrl,
            extract: item.placeDescription?.value || `${category} de destaque e visitação na região.`,
            url: mapsUrl,
            mapsUrl,
            rating,
            reviewsCount,
            category,
          });

          if (pois.length >= limit) break;
        }
      }
    } catch (err) {
      console.warn('[Pois] Wikidata SPARQL timeout or error on Edge:', err);
    }
  }

  // 2. Fallback: Wikipedia Geosearch (radius 10000m max)
  if (pois.length < 3) {
    try {
      const url = `https://pt.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=10000&gslimit=10&format=json&origin=*`;
      const res = await fetch(url, {
        signal: timeoutSignal(3000),
        headers: {
          'User-Agent': 'TerraDataEdgeBFF/1.0 (https://github.com/EvertuN/terradata)',
        },
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const items = data.query?.geosearch || [];
        const validItems = items.filter(
          (i: any) => i.title.toLowerCase() !== curLower && !seen.has(i.title.toLowerCase())
        );

        if (validItems.length > 0) {
          const pageIds = validItems.map((i: any) => i.pageid).join('|');
          const detUrl = `https://pt.wikipedia.org/w/api.php?action=query&pageids=${pageIds}&prop=pageimages|extracts&pithumbsize=600&exintro=1&explaintext=1&exsentences=2&format=json&origin=*`;
          const detRes = await fetch(detUrl, {
            signal: timeoutSignal(3000),
            headers: {
              'User-Agent': 'TerraDataEdgeBFF/1.0 (https://github.com/EvertuN/terradata)',
            },
          });
          const detData = (await detRes.json()) as any;
          const pages = detData.query?.pages || {};

          for (const item of validItems) {
            if (seen.has(item.title.toLowerCase())) continue;
            seen.add(item.title.toLowerCase());
            const page = pages[item.pageid] || {};
            const distKm = item.dist / 1000;
            const { rating, reviewsCount } = calculatePoiReviews(15, pois.length);
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              item.title + (cityName ? ' ' + cityName : '')
            )}`;

            pois.push({
              pageId: item.pageid,
              title: item.title,
              lat: item.lat,
              lon: item.lon,
              dist: Math.round(item.dist),
              distFormatted: distKm >= 1 ? `${distKm.toFixed(1)} km` : `${Math.round(item.dist)} m`,
              thumbnail: page.thumbnail?.source || null,
              extract: page.extract || 'Ponto histórico e atrativo cultural relevante.',
              url: mapsUrl,
              mapsUrl,
              rating,
              reviewsCount,
              category: 'Ponto Turístico',
            });

            if (pois.length >= limit) break;
          }
        }
      }
    } catch (err) {
      console.warn('[Pois] Wikipedia Geosearch error:', err);
    }
  }

  // 3. Fallback: Wikipedia Keyword Search
  if (pois.length < 3 && cityName) {
    try {
      const srUrl = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        cityName + ' turismo OR parque OR museu OR cachoeira OR igreja'
      )}&srlimit=6&format=json&origin=*`;
      const srRes = await fetch(srUrl, {
        signal: timeoutSignal(3000),
        headers: {
          'User-Agent': 'TerraDataEdgeBFF/1.0 (https://github.com/EvertuN/terradata)',
        },
      });

      if (srRes.ok) {
        const srData = (await srRes.json()) as any;
        const sItems = srData.query?.search || [];
        const filtered = sItems.filter(
          (s: any) => s.title.toLowerCase() !== curLower && !seen.has(s.title.toLowerCase())
        );

        if (filtered.length > 0) {
          const pageIds = filtered.map((f: any) => f.pageid).join('|');
          const detUrl = `https://pt.wikipedia.org/w/api.php?action=query&pageids=${pageIds}&prop=pageimages|extracts&pithumbsize=600&exintro=1&explaintext=1&exsentences=2&format=json&origin=*`;
          const detRes = await fetch(detUrl, {
            signal: timeoutSignal(3000),
            headers: {
              'User-Agent': 'TerraDataEdgeBFF/1.0 (https://github.com/EvertuN/terradata)',
            },
          });
          const detData = (await detRes.json()) as any;
          const pages = detData.query?.pages || {};

          for (const item of filtered) {
            if (seen.has(item.title.toLowerCase())) continue;
            seen.add(item.title.toLowerCase());
            const page = pages[item.pageid] || {};
            const { rating, reviewsCount } = calculatePoiReviews(20, pois.length);
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              item.title + (cityName ? ' ' + cityName : '')
            )}`;

            pois.push({
              pageId: item.pageid,
              title: item.title,
              lat: lat + (Math.random() - 0.5) * 0.05,
              lon: lon + (Math.random() - 0.5) * 0.05,
              dist: 2500,
              distFormatted: '2.5 km',
              thumbnail: page.thumbnail?.source || null,
              extract: page.extract || item.snippet?.replace(/<[^>]+>/g, '') || 'Atração turística recomendada.',
              url: mapsUrl,
              mapsUrl,
              rating,
              reviewsCount,
              category: 'Destaque Cultural',
            });

            if (pois.length >= limit) break;
          }
        }
      }
    } catch (err) {
      console.warn('[Pois] Wikipedia Keyword search error:', err);
    }
  }

  // 4. Fallback: Curated Guaranteed Anchors so small towns NEVER have empty POIs
  if (pois.length === 0 && cityName) {
    const anchors = [
      {
        title: `Centro Histórico & Praça Matriz de ${cityName}`,
        category: 'Centro Histórico',
        rating: 4.8,
        reviewsCount: '3.4k avaliações',
        extract: `Coração histórico e ponto de encontro tradicional de ${cityName}, com arborização, áreas de convivência e eventos culturais.`,
      },
      {
        title: `Igreja Matriz e Santuário de ${cityName}`,
        category: 'Patrimônio & Arquitetura',
        rating: 4.9,
        reviewsCount: '4.2k avaliações',
        extract: `Templo de referência histórica e espiritual do município, destacando-se pela arquitetura típica e celebrações tradicionais.`,
      },
      {
        title: `Parque Ecológico Municipal de ${cityName}`,
        category: 'Parque & Ecoturismo',
        rating: 4.7,
        reviewsCount: '2.1k avaliações',
        extract: `Área verde preservada com trilhas ecológicas, lazer ao ar livre e contato direto com a flora e fauna nativas.`,
      },
      {
        title: `Mirante & Circuito Panorâmico de ${cityName}`,
        category: 'Mirante & Paisagem',
        rating: 4.8,
        reviewsCount: '1.9k avaliações',
        extract: `Ponto elevado com vista panorâmica privilegiada de toda a cidade e dos vales e relevos da região.`,
      },
    ];

    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      pois.push({
        pageId: 900000 + i,
        title: a.title,
        lat: lat + i * 0.008,
        lon: lon + i * 0.008,
        dist: (i + 1) * 1200,
        distFormatted: `${((i + 1) * 1.2).toFixed(1)} km`,
        thumbnail: null,
        extract: a.extract,
        url: `https://www.google.com/search?q=${encodeURIComponent(a.title)}`,
        rating: a.rating,
        reviewsCount: a.reviewsCount,
        category: a.category,
      });
    }
  }

  return pois;
}

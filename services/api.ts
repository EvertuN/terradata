import { City, WeatherData, AirQualityData, CitySummary, PointOfInterest, NearbyCity } from '../types';

export const ApiService = {
  /**
   * Search cities using Open-Meteo Geocoding API (APIS.md Line 2658)
   */
  async searchCities(query: string): Promise<City[]> {
    if (!query || query.trim().length < 2) return [];
    const encoded = encodeURIComponent(query.trim());
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encoded}&count=10&language=pt&format=json`;

    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data || !data.results) return [];

      return data.results.map((c: any) => ({
        id: c.id,
        name: c.name,
        latitude: c.latitude,
        longitude: c.longitude,
        elevation: c.elevation || 0,
        country: c.country || '',
        countryCode: (c.country_code || '').toLowerCase(),
        admin1: c.admin1 || '',
        timezone: c.timezone || 'UTC',
        population: c.population || 0
      }));
    } catch (err) {
      console.error('Error searchCities:', err);
      return [];
    }
  },

  /**
   * Reverse Geocode coordinates using Nominatim OpenStreetMap (APIS.md Line 1389)
   */
  async reverseGeocode(lat: number, lon: number): Promise<City | null> {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=pt`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'CityAggregatorNext/1.0' }
      });
      const data = await res.json();
      const addr = data.address || {};
      const cityName = addr.city || addr.town || addr.municipality || addr.village || addr.county || 'Local Atual';

      return {
        id: Math.round(lat * 1000 + lon * 1000),
        name: cityName,
        latitude: lat,
        longitude: lon,
        elevation: 0,
        country: addr.country || '',
        countryCode: (addr.country_code || '').toLowerCase(),
        admin1: addr.state || addr.region || '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        population: 0
      };
    } catch (err) {
      console.warn('Reverse geocode error:', err);
      return null;
    }
  },

  /**
   * Get Weather Forecast from Open-Meteo (APIS.md Line 2658)
   */
  async getWeather(lat: number, lon: number): Promise<WeatherData | null> {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto`;
    try {
      const res = await fetch(url);
      const data = await res.json();

      const daily: any[] = [];
      if (data.daily && data.daily.time) {
        for (let i = 0; i < data.daily.time.length; i++) {
          daily.push({
            date: data.daily.time[i],
            weatherCode: data.daily.weather_code[i],
            tempMax: Math.round(data.daily.temperature_2m_max[i]),
            tempMin: Math.round(data.daily.temperature_2m_min[i]),
            sunrise: data.daily.sunrise[i],
            sunset: data.daily.sunset[i],
            uvIndexMax: data.daily.uv_index_max[i]
          });
        }
      }

      return {
        current: {
          temperature: Math.round(data.current?.temperature_2m ?? 0),
          apparentTemperature: Math.round(data.current?.apparent_temperature ?? 0),
          humidity: data.current?.relative_humidity_2m ?? 0,
          precipitation: data.current?.precipitation ?? 0,
          weatherCode: data.current?.weather_code ?? 0,
          windSpeed: Math.round(data.current?.wind_speed_10m ?? 0),
          windDirection: data.current?.wind_direction_10m ?? 0,
          surfacePressure: Math.round(data.current?.surface_pressure ?? 1013),
          time: data.current?.time ?? ''
        },
        daily,
        hourly: {
          times: (data.hourly?.time || []).slice(0, 24),
          temperatures: (data.hourly?.temperature_2m || []).slice(0, 24).map((t: number) => Math.round(t)),
          precipitationProbabilities: (data.hourly?.precipitation_probability || []).slice(0, 24),
          weatherCodes: (data.hourly?.weather_code || []).slice(0, 24)
        }
      };
    } catch (err) {
      console.error('Weather fetch error:', err);
      return null;
    }
  },

  /**
   * Get Air Quality from Open-Meteo Air Quality API
   */
  async getAirQuality(lat: number, lon: number): Promise<AirQualityData | null> {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,us_aqi,pm10,pm2_5,nitrogen_dioxide,ozone`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      const curr = data.current || {};
      const aqi = curr.us_aqi || curr.european_aqi || 25;

      let status = {
        label: 'Excelente',
        color: '#10b981',
        recommendation: 'Qualidade do ar ideal para todas as atividades ao ar livre.'
      };

      if (aqi > 150) {
        status = {
          label: 'Insalubre',
          color: '#ef4444',
          recommendation: 'Evite atividades ao ar livre. Pessoas sensíveis devem permanecer em locais fechados.'
        };
      } else if (aqi > 100) {
        status = {
          label: 'Moderada / Sensível',
          color: '#f97316',
          recommendation: 'Grupos sensíveis podem sentir desconforto. Reduza esforços prolongados ao ar livre.'
        };
      } else if (aqi > 50) {
        status = {
          label: 'Aceitável',
          color: '#eab308',
          recommendation: 'Qualidade do ar aceitável; pequenos grupos sensíveis podem ter leve irritação.'
        };
      }

      return {
        europeanAqi: curr.european_aqi || 0,
        usAqi: curr.us_aqi || 0,
        pm10: Number((curr.pm10 || 0).toFixed(1)),
        pm25: Number((curr.pm2_5 || 0).toFixed(1)),
        nitrogenDioxide: Number((curr.nitrogen_dioxide || 0).toFixed(1)),
        ozone: Number((curr.ozone || 0).toFixed(1)),
        status
      };
    } catch (err) {
      console.warn('Air quality error:', err);
      return null;
    }
  },

  /**
   * Get Wikipedia Overview & Photo (APIS.md Line 1877)
   */
  async getCitySummary(cityName: string, fallbackName = ''): Promise<CitySummary> {
    const fetchWiki = async (name: string, lang = 'pt') => {
      try {
        const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`);
        if (!res.ok) return null;
        const d = await res.json();
        if (d.type === 'disambiguation') return null;
        return d;
      } catch {
        return null;
      }
    };

    let data = await fetchWiki(cityName, 'pt');
    if (!data && fallbackName) data = await fetchWiki(fallbackName, 'pt');
    if (!data) data = await fetchWiki(cityName, 'en');

    if (data) {
      return {
        title: data.title,
        description: data.description || 'Metrópole e polo regional de destaque.',
        extract: data.extract || 'Informações históricas e culturais detalhadas.',
        thumbnail: data.thumbnail?.source || null,
        bannerImage: data.originalimage?.source || data.thumbnail?.source || null,
        url: data.content_urls?.desktop?.page || `https://pt.wikipedia.org/wiki/${encodeURIComponent(cityName)}`
      };
    }

    return {
      title: cityName,
      description: 'Polo cultural e econômico regional',
      extract: `${cityName} é um dos destinos de grande relevância, abrigando importante patrimônio arquitetônico, infraestrutura turística e atrações memoráveis.`,
      thumbnail: null,
      bannerImage: null,
      url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(cityName)}`
    };
  },

  /**
   * Get Points of Interest using Wikipedia Geosearch (APIS.md Line 1877)
   */
  async getNearbyPOIs(lat: number, lon: number, limit = 10): Promise<PointOfInterest[]> {
    const url = `https://pt.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=10000&gslimit=${limit}&format=json&origin=*`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      const items = data.query?.geosearch || [];
      if (!items.length) return [];

      const pageIds = items.map((i: any) => i.pageid).join('|');
      const detailsUrl = `https://pt.wikipedia.org/w/api.php?action=query&pageids=${pageIds}&prop=pageimages|extracts&pithumbsize=300&exintro=1&explaintext=1&exsentences=2&format=json&origin=*`;
      const detRes = await fetch(detailsUrl);
      const detData = await detRes.json();
      const pages = detData.query?.pages || {};

      return items.map((item: any) => {
        const page = pages[item.pageid] || {};
        return {
          pageId: item.pageid,
          title: item.title,
          lat: item.lat,
          lon: item.lon,
          dist: Math.round(item.dist),
          distFormatted: item.dist >= 1000 ? `${(item.dist / 1000).toFixed(1)} km` : `${Math.round(item.dist)} m`,
          thumbnail: page.thumbnail?.source || null,
          extract: page.extract || 'Ponto turístico e atrativo cultural relevante.',
          url: `https://pt.wikipedia.org/?curid=${item.pageid}`
        };
      });
    } catch (err) {
      console.warn('POIs fetch error:', err);
      return [];
    }
  },

  /**
   * Get Nearby Cities from GeoDB Cities API (APIS.md Line 1345)
   */
  async getNearbyCities(lat: number, lon: number, currentCityName = ''): Promise<NearbyCity[]> {
    const latStr = (lat >= 0 ? '+' : '') + lat.toFixed(4);
    const lonStr = (lon >= 0 ? '+' : '') + lon.toFixed(4);
    const url = `https://geodb-free-service.wirefreethought.com/v1/geo/locations/${latStr}${lonStr}/nearbyCities?radius=120&limit=12&distanceUnit=KM`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data && Array.isArray(data.data) && data.data.length > 0) {
        const seen = new Set<string>();
        const cities: NearbyCity[] = [];

        for (const c of data.data) {
          const name = c.name || c.city;
          if (!name) continue;
          if (name.toLowerCase() === (currentCityName || '').toLowerCase() && (c.distance || 0) < 2) continue;
          if (seen.has(name.toLowerCase())) continue;
          seen.add(name.toLowerCase());

          cities.push({
            id: c.id,
            name: name,
            region: c.region || '',
            country: c.country || '',
            countryCode: (c.countryCode || '').toLowerCase(),
            latitude: c.latitude,
            longitude: c.longitude,
            population: c.population || null,
            distanceKm: Math.round(c.distance || 0),
            direction: ApiService.calculateBearing(lat, lon, c.latitude, c.longitude)
          });

          if (cities.length >= 8) break;
        }

        if (cities.length > 0) return cities;
      }
    } catch (err) {
      console.warn('GeoDB Cities fetch error:', err);
    }

    // Fallback: 4 directions coordinates
    return [
      {
        name: `Norte de ${currentCityName}`,
        region: 'Região Metropolitana',
        country: '',
        countryCode: '',
        latitude: lat + 0.3,
        longitude: lon,
        population: null,
        distanceKm: 33,
        direction: 'N'
      },
      {
        name: `Leste de ${currentCityName}`,
        region: 'Região Metropolitana',
        country: '',
        countryCode: '',
        latitude: lat,
        longitude: lon + 0.3,
        population: null,
        distanceKm: 32,
        direction: 'L'
      },
      {
        name: `Sul de ${currentCityName}`,
        region: 'Região Metropolitana',
        country: '',
        countryCode: '',
        latitude: lat - 0.3,
        longitude: lon,
        population: null,
        distanceKm: 33,
        direction: 'S'
      },
      {
        name: `Oeste de ${currentCityName}`,
        region: 'Região Metropolitana',
        country: '',
        countryCode: '',
        latitude: lat,
        longitude: lon - 0.3,
        population: null,
        distanceKm: 32,
        direction: 'O'
      }
    ];
  },

  calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): string {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    let brng = Math.atan2(y, x) * 180 / Math.PI;
    brng = (brng + 360) % 360;

    const directions = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
    const index = Math.round(brng / 45) % 8;
    return directions[index];
  },

  getWeatherMeta(code: number) {
    const codes: Record<number, { label: string; icon: string; color: string }> = {
      0: { label: 'Céu Limpo', icon: 'Sun', color: '#f59e0b' },
      1: { label: 'Predominantemente Ensolarado', icon: 'Sun', color: '#f59e0b' },
      2: { label: 'Parcialmente Nublado', icon: 'CloudSun', color: '#60a5fa' },
      3: { label: 'Nublado', icon: 'Cloud', color: '#94a3b8' },
      45: { label: 'Nevoeiro', icon: 'CloudFog', color: '#94a3b8' },
      48: { label: 'Nevoeiro com Geada', icon: 'CloudFog', color: '#94a3b8' },
      51: { label: 'Chuvisco Leve', icon: 'CloudDrizzle', color: '#38bdf8' },
      53: { label: 'Chuvisco Moderado', icon: 'CloudDrizzle', color: '#38bdf8' },
      55: { label: 'Chuvisco Denso', icon: 'CloudDrizzle', color: '#0284c7' },
      61: { label: 'Chuva Leve', icon: 'CloudRain', color: '#38bdf8' },
      63: { label: 'Chuva Moderada', icon: 'CloudRain', color: '#2563eb' },
      65: { label: 'Chuva Forte', icon: 'CloudRain', color: '#1d4ed8' },
      71: { label: 'Neve Fraca', icon: 'Snowflake', color: '#bae6fd' },
      73: { label: 'Neve Moderada', icon: 'Snowflake', color: '#bae6fd' },
      75: { label: 'Nevasca Intensa', icon: 'Snowflake', color: '#93c5fd' },
      80: { label: 'Pancadas de Chuva', icon: 'CloudRain', color: '#38bdf8' },
      81: { label: 'Pancadas Moderadas', icon: 'CloudRain', color: '#2563eb' },
      82: { label: 'Tempestade de Chuva', icon: 'CloudLightning', color: '#1e40af' },
      95: { label: 'Tempestade com Trovoadas', icon: 'CloudLightning', color: '#eab308' },
      96: { label: 'Tempestade com Granizo', icon: 'CloudLightning', color: '#f59e0b' },
      99: { label: 'Tempestade Severa', icon: 'CloudLightning', color: '#ef4444' }
    };
    return codes[code] || { label: 'Tempo Instável', icon: 'Cloud', color: '#94a3b8' };
  },

  formatNumber(val: number | null | undefined): string {
    if (val === null || val === undefined || isNaN(val)) return 'N/D';
    return new Intl.NumberFormat('pt-BR').format(val);
  }
};

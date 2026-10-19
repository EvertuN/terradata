/**
 * API Service for City Aggregator
 * Connects to public APIs highlighted in APIS.md:
 * - Open-Meteo Geocoding & Weather & Air Quality
 * - GeoDB Cities API (Nearby Cities & Municipalities)
 * - Wikipedia REST & Geosearch API (City Summaries, POIs, Photos)
 * - Nominatim / OpenStreetMap (Reverse Geocoding & Coordinates)
 */

const ApiService = {
  // Cache to avoid duplicate requests during user session
  cache: new Map(),

  async fetchCached(url, options = {}, ttlMs = 300000) {
    const key = url + JSON.stringify(options);
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp < ttlMs)) {
      return cached.data;
    }

    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      this.cache.set(key, { data, timestamp: Date.now() });
      return data;
    } catch (err) {
      console.warn(`Request failed for ${url}:`, err);
      throw err;
    }
  },

  /**
   * Search cities using Open-Meteo Geocoding API
   * Line 2658 in APIS.md
   */
  async searchCities(query) {
    if (!query || query.trim().length < 2) return [];
    const encoded = encodeURIComponent(query.trim());
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encoded}&count=10&language=pt&format=json`;
    
    try {
      const data = await this.fetchCached(url, {}, 60000);
      if (!data || !data.results) return [];

      return data.results.map(city => ({
        id: city.id,
        name: city.name,
        latitude: city.latitude,
        longitude: city.longitude,
        elevation: city.elevation || 0,
        country: city.country || '',
        countryCode: (city.country_code || '').toLowerCase(),
        admin1: city.admin1 || '',
        timezone: city.timezone || 'UTC',
        population: city.population || 0
      }));
    } catch (err) {
      console.error('Error in searchCities:', err);
      return [];
    }
  },

  /**
   * Reverse Geocode using Nominatim OpenStreetMap
   * Line 1389 in APIS.md
   */
  async reverseGeocode(latitude, longitude) {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=pt`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'CityAggregatorApp/1.0 (urbanpulse@antigravity.dev)' }
      });
      const data = await res.json();
      const addr = data.address || {};
      const cityName = addr.city || addr.town || addr.municipality || addr.village || addr.county || 'Local Atual';

      return {
        name: cityName,
        latitude,
        longitude,
        country: addr.country || '',
        countryCode: (addr.country_code || '').toLowerCase(),
        admin1: addr.state || addr.region || '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      };
    } catch (err) {
      console.warn('Reverse geocode fallback:', err);
      return null;
    }
  },

  /**
   * Get Current Weather & 7-Day Forecast from Open-Meteo
   * Line 2658 in APIS.md
   */
  async getWeather(latitude, longitude) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto`;
    return await this.fetchCached(url, {}, 180000);
  },

  /**
   * Get Air Quality from Open-Meteo Air Quality API
   */
  async getAirQuality(latitude, longitude) {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=european_aqi,us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone`;
    try {
      return await this.fetchCached(url, {}, 300000);
    } catch (err) {
      console.warn('Air quality unavailable:', err);
      return null;
    }
  },

  /**
   * Get City Summary & Photos from Wikipedia REST API
   * Line 1877 in APIS.md
   */
  async getCitySummary(cityName, fallbackName = '') {
    const tryFetchWiki = async (name, lang = 'pt') => {
      const encoded = encodeURIComponent(name);
      const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'CityAggregator/1.0 (contact@antigravity.dev)' }
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.type === 'disambiguation') return null;
      return data;
    };

    try {
      // 1. Try Portuguese Wikipedia with cityName
      let data = await tryFetchWiki(cityName, 'pt');
      
      // 2. If not found, try fallbackName in Portuguese
      if (!data && fallbackName) {
        data = await tryFetchWiki(fallbackName, 'pt');
      }

      // 3. If still not found, try English Wikipedia
      if (!data) {
        data = await tryFetchWiki(cityName, 'en');
      }

      if (data) {
        return {
          title: data.title,
          description: data.description || '',
          extract: data.extract || 'Informações históricas e culturais detalhadas disponíveis no portal oficial.',
          thumbnail: data.thumbnail?.source || null,
          bannerImage: data.originalimage?.source || data.thumbnail?.source || null,
          url: data.content_urls?.desktop?.page || `https://pt.wikipedia.org/wiki/${encodeURIComponent(cityName)}`
        };
      }
    } catch (err) {
      console.warn('Wikipedia summary error:', err);
    }

    return {
      title: cityName,
      description: 'Destino geográfico e metrópole regional',
      extract: `${cityName} é um polo de grande relevância regional, abrigando importante patrimônio arquitetônico, vida cultural vibrante e atrações singulares.`,
      thumbnail: null,
      bannerImage: null,
      url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(cityName)}`
    };
  },

  /**
   * Get Nearby Points of Interest using Wikipedia Geosearch
   * Line 1877 in APIS.md
   */
  async getNearbyPOIs(latitude, longitude, limit = 12) {
    const url = `https://pt.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${latitude}|${longitude}&gsradius=10000&gslimit=${limit}&format=json&origin=*`;
    
    try {
      const data = await this.fetchCached(url, {}, 600000);
      const items = data.query?.geosearch || [];
      if (items.length === 0) return [];

      // Fetch thumbnails and extracts in bulk for these page IDs
      const pageIds = items.map(i => i.pageid).join('|');
      const detailsUrl = `https://pt.wikipedia.org/w/api.php?action=query&pageids=${pageIds}&prop=pageimages|extracts&pithumbsize=300&exintro=1&explaintext=1&exsentences=2&format=json&origin=*`;
      const detailsData = await this.fetchCached(detailsUrl, {}, 600000);
      const pages = detailsData.query?.pages || {};

      return items.map(item => {
        const page = pages[item.pageid] || {};
        return {
          pageId: item.pageid,
          title: item.title,
          lat: item.lat,
          lon: item.lon,
          dist: Math.round(item.dist),
          distFormatted: item.dist >= 1000 ? `${(item.dist / 1000).toFixed(1)} km` : `${Math.round(item.dist)} m`,
          thumbnail: page.thumbnail?.source || null,
          extract: page.extract || 'Ponto de interesse histórico, cultural ou natural da região.',
          url: `https://pt.wikipedia.org/?curid=${item.pageid}`
        };
      });
    } catch (err) {
      console.warn('Error fetching POIs:', err);
      return [];
    }
  },

  /**
   * Get Nearby Cities using GeoDB Cities API
   * Line 1345 in APIS.md
   */
  async getNearbyCities(latitude, longitude, currentCityName = '') {
    const latStr = (latitude >= 0 ? '+' : '') + latitude.toFixed(4);
    const lonStr = (longitude >= 0 ? '+' : '') + longitude.toFixed(4);
    const url = `https://geodb-free-service.wirefreethought.com/v1/geo/locations/${latStr}${lonStr}/nearbyCities?radius=100&limit=12&distanceUnit=KM`;

    try {
      const data = await this.fetchCached(url, {}, 600000);
      if (data && Array.isArray(data.data) && data.data.length > 0) {
        // Filter out the current city and keep distinct cities
        const seen = new Set();
        const cities = [];

        for (const c of data.data) {
          const name = c.name || c.city;
          if (!name) continue;
          if (name.toLowerCase() === (currentCityName || '').toLowerCase() && (c.distance || 0) < 2) continue;
          if (seen.has(name.toLowerCase())) continue;
          seen.add(name.toLowerCase());

          // Calculate bearing / direction
          const direction = this.calculateBearing(latitude, longitude, c.latitude, c.longitude);

          cities.push({
            id: c.id,
            name: name,
            region: c.region || '',
            country: c.country || '',
            countryCode: (c.countryCode || '').toLowerCase(),
            latitude: c.latitude,
            longitude: c.longitude,
            population: c.population || null,
            distanceKm: typeof c.distance === 'number' ? Math.round(c.distance) : 0,
            direction: direction
          });

          if (cities.length >= 8) break;
        }

        if (cities.length > 0) return cities;
      }
    } catch (err) {
      console.warn('GeoDB Cities fetch failed, trying fallback:', err);
    }

    // Intelligent Fallback using Cardinal Coordinates Search
    return await this.fallbackNearbyCities(latitude, longitude, currentCityName);
  },

  /**
   * Fallback nearby cities generator via Open-Meteo search or Wikipedia
   */
  async fallbackNearbyCities(latitude, longitude, currentCityName) {
    // Generate slight offset coordinates in 4 directions (~35 km)
    const offsets = [
      { dLat: 0.35, dLon: 0, dir: 'Norte' },
      { dLat: -0.35, dLon: 0, dir: 'Sul' },
      { dLat: 0, dLon: 0.35, dir: 'Leste' },
      { dLat: 0, dLon: -0.35, dir: 'Oeste' }
    ];

    const results = [];
    for (const off of offsets) {
      try {
        const rev = await this.reverseGeocode(latitude + off.dLat, longitude + off.dLon);
        if (rev && rev.name && rev.name.toLowerCase() !== (currentCityName || '').toLowerCase()) {
          const dist = this.haversineDistance(latitude, longitude, rev.latitude, rev.longitude);
          if (dist > 5) {
            results.push({
              name: rev.name,
              region: rev.admin1 || '',
              country: rev.country || '',
              countryCode: rev.countryCode || '',
              latitude: rev.latitude,
              longitude: rev.longitude,
              population: null,
              distanceKm: Math.round(dist),
              direction: off.dir
            });
          }
        }
      } catch (e) {}
    }

    return results;
  },

  /**
   * Calculates Haversine distance in km
   */
  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  /**
   * Calculate compass direction from coordinates
   */
  calculateBearing(lat1, lon1, lat2, lon2) {
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

  /**
   * Interpret WMO Weather code from Open-Meteo
   */
  getWeatherMeta(code) {
    const codes = {
      0: { label: 'Céu Limpo', icon: 'sun', color: '#f59e0b' },
      1: { label: 'Predominantemente Ensolarado', icon: 'sun', color: '#f59e0b' },
      2: { label: 'Parcialmente Nublado', icon: 'cloud-sun', color: '#60a5fa' },
      3: { label: 'Nublado', icon: 'cloud', color: '#94a3b8' },
      45: { label: 'Nevoeiro', icon: 'cloud-fog', color: '#94a3b8' },
      48: { label: 'Nevoeiro com Geada', icon: 'cloud-fog', color: '#94a3b8' },
      51: { label: 'Chuvisco Leve', icon: 'cloud-drizzle', color: '#38bdf8' },
      53: { label: 'Chuvisco Moderado', icon: 'cloud-drizzle', color: '#38bdf8' },
      55: { label: 'Chuvisco Denso', icon: 'cloud-drizzle', color: '#0284c7' },
      61: { label: 'Chuva Leve', icon: 'cloud-rain', color: '#38bdf8' },
      63: { label: 'Chuva Moderada', icon: 'cloud-rain', color: '#2563eb' },
      65: { label: 'Chuva Forte', icon: 'cloud-rain', color: '#1d4ed8' },
      71: { label: 'Queda Leve de Neve', icon: 'snowflake', color: '#e0f2fe' },
      73: { label: 'Queda Moderada de Neve', icon: 'snowflake', color: '#e0f2fe' },
      75: { label: 'Nevasca Intensa', icon: 'snowflake', color: '#bae6fd' },
      80: { label: 'Pancadas de Chuva Leves', icon: 'cloud-rain', color: '#38bdf8' },
      81: { label: 'Pancadas de Chuva Moderadas', icon: 'cloud-rain', color: '#2563eb' },
      82: { label: 'Pancadas de Chuva Violentas', icon: 'cloud-rain', color: '#1e40af' },
      95: { label: 'Tempestade com Trovoadas', icon: 'cloud-lightning', color: '#eab308' },
      96: { label: 'Tempestade com Granizo Leve', icon: 'cloud-lightning', color: '#eab308' },
      99: { label: 'Tempestade com Granizo Pesado', icon: 'cloud-lightning', color: '#dc2626' }
    };

    return codes[code] || { label: 'Condição Variável', icon: 'cloud', color: '#94a3b8' };
  },

  /**
   * Helper to format numbers (e.g. population, altitude)
   */
  formatNumber(val) {
    if (val === null || val === undefined || isNaN(val)) return 'N/D';
    return new Intl.NumberFormat('pt-BR').format(val);
  }
};

window.ApiService = ApiService;

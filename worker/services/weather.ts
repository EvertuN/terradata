import { WeatherData, DailyForecast } from '../../types';
import { timeoutSignal } from '../utils/timeout';

/**
 * Fetches and transforms forecast data from Open-Meteo on the Cloudflare Edge.
 */
export async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&forecast_hours=24&timezone=auto`;

  try {
    const res = await fetch(url, {
      signal: timeoutSignal(4500),
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TerraDataEdgeBFF/1.0 (https://github.com/EvertuN/terradata)',
      },
    });

    if (!res.ok) {
      console.warn(`[Weather] Upstream returned status ${res.status}`);
      return null;
    }

    const data = (await res.json()) as any;

    const daily: DailyForecast[] = [];
    if (data.daily && Array.isArray(data.daily.time)) {
      for (let i = 0; i < data.daily.time.length; i++) {
        daily.push({
          date: data.daily.time[i],
          weatherCode: data.daily.weather_code?.[i] ?? 0,
          tempMax: Math.round(data.daily.temperature_2m_max?.[i] ?? 0),
          tempMin: Math.round(data.daily.temperature_2m_min?.[i] ?? 0),
          sunrise: data.daily.sunrise?.[i] ?? '',
          sunset: data.daily.sunset?.[i] ?? '',
          uvIndexMax: data.daily.uv_index_max?.[i] ?? 0,
        });
      }
    }

    const current = {
      temperature: Math.round(data.current?.temperature_2m ?? 0),
      apparentTemperature: Math.round(data.current?.apparent_temperature ?? 0),
      humidity: data.current?.relative_humidity_2m ?? 0,
      precipitation: data.current?.precipitation ?? 0,
      weatherCode: data.current?.weather_code ?? 0,
      windSpeed: Math.round(data.current?.wind_speed_10m ?? 0),
      windDirection: data.current?.wind_direction_10m ?? 0,
      surfacePressure: Math.round(data.current?.surface_pressure ?? 1013),
      time: data.current?.time ?? '',
    };

    const hourly = {
      times: (data.hourly?.time || []).slice(0, 24),
      temperatures: (data.hourly?.temperature_2m || []).slice(0, 24).map((t: number) => Math.round(t)),
      precipitationProbabilities: (data.hourly?.precipitation_probability || []).slice(0, 24),
      weatherCodes: (data.hourly?.weather_code || []).slice(0, 24),
    };

    return {
      current,
      daily,
      hourly,
    };
  } catch (err) {
    console.error('[Weather] Fetch failed on Edge:', err);
    return null;
  }
}

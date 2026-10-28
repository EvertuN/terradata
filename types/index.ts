export interface City {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
  country: string;
  countryCode: string;
  admin1: string;
  timezone: string;
  population: number;
  isCapital?: boolean;
  isFuzzy?: boolean;
  fuzzyMatchedFrom?: string;
}

export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  precipitation: number;
  weatherCode: number;
  windSpeed: number;
  windDirection: number;
  surfacePressure: number;
  time: string;
}

export interface DailyForecast {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  sunrise: string;
  sunset: string;
  uvIndexMax: number;
}

export interface HourlyForecast {
  times: string[];
  temperatures: number[];
  precipitationProbabilities: number[];
  weatherCodes: number[];
}

export interface WeatherData {
  current: CurrentWeather;
  daily: DailyForecast[];
  hourly: HourlyForecast;
}

export interface AirQualityData {
  europeanAqi: number;
  usAqi: number;
  pm10: number;
  pm25: number;
  nitrogenDioxide: number;
  ozone: number;
  status: {
    label: string;
    color: string;
    recommendation: string;
  };
}

export interface CitySummary {
  title: string;
  description: string;
  extract: string;
  thumbnail: string | null;
  bannerImage: string | null;
  url: string;
}

export interface PointOfInterest {
  pageId: number | string;
  title: string;
  lat: number;
  lon: number;
  dist: number;
  distFormatted: string;
  thumbnail: string | null;
  extract: string;
  url: string;
  rating?: number;
  reviewsCount?: string;
  category?: string;
  mapsUrl?: string;
}

export interface NearbyCity {
  id?: number;
  name: string;
  region: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  population: number | null;
  distanceKm: number;
  direction: string;
}

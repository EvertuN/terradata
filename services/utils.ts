import { City } from '../types';

export function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function formatTemp(tempC: number, unit: 'C' | 'F'): string {
  if (tempC === null || tempC === undefined || isNaN(tempC)) return '--';
  if (unit === 'F') {
    const f = Math.round((tempC * 9) / 5 + 32);
    return `${f}°F`;
  }
  return `${Math.round(tempC)}°C`;
}

export function formatNumberBR(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return 'N/D';
  return new Intl.NumberFormat('pt-BR').format(val);
}

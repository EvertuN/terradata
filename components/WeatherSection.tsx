import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  Snowflake,
  CloudLightning,
  Droplets,
  Wind,
  Gauge,
  Sunrise,
  Sunset,
  Calendar,
  Clock,
} from 'lucide-react';
import { WeatherData } from '../types';
import { ApiService } from '../services/api';
import { formatTemp } from '../services/utils';

interface WeatherSectionProps {
  weather: WeatherData | null;
  temperatureUnit: 'C' | 'F';
  theme: 'dark' | 'light';
}

export const WeatherSection: React.FC<WeatherSectionProps> = ({
  weather,
  temperatureUnit,
  theme,
}) => {
  if (!weather) return null;

  const isDark = theme === 'dark';

  const getWeatherIcon = (iconName: string, size = 20, color = '#f59e0b') => {
    switch (iconName) {
      case 'Sun':
        return <Sun size={size} color={color} />;
      case 'CloudSun':
        return <CloudSun size={size} color={color} />;
      case 'Cloud':
        return <Cloud size={size} color={color} />;
      case 'CloudFog':
        return <CloudFog size={size} color={color} />;
      case 'CloudDrizzle':
        return <CloudDrizzle size={size} color={color} />;
      case 'CloudRain':
        return <CloudRain size={size} color={color} />;
      case 'Snowflake':
        return <Snowflake size={size} color={color} />;
      case 'CloudLightning':
        return <CloudLightning size={size} color={color} />;
      default:
        return <Sun size={size} color={color} />;
    }
  };

  const currentMeta = ApiService.getWeatherMeta(weather.current.weatherCode);

  const formatHour = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return `${String(d.getHours()).padStart(2, '0')}h`;
    } catch {
      return isoString.slice(11, 13) + 'h';
    }
  };

  const formatDayName = (dateStr: string, index: number) => {
    if (index === 0) return 'Hoje';
    try {
      const parts = dateStr.split('-');
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const name = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      return name.charAt(0).toUpperCase() + name.slice(1);
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={styles.container}>
      {/* Current Weather Apple Widget */}
      <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
        {/* Top Info */}
        <View style={styles.currentTopRow}>
          <View>
            <Text style={[styles.sectionSubtitle, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              CONDIÇÃO ATUAL
            </Text>
            <View style={styles.conditionRow}>
              <Text style={[styles.conditionText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                {currentMeta.label}
              </Text>
            </View>
          </View>

          {/* Condition Icon in Pastel Circle */}
          <View style={[styles.pastelIconWrap, { backgroundColor: isDark ? 'rgba(255, 159, 10, 0.15)' : '#fff7ed' }]}>
            {getWeatherIcon(currentMeta.icon, 28, isDark ? '#ffb74d' : '#f97316')}
          </View>
        </View>

        {/* Large Minimalist Temperature */}
        <View style={styles.tempBlock}>
          <Text style={[styles.largeTemp, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
            {formatTemp(weather.current.temperature, temperatureUnit)}
          </Text>
          <Text style={[styles.apparentLabel, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
            Sensação de {formatTemp(weather.current.apparentTemperature, temperatureUnit)}
          </Text>
        </View>

        {/* 4 Metrics with Soft Pastel Icons */}
        <View style={styles.metricsGrid}>
          {/* Humidity (Pastel Blue) */}
          <View style={[styles.metricCard, isDark ? styles.metricCardDark : styles.metricCardLight]}>
            <View style={[styles.metricIconCircle, isDark ? styles.iconBlueDark : styles.iconBlueLight]}>
              <Droplets size={16} color={isDark ? '#64b5f6' : '#0071e3'} />
            </View>
            <View>
              <Text style={styles.metricLabel}>Umidade</Text>
              <Text style={[styles.metricVal, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                {weather.current.humidity}%
              </Text>
            </View>
          </View>

          {/* Wind (Pastel Purple) */}
          <View style={[styles.metricCard, isDark ? styles.metricCardDark : styles.metricCardLight]}>
            <View style={[styles.metricIconCircle, isDark ? styles.iconPurpleDark : styles.iconPurpleLight]}>
              <Wind size={16} color={isDark ? '#ba68c8' : '#8b5cf6'} />
            </View>
            <View>
              <Text style={styles.metricLabel}>Vento</Text>
              <Text style={[styles.metricVal, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                {weather.current.windSpeed} km/h
              </Text>
            </View>
          </View>

          {/* Pressure (Pastel Mint) */}
          <View style={[styles.metricCard, isDark ? styles.metricCardDark : styles.metricCardLight]}>
            <View style={[styles.metricIconCircle, isDark ? styles.iconMintDark : styles.iconMintLight]}>
              <Gauge size={16} color={isDark ? '#81c784' : '#10b981'} />
            </View>
            <View>
              <Text style={styles.metricLabel}>Pressão</Text>
              <Text style={[styles.metricVal, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                {weather.current.surfacePressure} hPa
              </Text>
            </View>
          </View>

          {/* Precipitation (Pastel Peach) */}
          <View style={[styles.metricCard, isDark ? styles.metricCardDark : styles.metricCardLight]}>
            <View style={[styles.metricIconCircle, isDark ? styles.iconPeachDark : styles.iconPeachLight]}>
              <Sunrise size={16} color={isDark ? '#ffb74d' : '#f97316'} />
            </View>
            <View>
              <Text style={styles.metricLabel}>Chuva</Text>
              <Text style={[styles.metricVal, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                {weather.current.precipitation} mm
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 24h Hourly Forecast */}
      <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
        <View style={styles.cardHeader}>
          <Clock size={16} color={isDark ? '#64b5f6' : '#0071e3'} />
          <Text style={[styles.cardTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
            Previsão Horária (24h)
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hourlyScroll}
        >
          {weather.hourly.times.map((time, idx) => {
            const temp = weather.hourly.temperatures[idx];
            const prob = weather.hourly.precipitationProbabilities[idx];
            const code = weather.hourly.weatherCodes[idx];
            const meta = ApiService.getWeatherMeta(code);

            return (
              <View
                key={`${time}-${idx}`}
                style={[
                  styles.hourlyPill,
                  isDark ? styles.hourlyPillDark : styles.hourlyPillLight,
                ]}
              >
                <Text style={[styles.hourText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                  {formatHour(time)}
                </Text>
                <View style={styles.hourIconWrap}>
                  {getWeatherIcon(meta.icon, 20, isDark ? '#ffb74d' : '#f97316')}
                </View>
                <Text style={[styles.hourTemp, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                  {formatTemp(temp, temperatureUnit)}
                </Text>
                {prob > 0 ? (
                  <Text style={styles.rainChanceText}>{prob}%</Text>
                ) : (
                  <View style={{ height: 14 }} />
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* 7-Day Forecast (Apple Weather Style List) */}
      <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
        <View style={styles.cardHeader}>
          <Calendar size={16} color={isDark ? '#81c784' : '#10b981'} />
          <Text style={[styles.cardTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
            Previsão para 7 Dias
          </Text>
        </View>

        <View style={styles.dailyTable}>
          {weather.daily.map((day, idx) => {
            const meta = ApiService.getWeatherMeta(day.weatherCode);
            return (
              <View
                key={day.date}
                style={[
                  styles.dailyRow,
                  idx !== weather.daily.length - 1 && (isDark ? styles.rowBorderDark : styles.rowBorderLight),
                ]}
              >
                {/* Day Name */}
                <Text style={[styles.dayName, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                  {formatDayName(day.date, idx)}
                </Text>

                {/* Weather Icon */}
                <View style={styles.dayIconCol}>
                  {getWeatherIcon(meta.icon, 18, isDark ? '#ffb74d' : '#f97316')}
                </View>

                {/* Min Temp */}
                <Text style={[styles.tempMinText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                  {formatTemp(day.tempMin, temperatureUnit)}
                </Text>

                {/* Soft Gradient Temp Bar */}
                <View style={[styles.tempBarTrack, isDark ? styles.tempBarTrackDark : styles.tempBarTrackLight]}>
                  <View style={styles.tempBarFill} />
                </View>

                {/* Max Temp */}
                <Text style={[styles.tempMaxText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                  {formatTemp(day.tempMax, temperatureUnit)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 16,
  },
  card: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 20,
    elevation: 3,
  },
  cardLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  cardDark: {
    backgroundColor: '#1c1c1e',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  currentTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  conditionRow: {
    marginTop: 4,
  },
  conditionText: {
    fontSize: 20,
    fontWeight: '600',
  },
  pastelIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tempBlock: {
    marginVertical: 18,
  },
  largeTemp: {
    fontSize: 64,
    fontWeight: '300',
    letterSpacing: -2,
    lineHeight: 68,
    fontVariant: ['tabular-nums'],
  },
  apparentLabel: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: '400',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  metricCard: {
    flex: 1,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  metricCardLight: {
    backgroundColor: '#f5f5f7',
  },
  metricCardDark: {
    backgroundColor: '#2c2c2e',
  },
  metricIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBlueLight: { backgroundColor: '#eef5ff' },
  iconBlueDark: { backgroundColor: 'rgba(10, 132, 255, 0.15)' },
  iconPurpleLight: { backgroundColor: '#f5f3ff' },
  iconPurpleDark: { backgroundColor: 'rgba(191, 90, 242, 0.15)' },
  iconMintLight: { backgroundColor: '#eef9f2' },
  iconMintDark: { backgroundColor: 'rgba(48, 209, 88, 0.15)' },
  iconPeachLight: { backgroundColor: '#fff7ed' },
  iconPeachDark: { backgroundColor: 'rgba(255, 159, 10, 0.15)' },
  metricLabel: {
    fontSize: 11,
    color: '#86868b',
    fontWeight: '500',
  },
  metricVal: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  hourlyScroll: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  hourlyPill: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 18,
    width: 64,
  },
  hourlyPillLight: {
    backgroundColor: '#f5f5f7',
  },
  hourlyPillDark: {
    backgroundColor: '#2c2c2e',
  },
  hourText: {
    fontSize: 12,
    fontWeight: '500',
  },
  hourIconWrap: {
    marginVertical: 8,
  },
  hourTemp: {
    fontSize: 14,
    fontWeight: '600',
  },
  rainChanceText: {
    fontSize: 10,
    color: '#0071e3',
    fontWeight: '600',
    marginTop: 4,
  },
  dailyTable: {
    width: '100%',
  },
  dailyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
  },
  rowBorderLight: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.04)',
  },
  rowBorderDark: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  dayName: {
    width: 60,
    fontSize: 13,
    fontWeight: '600',
  },
  dayIconCol: {
    width: 28,
    alignItems: 'center',
  },
  tempMinText: {
    width: 36,
    textAlign: 'right',
    fontSize: 13,
  },
  tempBarTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  tempBarTrackLight: {
    backgroundColor: '#f0f0f2',
  },
  tempBarTrackDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  tempBarFill: {
    width: '75%',
    height: '100%',
    backgroundColor: '#f97316',
    borderRadius: 3,
  },
  tempMaxText: {
    width: 36,
    textAlign: 'left',
    fontSize: 13,
    fontWeight: '600',
  },
  textPrimaryLight: {
    color: '#1d1d1f',
  },
  textPrimaryDark: {
    color: '#f5f5f7',
  },
  textSecondaryLight: {
    color: '#6e6e73',
  },
  textSecondaryDark: {
    color: '#a1a1a6',
  },
});

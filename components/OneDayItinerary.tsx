import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { Compass, ExternalLink, MapPin, Sparkles, AlertCircle } from 'lucide-react';
import { City, WeatherData, AIItinerary, AIItineraryStop } from '../types';
import { ApiService } from '../services/api';

interface OneDayItineraryProps {
  city: City;
  weather?: WeatherData | null;
  theme: 'dark' | 'light';
}

const SHIFT_THEME_COLORS = ['#ca8a04', '#10b981', '#f97316', '#8b5cf6'];

export const OneDayItinerary: React.FC<OneDayItineraryProps> = ({ city, weather, theme }) => {
  const isDark = theme === 'dark';

  const [itinerary, setItinerary] = useState<AIItinerary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadQuickItinerary() {
      setIsLoading(true);
      setError(null);

      const conditionLabel = weather?.current
        ? ApiService.getWeatherMeta(weather.current.weatherCode).label
        : undefined;

      const cacheKey = `terradata_quick_${city.name}_${weather?.current ? Math.round(weather.current.temperature) : 'std'}`;

      // 1. Check local storage cache
      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached) as AIItinerary;
            if (parsed && Array.isArray(parsed.days) && parsed.days.length > 0) {
              setItinerary(parsed);
              setIsLoading(false);
              return;
            }
          }
        } catch {
          // Ignore cache read errors
        }
      }

      // 2. Fetch from backend AI service
      try {
        const res = await fetch('/api/itinerary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'quick',
            cityName: city.name,
            admin1: city.admin1,
            country: city.country,
            weather: weather?.current
              ? {
                  temperature: Math.round(weather.current.temperature),
                  apparentTemperature: Math.round(weather.current.apparentTemperature),
                  condition: conditionLabel,
                }
              : null,
          }),
        });

        if (isCancelled) return;

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          const msg = typeof data.error === 'string' ? data.error : 'Não foi possível gerar o roteiro.';
          setError(msg);
          return;
        }

        const data = (await res.json()) as AIItinerary;
        if (!isCancelled && data && Array.isArray(data.days) && data.days.length > 0) {
          setItinerary(data);
          // Persist in local cache
          try {
            if (typeof window !== 'undefined') {
              localStorage.setItem(cacheKey, JSON.stringify(data));
            }
          } catch {
            // Ignore quota errors
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setError('Serviço temporariamente indisponível.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadQuickItinerary();

    return () => {
      isCancelled = true;
    };
  }, [city.name, city.admin1, city.country, weather?.current?.weatherCode, weather?.current?.temperature]);

  const stops: AIItineraryStop[] = itinerary?.days?.[0]?.stops || [];

  // Route URL generator for Google Maps
  const handleOpenGoogleMapsRoute = () => {
    if (stops.length === 0) return;
    const origin = `${encodeURIComponent(stops[0].title + ' ' + city.name)}`;
    const destination = `${encodeURIComponent(stops[stops.length - 1].title + ' ' + city.name)}`;
    const waypoints = stops
      .slice(1, -1)
      .map((s) => encodeURIComponent(s.title + ' ' + city.name))
      .join('|');

    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
    Linking.openURL(url);
  };

  // Route URL generator for Apple Maps
  const handleOpenAppleMapsRoute = () => {
    if (stops.length === 0) return;
    const dest = stops[0];
    const url = `https://maps.apple.com/?q=${encodeURIComponent(dest.title + ' ' + city.name)}`;
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Compass size={16} color={isDark ? '#64b5f6' : '#0071e3'} />
            <Text style={[styles.cardTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              Roteiro Rápido: Um Dia em {city.name}
            </Text>
            <View style={styles.aiTag}>
              <Sparkles size={10} color="#0071e3" />
              <Text style={styles.aiTagText}>IA</Text>
            </View>
          </View>

          {/* Action buttons */}
          {stops.length > 0 && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.routeBtn, styles.googleBtn]}
                onPress={handleOpenGoogleMapsRoute}
                activeOpacity={0.7}
              >
                <Text style={styles.routeBtnText}>Traçar Rota</Text>
                <ExternalLink size={12} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.routeBtn, isDark ? styles.appleBtnDark : styles.appleBtnLight]}
                onPress={handleOpenAppleMapsRoute}
                activeOpacity={0.7}
              >
                <Text style={[styles.appleBtnText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                  Apple Maps
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Subtitle with Weather context */}
        {itinerary?.weatherContext && (
          <Text style={[styles.weatherSubtitle, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
            Planejado considerando: {itinerary.weatherContext}.
          </Text>
        )}

        {/* Loading state */}
        {isLoading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#0071e3" />
            <Text style={[styles.loadingText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              A IA está organizando os melhores locais para o clima de hoje...
            </Text>
          </View>
        )}

        {/* Error state */}
        {!isLoading && error && stops.length === 0 && (
          <View style={[styles.errorBox, isDark ? styles.errorBoxDark : styles.errorBoxLight]}>
            <AlertCircle size={14} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* 4 Timeline Shifts */}
        {!isLoading && stops.length > 0 && (
          <View style={styles.timelineList}>
            {stops.map((stop, idx) => {
              const themeColor = stop.themeColor || SHIFT_THEME_COLORS[idx % SHIFT_THEME_COLORS.length];
              const mapsUrl =
                stop.mapsUrl ||
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.title + ' ' + city.name)}`;

              return (
                <View key={idx} style={styles.timelineItem}>
                  {/* Hour & Node */}
                  <View style={styles.nodeCol}>
                    <View style={[styles.shiftBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f2' }]}>
                      <Text style={[styles.hourText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                        {stop.time}
                      </Text>
                    </View>
                    {idx < stops.length - 1 && (
                      <View style={[styles.connectorLine, isDark ? styles.lineDark : styles.lineLight]} />
                    )}
                  </View>

                  {/* Stop Card */}
                  <View style={[styles.stopCard, isDark ? styles.stopCardDark : styles.stopCardLight]}>
                    <View style={styles.stopContent}>
                      <View style={styles.stopHeader}>
                        <View style={styles.shiftTag}>
                          <Text style={[styles.shiftLabel, { color: themeColor }]}>
                            {stop.shift || `Parada ${idx + 1}`}
                          </Text>
                        </View>
                        {stop.tip && (
                          <Text style={[styles.tipTag, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                            {stop.tip}
                          </Text>
                        )}
                      </View>

                      <Text
                        style={[styles.poiTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}
                        numberOfLines={1}
                      >
                        {stop.title}
                      </Text>

                      <Text
                        style={[styles.poiExtract, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}
                        numberOfLines={2}
                      >
                        {stop.description}
                      </Text>

                      <View style={styles.footerRow}>
                        <View style={styles.categoryPill}>
                          <MapPin size={10} color="#86868b" />
                          <Text style={styles.categoryText}>{stop.category}</Text>
                        </View>

                        <TouchableOpacity
                          onPress={() => Linking.openURL(mapsUrl)}
                          activeOpacity={0.65}
                        >
                          <Text style={styles.detailsLink}>Ver no mapa →</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  card: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
  },
  cardLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  cardDark: {
    backgroundColor: '#1c1c1e',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 12,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0, 113, 227, 0.08)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  aiTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0071e3',
  },
  weatherSubtitle: {
    fontSize: 12,
    marginBottom: 16,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  routeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  googleBtn: {
    backgroundColor: '#0071e3',
  },
  routeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  appleBtnLight: {
    backgroundColor: '#f0f0f2',
  },
  appleBtnDark: {
    backgroundColor: '#2c2c2e',
  },
  appleBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 13,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginVertical: 12,
  },
  errorBoxLight: {
    backgroundColor: '#fff5f5',
  },
  errorBoxDark: {
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
  },
  timelineList: {
    gap: 14,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  nodeCol: {
    alignItems: 'center',
    width: 60,
  },
  shiftBadge: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  hourText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  connectorLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
  },
  lineLight: {
    backgroundColor: '#e5e5ea',
  },
  lineDark: {
    backgroundColor: '#2c2c2e',
  },
  stopCard: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 12,
    alignItems: 'center',
  },
  stopCardLight: {
    backgroundColor: '#fafafc',
    borderColor: 'rgba(0,0,0,0.03)',
  },
  stopCardDark: {
    backgroundColor: '#262629',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  stopContent: {
    flex: 1,
    gap: 4,
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  shiftTag: {},
  shiftLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tipTag: {
    fontSize: 10,
    fontStyle: 'italic',
  },
  poiTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  poiExtract: {
    fontSize: 12,
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryText: {
    fontSize: 10,
    color: '#86868b',
  },
  detailsLink: {
    fontSize: 11,
    color: '#0071e3',
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

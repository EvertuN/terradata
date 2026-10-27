import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Linking } from 'react-native';
import { Compass, ExternalLink, MapPin } from 'lucide-react';
import { City, PointOfInterest } from '../types';

interface OneDayItineraryProps {
  city: City;
  pois: PointOfInterest[];
  theme: 'dark' | 'light';
}

interface ItineraryStop {
  shift: string;
  hour: string;
  themeColor: string;
  poi: PointOfInterest;
}

export const OneDayItinerary: React.FC<OneDayItineraryProps> = ({ city, pois, theme }) => {
  const isDark = theme === 'dark';

  // Distribute POIs across 4 shifts
  const stops = useMemo<ItineraryStop[]>(() => {
    const list = [...pois];

    const getOrFallback = (index: number, fallbackTitle: string, fallbackCat: string): PointOfInterest => {
      if (list[index]) return list[index];
      return {
        pageId: 99000 + index,
        title: fallbackTitle,
        lat: city.latitude + (index * 0.006),
        lon: city.longitude + (index * 0.006),
        dist: 1200 * (index + 1),
        distFormatted: `${(1.2 * (index + 1)).toFixed(1)} km`,
        thumbnail: null,
        extract: `Ponto imperdível e representativo de ${city.name} para vivenciar o melhor da cidade.`,
        url: `https://www.google.com/search?q=${encodeURIComponent(fallbackTitle)}`,
        rating: 4.8,
        reviewsCount: '2.5k avaliações',
        category: fallbackCat,
      };
    };

    return [
      {
        shift: 'Manhã Cultural & Café',
        hour: '09h00',
        themeColor: '#ca8a04',
        poi: getOrFallback(0, `Centro Histórico & Praça Matriz de ${city.name}`, 'Centro Histórico'),
      },
      {
        shift: 'Tarde no Parque & Natureza',
        hour: '14h00',
        themeColor: '#10b981',
        poi: getOrFallback(1, `Parque Ecológico Municipal de ${city.name}`, 'Parque & Ecoturismo'),
      },
      {
        shift: 'Pôr do Sol Panorâmico',
        hour: '17h30',
        themeColor: '#f97316',
        poi: getOrFallback(2, `Mirante Panorâmico de ${city.name}`, 'Mirante & Paisagem'),
      },
      {
        shift: 'Noite Gastronômica & Arte',
        hour: '20h00',
        themeColor: '#8b5cf6',
        poi: getOrFallback(3, `Teatro Municipal & Polo Cultural de ${city.name}`, 'Arte & Gastronomia'),
      },
    ];
  }, [pois, city]);

  // Route URL generator for Google Maps
  const handleOpenGoogleMapsRoute = () => {
    const origin = `${city.latitude},${city.longitude}`;
    const waypoints = stops
      .slice(0, 3)
      .map((s) => `${s.poi.lat},${s.poi.lon}`)
      .join('|');
    const destination = `${stops[3]?.poi.lat || city.latitude},${stops[3]?.poi.lon || city.longitude}`;

    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;
    Linking.openURL(url);
  };

  // Route URL generator for Apple Maps
  const handleOpenAppleMapsRoute = () => {
    const dest = stops[0]?.poi;
    const url = `https://maps.apple.com/?saddr=${city.latitude},${city.longitude}&daddr=${dest.lat},${dest.lon}&q=${encodeURIComponent(dest.title)}`;
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
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.routeBtn, styles.googleBtn]}
              onPress={handleOpenGoogleMapsRoute}
              activeOpacity={0.7}
            >
              <Text style={styles.routeBtnText}>Abrir no Google Maps</Text>
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
        </View>

        {/* 4 Timeline Shifts */}
        <View style={styles.timelineList}>
          {stops.map((stop, idx) => (
            <View key={idx} style={styles.timelineItem}>
              {/* Hour & Node */}
              <View style={styles.nodeCol}>
                <View style={[styles.shiftBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f2' }]}>
                  <Text style={[styles.hourText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                    {stop.hour}
                  </Text>
                </View>
                {idx < stops.length - 1 && <View style={[styles.connectorLine, isDark ? styles.lineDark : styles.lineLight]} />}
              </View>

              {/* Stop Card */}
              <View style={[styles.stopCard, isDark ? styles.stopCardDark : styles.stopCardLight]}>
                <View style={styles.stopContent}>
                  <View style={styles.stopHeader}>
                    <View style={styles.shiftTag}>
                      <Text style={[styles.shiftLabel, { color: stop.themeColor }]}>
                        {stop.shift}
                      </Text>
                    </View>
                    <Text style={[styles.distTag, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                      {stop.poi.distFormatted}
                    </Text>
                  </View>

                  <Text
                    style={[styles.poiTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}
                    numberOfLines={1}
                  >
                    {stop.poi.title}
                  </Text>

                  <Text
                    style={[styles.poiExtract, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}
                    numberOfLines={2}
                  >
                    {stop.poi.extract}
                  </Text>

                  <View style={styles.footerRow}>
                    <View style={styles.categoryPill}>
                      <MapPin size={10} color="#86868b" />
                      <Text style={styles.categoryText}>{stop.poi.category || 'Atração'}</Text>
                    </View>

                    {stop.poi.url && (
                      <TouchableOpacity
                        onPress={() => Linking.openURL(stop.poi.url)}
                        activeOpacity={0.65}
                      >
                        <Text style={styles.detailsLink}>Detalhes →</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {stop.poi.thumbnail ? (
                  <Image source={{ uri: stop.poi.thumbnail }} style={styles.stopPhoto} resizeMode="cover" />
                ) : null}
              </View>
            </View>
          ))}
        </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
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
  },
  shiftTag: {},
  shiftLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  distTag: {
    fontSize: 11,
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
  stopPhoto: {
    width: 80,
    height: 74,
    borderRadius: 12,
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

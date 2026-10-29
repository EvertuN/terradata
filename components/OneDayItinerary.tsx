import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Compass, ExternalLink, MapPin } from 'lucide-react';
import { City, PointOfInterest } from '../types';
import { LazyImage } from './LazyImage';

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
  mapsUrl: string;
}

export const OneDayItinerary: React.FC<OneDayItineraryProps> = ({ city, pois, theme }) => {
  const isDark = theme === 'dark';

  // Smart Keyword Matching Algorithm
  const stops = useMemo<ItineraryStop[]>(() => {
    const list = [...pois];
    const usedIds = new Set<string | number>();

    const FOOD_KEYWORDS = [
      'café', 'cafe', 'cafeteria', 'padaria', 'confeitaria', 'bistrô', 'bistro',
      'mercado municipal', 'lanche', 'gastronomia', 'quitanda', 'doceria', 'brunch'
    ];

    const NATURE_KEYWORDS = [
      'parque', 'jardim', 'botânico', 'ecol', 'natureza', 'bosque', 'horto',
      'cachoeira', 'cascata', 'lago', 'lagoa', 'represa', 'floresta', 'reserva',
      'trilha', 'rio', 'zoológico', 'zoologico'
    ];

    const SUNSET_KEYWORDS = [
      'mirante', 'morro', 'serra', 'montanha', 'pico', 'vista', 'panorâm', 'panoram',
      'orla', 'praia', 'deck', 'farol', 'ponte', 'elevado', 'mirador', 'cruzeiro'
    ];

    const NIGHT_KEYWORDS = [
      'teatro', 'centro cultural', 'cinema', 'restaurante', 'gastronomia', 'bar',
      'choperia', 'boulevard', 'calçadão', 'calcadao', 'noturno', 'noite', 'avenida',
      'polo gastronômico', 'casa de show', 'show'
    ];

    const CULTURE_KEYWORDS = [
      'museu', 'memorial', 'catedral', 'igreja', 'santuário', 'santuario', 'basílica',
      'basilica', 'capela', 'palácio', 'palacio', 'solar', 'histórico', 'historico',
      'patrimônio', 'patrimonio', 'estação', 'estacao', 'monumento', 'praça'
    ];

    const scorePoi = (p: PointOfInterest, keywords: string[]): number => {
      const text = `${p.title} ${p.category || ''} ${p.extract || ''}`.toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (text.includes(kw)) {
          score += kw.length > 5 ? 3 : 2;
        }
      }
      return score;
    };

    const findBestPoi = (keywords: string[]): PointOfInterest | null => {
      let best: PointOfInterest | null = null;
      let highest = 0;
      for (const p of list) {
        if (usedIds.has(p.pageId)) continue;
        const s = scorePoi(p, keywords);
        if (s > highest) {
          highest = s;
          best = p;
        }
      }
      if (best) {
        usedIds.add(best.pageId);
      }
      return best;
    };

    const getRemainingOrFallback = (
      fallbackTitle: string,
      fallbackCat: string,
      fallbackDesc: string,
      index: number
    ): PointOfInterest => {
      const unused = list.find((p) => !usedIds.has(p.pageId));
      if (unused) {
        usedIds.add(unused.pageId);
        return unused;
      }
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackTitle + ' ' + city.name)}`;
      return {
        pageId: 99000 + index,
        title: fallbackTitle,
        lat: city.latitude + (index * 0.005),
        lon: city.longitude + (index * 0.005),
        dist: 1000 * (index + 1),
        distFormatted: `${(1.0 * (index + 1)).toFixed(1)} km`,
        thumbnail: null,
        extract: fallbackDesc,
        url: mapsUrl,
        mapsUrl,
        rating: 4.8,
        reviewsCount: '2.5k avaliações',
        category: fallbackCat,
      };
    };

    // 1. TURNO MANHÃ (09h00)
    let morningPoi = findBestPoi(FOOD_KEYWORDS);
    let morningShiftTitle = 'Café da Manhã & Sabores Locais';

    if (!morningPoi) {
      morningPoi = findBestPoi(CULTURE_KEYWORDS);
      if (morningPoi) {
        morningShiftTitle = 'Manhã Histórica & Cultural';
      } else {
        morningPoi = getRemainingOrFallback(
          `Centro Histórico & Praça Matriz de ${city.name}`,
          'Centro Histórico',
          `Caminhada pelas ruas históricas e praça central de ${city.name}, com arquitetura típica e atmosfera acolhedora.`,
          0
        );
        morningShiftTitle = 'Manhã Histórica & Cultural';
      }
    }

    // 2. TURNO TARDE (14h00)
    let afternoonPoi = findBestPoi(NATURE_KEYWORDS);
    let afternoonShiftTitle = 'Tarde no Parque & Natureza';

    if (!afternoonPoi) {
      afternoonPoi = findBestPoi(CULTURE_KEYWORDS);
      if (afternoonPoi) {
        afternoonShiftTitle = 'Tarde Cultural & Museu';
      } else {
        afternoonPoi = getRemainingOrFallback(
          `Parque Ecológico Municipal de ${city.name}`,
          'Parque & Ecoturismo',
          `Ampla área verde para caminhadas sob a sombra das árvores, contemplação e contato direto com a natureza.`,
          1
        );
      }
    }

    // 3. TURNO PÔR DO SOL (17h30)
    let sunsetPoi = findBestPoi(SUNSET_KEYWORDS);
    let sunsetShiftTitle = 'Pôr do Sol Panorâmico';

    if (!sunsetPoi) {
      sunsetPoi = getRemainingOrFallback(
        `Mirante Panorâmico de ${city.name}`,
        'Mirante & Paisagem',
        `Ponto mais alto com vista privilegiada para contemplar a despedida do sol e as cores do horizonte.`,
        2
      );
    }

    // 4. TURNO NOITE (20h00)
    let nightPoi = findBestPoi(NIGHT_KEYWORDS);
    let nightShiftTitle = 'Noite Gastronômica & Arte';

    if (nightPoi) {
      const isTheater = nightPoi.title.toLowerCase().includes('teatro');
      nightShiftTitle = isTheater ? 'Noite Cultural & Teatro' : 'Noite Gastronômica & Sabores';
    } else {
      nightPoi = getRemainingOrFallback(
        `Polo Gastronômico & Noite de ${city.name}`,
        'Gastronomia & Convivência',
        `A melhor gastronomia regional e ambiente acolhedor para encerrar o dia em ${city.name}.`,
        3
      );
    }

    const buildMapsUrl = (p: PointOfInterest) =>
      p.mapsUrl ||
      p.url ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.title + ' ' + city.name)}`;

    return [
      {
        shift: morningShiftTitle,
        hour: '09h00',
        themeColor: '#ca8a04',
        poi: morningPoi,
        mapsUrl: buildMapsUrl(morningPoi),
      },
      {
        shift: afternoonShiftTitle,
        hour: '14h00',
        themeColor: '#10b981',
        poi: afternoonPoi,
        mapsUrl: buildMapsUrl(afternoonPoi),
      },
      {
        shift: sunsetShiftTitle,
        hour: '17h30',
        themeColor: '#f97316',
        poi: sunsetPoi,
        mapsUrl: buildMapsUrl(sunsetPoi),
      },
      {
        shift: nightShiftTitle,
        hour: '20h00',
        themeColor: '#8b5cf6',
        poi: nightPoi,
        mapsUrl: buildMapsUrl(nightPoi),
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
              <Text style={styles.routeBtnText}>Traçar Rota Completa</Text>
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

              {/* Stop Card: Clean & Adaptive */}
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

                    <TouchableOpacity
                      onPress={() => Linking.openURL(stop.mapsUrl)}
                      activeOpacity={0.65}
                    >
                      <Text style={styles.detailsLink}>Ver no mapa →</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Real photo: rendered ONLY if available, otherwise card adapts compactly */}
                {stop.poi.thumbnail ? (
                  <LazyImage src={stop.poi.thumbnail} alt={stop.poi.title} style={styles.stopPhoto} />
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

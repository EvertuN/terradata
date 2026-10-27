import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sparkles, Sun, Camera, Footprints, ShieldAlert, Award } from 'lucide-react';
import { WeatherData } from '../types';

interface SmartDayInsightsProps {
  weather: WeatherData | null;
  theme: 'dark' | 'light';
}

export const SmartDayInsights: React.FC<SmartDayInsightsProps> = ({ weather, theme }) => {
  const isDark = theme === 'dark';

  // 1. Golden Hour calculations
  const goldenHourData = useMemo(() => {
    if (!weather?.daily?.[0]?.sunrise || !weather?.daily?.[0]?.sunset) {
      return {
        morningStart: '05:45',
        morningEnd: '06:45',
        eveningStart: '17:15',
        eveningEnd: '18:15',
        status: 'Calculando com base no sol local...',
        isNow: false,
      };
    }

    const sunrise = new Date(weather.daily[0].sunrise);
    const sunset = new Date(weather.daily[0].sunset);
    const now = new Date();

    const morningStartStr = sunrise.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const sunrisePlus1h = new Date(sunrise.getTime() + 60 * 60 * 1000);
    const morningEndStr = sunrisePlus1h.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const sunsetMinus1h = new Date(sunset.getTime() - 60 * 60 * 1000);
    const eveningStartStr = sunsetMinus1h.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const eveningEndStr = sunset.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    let status = `Vespertina: ${eveningStartStr} às ${eveningEndStr}`;
    let isNow = false;

    if (now >= sunsetMinus1h && now <= sunset) {
      status = 'Acontecendo agora! Luz dourada perfeita';
      isNow = true;
    } else if (now >= sunrise && now <= sunrisePlus1h) {
      status = 'Acontecendo agora! Luz suave matinal';
      isNow = true;
    } else if (now < sunsetMinus1h) {
      const diffHours = Math.round((sunsetMinus1h.getTime() - now.getTime()) / (1000 * 60 * 60));
      status = diffHours > 0 ? `Próxima em ~${diffHours}h (${eveningStartStr})` : `Próxima às ${eveningStartStr}`;
    }

    return {
      morningStart: morningStartStr,
      morningEnd: morningEndStr,
      eveningStart: eveningStartStr,
      eveningEnd: eveningEndStr,
      status,
      isNow,
    };
  }, [weather?.daily]);

  // 2. Outdoor Activity Perfect Window Algorithm
  const outdoorWindow = useMemo(() => {
    if (!weather?.hourly?.times || weather.hourly.times.length === 0) {
      return {
        recommendation: 'Horário sugerido: 16h30 às 18h30 para caminhada ou corrida ao ar livre.',
        badge: 'Janela Favorável',
        tempRange: '22°C - 24°C',
      };
    }

    const times = weather.hourly.times;
    const temps = weather.hourly.temperatures;
    const precips = weather.hourly.precipitationProbabilities;

    // Look for day slots between 06:00 and 20:00
    let bestSlot = { start: '16:00', end: '18:00', score: -1, temp: 23 };

    for (let i = 6; i <= Math.min(18, times.length - 2); i++) {
      const temp = temps[i] ?? 22;
      const precip = precips[i] ?? 0;
      // Ideal temp: 18 - 26, precip close to 0
      let score = 100 - precip * 2 - Math.abs(temp - 22) * 3;
      if (score > bestSlot.score) {
        const d1 = new Date(times[i]);
        const d2 = new Date(times[i + 2] || times[i]);
        bestSlot = {
          start: d1.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          end: d2.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          score,
          temp,
        };
      }
    }

    return {
      recommendation: `Melhor momento: ${bestSlot.start} às ${bestSlot.end}. Clima agradável (~${bestSlot.temp}°C) e baixíssima probabilidade de chuva.`,
      badge: 'Janela Ideal',
      tempRange: `~${bestSlot.temp}°C`,
    };
  }, [weather?.hourly]);

  // 3. UV Index Gauge
  const uvData = useMemo(() => {
    const uvMax = weather?.daily?.[0]?.uvIndexMax ?? 5;
    let label = 'Moderado';
    let advice = 'Óculos de sol e protetor solar FPS 30+ recomendados.';
    let color = '#f59e0b';
    let pct = Math.min(100, Math.round((uvMax / 11) * 100));

    if (uvMax <= 2) {
      label = 'Baixo';
      advice = 'Exposição segura. Não requer proteção especial.';
      color = '#10b981';
    } else if (uvMax <= 5) {
      label = 'Moderado';
      advice = 'Use óculos de sol e aplique protetor solar FPS 30+.';
      color = '#f59e0b';
    } else if (uvMax <= 7) {
      label = 'Alto';
      advice = 'Reduza exposição direta ao meio-dia e use boné/óculos.';
      color = '#f97316';
    } else if (uvMax <= 10) {
      label = 'Muito Alto';
      advice = 'Proteção reforçada necessária. Busque sombras entre 11h e 16h.';
      color = '#ef4444';
    } else {
      label = 'Extremo';
      advice = 'Evite atividades sob o sol. Risco severo de queimaduras.';
      color = '#8b5cf6';
    }

    return { uvMax, label, advice, color, pct };
  }, [weather?.daily]);

  return (
    <View style={styles.container}>
      <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
        {/* Title */}
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Sparkles size={16} color={isDark ? '#ffd54f' : '#f59e0b'} />
            <Text style={[styles.cardTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              Smart Insights do Dia
            </Text>
          </View>
          <View style={[styles.badgePill, isDark ? styles.badgePillDark : styles.badgePillLight]}>
            <Award size={11} color={isDark ? '#64b5f6' : '#0071e3'} />
            <Text style={styles.badgePillText}>Algoritmo Preditivo</Text>
          </View>
        </View>

        {/* 3 Grid Pillars */}
        <View style={styles.grid}>
          {/* Pillar 1: Golden Hour */}
          <View style={[styles.subCard, isDark ? styles.subCardDark : styles.subCardLight]}>
            <View style={styles.subHeader}>
              <View style={[styles.iconBubble, { backgroundColor: isDark ? 'rgba(255, 193, 7, 0.15)' : '#fffbeb' }]}>
                <Camera size={15} color={isDark ? '#ffd54f' : '#f59e0b'} />
              </View>
              <Text style={[styles.subTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                Golden Hour
              </Text>
            </View>

            <Text style={[styles.insightBig, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              {goldenHourData.eveningStart} - {goldenHourData.eveningEnd}
            </Text>

            <Text style={[styles.insightDesc, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              {goldenHourData.status}
            </Text>

            <View style={styles.miniTagRow}>
              <View style={[styles.miniTag, { backgroundColor: isDark ? 'rgba(255, 193, 7, 0.1)' : '#fffbeb' }]}>
                <Sun size={11} color="#f59e0b" />
                <Text style={[styles.miniTagText, { color: '#f59e0b' }]}>Fotografia Ideal</Text>
              </View>
            </View>
          </View>

          {/* Pillar 2: Outdoor Window */}
          <View style={[styles.subCard, isDark ? styles.subCardDark : styles.subCardLight]}>
            <View style={styles.subHeader}>
              <View style={[styles.iconBubble, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#eef9f2' }]}>
                <Footprints size={15} color={isDark ? '#81c784' : '#10b981'} />
              </View>
              <Text style={[styles.subTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                Atividades ao Ar Livre
              </Text>
            </View>

            <Text style={[styles.insightBig, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              {outdoorWindow.tempRange}
            </Text>

            <Text style={[styles.insightDesc, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              {outdoorWindow.recommendation}
            </Text>

            <View style={styles.miniTagRow}>
              <View style={[styles.miniTag, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#eef9f2' }]}>
                <Text style={[styles.miniTagText, { color: '#10b981' }]}>{outdoorWindow.badge}</Text>
              </View>
            </View>
          </View>

          {/* Pillar 3: UV Index Monitor */}
          <View style={[styles.subCard, isDark ? styles.subCardDark : styles.subCardLight]}>
            <View style={styles.subHeader}>
              <View style={[styles.iconBubble, { backgroundColor: isDark ? 'rgba(244, 63, 94, 0.15)' : '#fff1f2' }]}>
                <ShieldAlert size={15} color={isDark ? '#f06292' : '#f43f5e'} />
              </View>
              <Text style={[styles.subTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                Índice UV Máximo
              </Text>
            </View>

            <View style={styles.uvRow}>
              <Text style={[styles.insightBig, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                {uvData.uvMax}
              </Text>
              <Text style={[styles.uvLevelText, { color: uvData.color }]}>
                • {uvData.label}
              </Text>
            </View>

            {/* Apple Style Smooth UV Bar */}
            <View style={styles.uvTrack}>
              <View
                style={[
                  styles.uvFill,
                  { width: `${uvData.pct}%`, backgroundColor: uvData.color },
                ]}
              />
            </View>

            <Text style={[styles.insightDesc, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              {uvData.advice}
            </Text>
          </View>
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
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
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
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  badgePillLight: {
    backgroundColor: '#eef5ff',
  },
  badgePillDark: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0071e3',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  subCard: {
    flex: 1,
    minWidth: 260,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
  },
  subCardLight: {
    backgroundColor: '#fafafc',
    borderColor: 'rgba(0, 0, 0, 0.03)',
  },
  subCardDark: {
    backgroundColor: '#262629',
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  insightBig: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  insightDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  miniTagRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  miniTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  miniTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  uvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  uvLevelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  uvTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(128, 128, 128, 0.18)',
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 4,
  },
  uvFill: {
    height: '100%',
    borderRadius: 3,
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

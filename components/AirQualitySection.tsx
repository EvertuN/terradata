import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Wind, ShieldCheck, AlertCircle } from 'lucide-react';
import { AirQualityData } from '../types';

interface AirQualitySectionProps {
  airQuality: AirQualityData | null;
  theme: 'dark' | 'light';
}

export const AirQualitySection: React.FC<AirQualitySectionProps> = ({
  airQuality,
  theme,
}) => {
  if (!airQuality) return null;

  const isDark = theme === 'dark';
  const aqiValue = airQuality.usAqi || airQuality.europeanAqi || 0;

  // Apple pastel theme config for status
  let statusBg = isDark ? 'rgba(48, 209, 88, 0.15)' : '#eef9f2';
  let statusText = isDark ? '#81c784' : '#10b981';
  let statusLabel = airQuality.status?.label || 'Excelente';

  if (aqiValue > 150) {
    statusBg = isDark ? 'rgba(255, 55, 95, 0.15)' : '#fdf2f4';
    statusText = isDark ? '#f06292' : '#f43f5e';
    statusLabel = 'Insalubre';
  } else if (aqiValue > 100) {
    statusBg = isDark ? 'rgba(255, 159, 10, 0.15)' : '#fff7ed';
    statusText = isDark ? '#ffb74d' : '#f97316';
    statusLabel = 'Moderada';
  } else if (aqiValue > 50) {
    statusBg = isDark ? 'rgba(255, 214, 10, 0.15)' : '#fefce8';
    statusText = isDark ? '#fff176' : '#ca8a04';
    statusLabel = 'Aceitável';
  }

  // Calculate percentage on 0-200 scale for Apple Health style gradient bar
  const indicatorPercent = Math.min(Math.max((aqiValue / 200) * 100, 3), 97);

  return (
    <View style={styles.container}>
      <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Wind size={16} color={isDark ? '#4dd0e1' : '#0d9488'} />
            <Text style={[styles.cardTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              Qualidade do Ar
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <Text style={[styles.statusBadgeText, { color: statusText }]}>
              {statusLabel}
            </Text>
          </View>
        </View>

        {/* AQI Overview: Large Number + Health Tip */}
        <View style={styles.aqiMainBlock}>
          <View style={styles.aqiNumberCol}>
            <Text style={[styles.aqiBigNum, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              {aqiValue}
            </Text>
            <Text style={[styles.aqiSub, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              Índice AQI
            </Text>
          </View>

          <View style={styles.recommendationCol}>
            <Text style={[styles.recommendationTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              Recomendação de Saúde
            </Text>
            <Text style={[styles.recommendationBody, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              {airQuality.status?.recommendation ||
                'O ar está limpo e ideal para qualquer atividade externa.'}
            </Text>
          </View>
        </View>

        {/* Apple Continuous Pastel Gradient Bar */}
        <View style={styles.scaleContainer}>
          <View style={styles.gradientBar} />
          <View style={[styles.scalePointer, { left: `${indicatorPercent}%` }]} />
        </View>

        {/* 4 Pollutant Minimalist Cards */}
        <View style={styles.pollutantsGrid}>
          {/* PM2.5 */}
          <View style={[styles.pollutantCard, isDark ? styles.pCardDark : styles.pCardLight]}>
            <Text style={styles.pName}>PM2.5</Text>
            <Text style={[styles.pVal, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              {airQuality.pm25} <Text style={styles.pUnit}>µg/m³</Text>
            </Text>
            <Text style={[styles.pDesc, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              Partículas finas
            </Text>
          </View>

          {/* PM10 */}
          <View style={[styles.pollutantCard, isDark ? styles.pCardDark : styles.pCardLight]}>
            <Text style={styles.pName}>PM10</Text>
            <Text style={[styles.pVal, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              {airQuality.pm10} <Text style={styles.pUnit}>µg/m³</Text>
            </Text>
            <Text style={[styles.pDesc, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              Inaláveis
            </Text>
          </View>

          {/* NO2 */}
          <View style={[styles.pollutantCard, isDark ? styles.pCardDark : styles.pCardLight]}>
            <Text style={styles.pName}>NO₂</Text>
            <Text style={[styles.pVal, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              {airQuality.nitrogenDioxide} <Text style={styles.pUnit}>µg/m³</Text>
            </Text>
            <Text style={[styles.pDesc, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              Dióxido de nitrogênio
            </Text>
          </View>

          {/* Ozone */}
          <View style={[styles.pollutantCard, isDark ? styles.pCardDark : styles.pCardLight]}>
            <Text style={styles.pName}>O₃</Text>
            <Text style={[styles.pVal, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              {airQuality.ozone} <Text style={styles.pUnit}>µg/m³</Text>
            </Text>
            <Text style={[styles.pDesc, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              Ozônio troposférico
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
    marginBottom: 20,
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
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  aqiMainBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  aqiNumberCol: {
    minWidth: 80,
  },
  aqiBigNum: {
    fontSize: 48,
    fontWeight: '300',
    letterSpacing: -1,
    lineHeight: 52,
    fontVariant: ['tabular-nums'],
  },
  aqiSub: {
    fontSize: 12,
    marginTop: 2,
  },
  recommendationCol: {
    flex: 1,
    minWidth: 200,
  },
  recommendationTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 3,
  },
  recommendationBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  scaleContainer: {
    position: 'relative',
    height: 6,
    width: '100%',
    marginBottom: 20,
  },
  gradientBar: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    // Soft continuous pastel spectrum: Green -> Yellow -> Orange -> Pink/Red
    backgroundColor: '#10b981',
    // @ts-ignore
    background: 'linear-gradient(to right, #34d399, #facc15, #fb923c, #f87171)',
  },
  scalePointer: {
    position: 'absolute',
    top: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#1d1d1f',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    marginLeft: -7,
  },
  pollutantsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pollutantCard: {
    flex: 1,
    minWidth: 120,
    padding: 14,
    borderRadius: 18,
  },
  pCardLight: {
    backgroundColor: '#f5f5f7',
  },
  pCardDark: {
    backgroundColor: '#2c2c2e',
  },
  pName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#86868b',
    marginBottom: 2,
  },
  pVal: {
    fontSize: 18,
    fontWeight: '600',
  },
  pUnit: {
    fontSize: 11,
    color: '#86868b',
    fontWeight: '400',
  },
  pDesc: {
    fontSize: 11,
    marginTop: 2,
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

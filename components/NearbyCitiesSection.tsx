import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Compass, Users, ArrowUpRight } from 'lucide-react';
import { NearbyCity, City } from '../types';
import { formatNumberBR } from '../services/utils';

interface NearbyCitiesSectionProps {
  cities: NearbyCity[];
  onSelectCity: (city: City) => void;
  theme: 'dark' | 'light';
}

export const NearbyCitiesSection: React.FC<NearbyCitiesSectionProps> = ({
  cities,
  onSelectCity,
  theme,
}) => {
  if (!cities || cities.length === 0) return null;

  const isDark = theme === 'dark';

  const handleExplore = (c: NearbyCity) => {
    const cityObj: City = {
      id: c.id || Math.round(c.latitude * 1000 + c.longitude * 1000),
      name: c.name,
      latitude: c.latitude,
      longitude: c.longitude,
      elevation: 0,
      country: c.country,
      countryCode: c.countryCode,
      admin1: c.region,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      population: c.population || 0,
    };
    onSelectCity(cityObj);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
        {/* Section Header */}
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Compass size={16} color={isDark ? '#81c784' : '#10b981'} />
            <Text style={[styles.cardTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              Cidades Vizinhas
            </Text>
          </View>
          <View style={[styles.countBadge, isDark ? styles.badgeMintDark : styles.badgeMintLight]}>
            <Text style={[styles.countText, isDark ? styles.textMintDark : styles.textMintLight]}>
              {cities.length} destinos
            </Text>
          </View>
        </View>

        {/* Nearby Cities Grid */}
        <View style={styles.grid}>
          {cities.length === 0 ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <View
                key={idx}
                style={[styles.cityCard, isDark ? styles.cityCardDark : styles.cityCardLight, { padding: 16 }]}
              >
                <div
                  className={`td-skeleton-box ${isDark ? 'td-skeleton-dark' : 'td-skeleton-light'}`}
                  data-skeleton="true"
                  style={{ width: '60%', height: 16, borderRadius: 6, marginBottom: 8 }}
                />
                <div
                  className={`td-skeleton-box ${isDark ? 'td-skeleton-dark' : 'td-skeleton-light'}`}
                  data-skeleton="true"
                  style={{ width: '40%', height: 12, borderRadius: 4 }}
                />
              </View>
            ))
          ) : (
            cities.map((city, idx) => (
            <View
              key={`${city.name}-${idx}`}
              style={[styles.cityCard, isDark ? styles.cityCardDark : styles.cityCardLight]}
            >
              <View style={styles.cardTop}>
                <View style={styles.nameBlock}>
                  <Text
                    style={[styles.cityName, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}
                    numberOfLines={1}
                  >
                    {city.name}
                  </Text>
                  <Text style={[styles.cityRegion, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]} numberOfLines={1}>
                    {[city.region, city.country].filter(Boolean).join(', ')}
                  </Text>
                </View>

                {/* Distance & Direction Pastel Pill */}
                <View style={[styles.distPill, isDark ? styles.distPillDark : styles.distPillLight]}>
                  <Text style={[styles.distText, isDark ? styles.distTextDark : styles.distTextLight]}>
                    {city.distanceKm} km {city.direction}
                  </Text>
                </View>
              </View>

              {/* Bottom Row */}
              <View style={styles.cardBottom}>
                <View style={styles.popRow}>
                  <Users size={12} color="#86868b" />
                  <Text style={[styles.popText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                    {city.population ? `${formatNumberBR(city.population)} hab.` : 'Cidade vizinha'}
                  </Text>
                </View>

                {/* Explore Pill Button */}
                <TouchableOpacity
                  style={[styles.exploreBtn, isDark ? styles.exploreBtnDark : styles.exploreBtnLight]}
                  onPress={() => handleExplore(city)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.exploreText, isDark ? styles.exploreTextDark : styles.exploreTextLight]}>
                    Explorar
                  </Text>
                  <ArrowUpRight size={13} color={isDark ? '#64b5f6' : '#0071e3'} />
                </TouchableOpacity>
              </View>
            </View>
          )))}
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
    marginBottom: 18,
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
  countBadge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  badgeMintLight: {
    backgroundColor: '#eef9f2',
  },
  badgeMintDark: {
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
  },
  countText: {
    fontSize: 11,
    fontWeight: '600',
  },
  textMintLight: {
    color: '#10b981',
  },
  textMintDark: {
    color: '#81c784',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cityCard: {
    flex: 1,
    minWidth: 240,
    maxWidth: 380,
    borderRadius: 18,
    padding: 16,
    justifyContent: 'space-between',
    gap: 14,
  },
  cityCardLight: {
    backgroundColor: '#f5f5f7',
  },
  cityCardDark: {
    backgroundColor: '#2c2c2e',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  nameBlock: {
    flex: 1,
  },
  cityName: {
    fontSize: 14,
    fontWeight: '600',
  },
  cityRegion: {
    fontSize: 11,
    marginTop: 2,
  },
  distPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  distPillLight: {
    backgroundColor: '#ffffff',
  },
  distPillDark: {
    backgroundColor: '#3a3a3c',
  },
  distText: {
    fontSize: 11,
    fontWeight: '600',
  },
  distTextLight: {
    color: '#10b981',
  },
  distTextDark: {
    color: '#81c784',
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  popRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  popText: {
    fontSize: 11,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  exploreBtnLight: {
    backgroundColor: '#eef5ff',
  },
  exploreBtnDark: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
  },
  exploreText: {
    fontSize: 12,
    fontWeight: '600',
  },
  exploreTextLight: {
    color: '#0071e3',
  },
  exploreTextDark: {
    color: '#64b5f6',
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

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Heart, Clock, X } from 'lucide-react';
import { City } from '../types';
import { FavoritesService, SavedCity } from '../services/favorites';

interface SavedCitiesCarouselProps {
  currentCityId?: number;
  onSelectCity: (city: City) => void;
  theme: 'dark' | 'light';
}

export const SavedCitiesCarousel: React.FC<SavedCitiesCarouselProps> = ({
  currentCityId,
  onSelectCity,
  theme,
}) => {
  const [favorites, setFavorites] = useState<SavedCity[]>([]);
  const [currentTimes, setCurrentTimes] = useState<Record<number, string>>({});

  useEffect(() => {
    const load = () => {
      setFavorites(FavoritesService.getFavorites());
    };
    load();
    const unsubscribe = FavoritesService.subscribe(load);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (favorites.length === 0) return;

    const updateTimes = () => {
      const now = new Date();
      const updated: Record<number, string> = {};
      favorites.forEach((fav) => {
        try {
          const formatter = new Intl.DateTimeFormat('pt-BR', {
            timeZone: fav.timezone || 'UTC',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
          updated[fav.id] = formatter.format(now);
        } catch {
          updated[fav.id] = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
      });
      setCurrentTimes(updated);
    };

    updateTimes();
    const timer = setInterval(updateTimes, 1000);
    return () => clearInterval(timer);
  }, [favorites]);

  if (favorites.length === 0) return null;

  const isDark = theme === 'dark';

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Heart size={14} color="#f43f5e" fill="#f43f5e" />
          <Text style={[styles.sectionTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
            Cidades Salvas ({favorites.length})
          </Text>
        </View>
        <Text style={[styles.subtitle, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
          Acesso rápido estilo iOS
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollList}
      >
        {favorites.map((fav) => {
          const isSelected = fav.id === currentCityId;
          const time = currentTimes[fav.id] || '--:--';

          return (
            <TouchableOpacity
              key={fav.id}
              style={[
                styles.cityCard,
                isDark ? styles.cardDark : styles.cardLight,
                isSelected && (isDark ? styles.cardSelectedDark : styles.cardSelectedLight),
              ]}
              onPress={() => {
                onSelectCity({
                  id: fav.id,
                  name: fav.name,
                  latitude: fav.latitude,
                  longitude: fav.longitude,
                  elevation: 0,
                  country: fav.country,
                  countryCode: fav.countryCode,
                  admin1: fav.admin1,
                  timezone: fav.timezone,
                  population: fav.population,
                });
              }}
              activeOpacity={0.75}
            >
              <View style={styles.cardTop}>
                <View style={styles.cityInfo}>
                  <Text
                    style={[styles.cityName, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}
                    numberOfLines={1}
                  >
                    {fav.name}
                  </Text>
                  <Text style={[styles.cityRegion, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                    {[fav.admin1, fav.countryCode ? fav.countryCode.toUpperCase() : ''].filter(Boolean).join(', ')}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.removeBtn, isDark ? styles.removeBtnDark : styles.removeBtnLight]}
                  onPress={(e) => {
                    e.stopPropagation();
                    FavoritesService.removeFavorite(fav.id);
                  }}
                  activeOpacity={0.6}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={12} color={isDark ? '#a1a1a6' : '#86868b'} />
                </TouchableOpacity>
              </View>

              <View style={styles.cardBottom}>
                <View style={styles.timeBadge}>
                  <Clock size={11} color={isDark ? '#64b5f6' : '#0071e3'} />
                  <Text style={[styles.timeText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                    {time}
                  </Text>
                </View>

                {isSelected && (
                  <View style={[styles.activePill, isDark ? styles.activePillDark : styles.activePillLight]}>
                    <Text style={styles.activePillText}>Ativa</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
  },
  scrollList: {
    gap: 10,
    paddingVertical: 4,
  },
  cityCard: {
    width: 170,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
  },
  cardLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  cardDark: {
    backgroundColor: '#1c1c1e',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardSelectedLight: {
    borderColor: '#0071e3',
    backgroundColor: '#f7faff',
  },
  cardSelectedDark: {
    borderColor: '#64b5f6',
    backgroundColor: '#1e2638',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cityInfo: {
    flex: 1,
    marginRight: 6,
  },
  cityName: {
    fontSize: 14,
    fontWeight: '600',
  },
  cityRegion: {
    fontSize: 11,
    marginTop: 2,
  },
  removeBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnLight: {
    backgroundColor: '#f0f0f2',
  },
  removeBtnDark: {
    backgroundColor: '#2c2c2e',
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  activePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  activePillLight: {
    backgroundColor: '#eef5ff',
  },
  activePillDark: {
    backgroundColor: 'rgba(10, 132, 255, 0.2)',
  },
  activePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0071e3',
    textTransform: 'uppercase',
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

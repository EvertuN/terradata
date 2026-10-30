import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'next/router';
import {
  Search,
  Navigation,
  Globe2,
  MapPin,
  X,
  Sun,
  Moon,
  Sparkles,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  Snowflake,
  CloudLightning,
  Thermometer,
} from 'lucide-react';
import { City } from '../types';
import { ApiService } from '../services/api';

interface LandingSearchProps {
  onSelectCity: (city: City) => void;
  onCurrentLocation: () => void;
  isLoadingLocation: boolean;
  recentCities?: City[];
  onRemoveRecentCity?: (city: City) => void;
  onClearRecentCities?: () => void;
  cachedCity?: City | null;
  onClearCache?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

interface RecentWeatherInfo {
  temperature: number;
  weatherCode: number;
  conditionLabel: string;
  icon: string;
  color: string;
}

export const LandingSearch: React.FC<LandingSearchProps> = ({
  onSelectCity,
  onCurrentLocation,
  isLoadingLocation,
  recentCities = [],
  onRemoveRecentCity,
  onClearRecentCities,
  cachedCity,
  onClearCache,
  theme,
  onToggleTheme,
}) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<City[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [weatherMap, setWeatherMap] = useState<Record<string, RecentWeatherInfo>>({});
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isDark = theme === 'dark';

  // Normalize recent cities list, falling back to cachedCity if recentCities is empty
  const activeRecentCities: City[] = React.useMemo(() => {
    if (recentCities && recentCities.length > 0) return recentCities;
    if (cachedCity) return [cachedCity];
    return [];
  }, [recentCities, cachedCity]);

  // Autocomplete search
  useEffect(() => {
    let isCurrent = true;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await ApiService.searchCities(searchQuery);
        if (isCurrent) {
          setSuggestions(results);
          setShowDropdown(true);
        }
      } catch (err) {
        if (isCurrent) console.error('Search error:', err);
      } finally {
        if (isCurrent) setIsSearching(false);
      }
    }, 250);

    return () => {
      isCurrent = false;
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Warm up city database during idle time
  useEffect(() => {
    const w = window as any;
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(() => ApiService.preloadCitySearch(), { timeout: 3000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = setTimeout(() => ApiService.preloadCitySearch(), 1200);
    return () => clearTimeout(id);
  }, []);

  // Fetch real-time weather for recent cities in background (NO EMOJIS, clean Lucide icons)
  useEffect(() => {
    let isCancelled = false;
    if (activeRecentCities.length === 0) return;

    activeRecentCities.forEach(async (c) => {
      const key = `${c.name}_${c.latitude.toFixed(2)}_${c.longitude.toFixed(2)}`;
      if (weatherMap[key]) return;

      try {
        const w = await ApiService.getWeather(c.latitude, c.longitude, c.name, c.admin1);
        if (isCancelled || !w?.current) return;
        const meta = ApiService.getWeatherMeta(w.current.weatherCode);
        setWeatherMap((prev) => ({
          ...prev,
          [key]: {
            temperature: Math.round(w.current.temperature),
            weatherCode: w.current.weatherCode,
            conditionLabel: meta.label,
            icon: meta.icon,
            color: meta.color,
          },
        }));
      } catch {
        // Ignore weather fetch errors for recent cities
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [activeRecentCities]);

  const handleSelectSuggestion = (city: City) => {
    setSearchQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    onSelectCity(city);
  };

  const handleManualSearch = async () => {
    const term = searchQuery.trim();
    if (!term) return;

    if (suggestions.length > 0) {
      handleSelectSuggestion(suggestions[0]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await ApiService.searchCities(term);
      if (results && results.length > 0) {
        handleSelectSuggestion(results[0]);
      } else {
        setShowDropdown(true);
      }
    } catch {
      // ignore
    } finally {
      setIsSearching(false);
    }
  };

  // Render weather icon (NO EMOJIS - pure Lucide vectors with accurate theme colors)
  const renderWeatherIcon = (info?: RecentWeatherInfo) => {
    const iconColor = info?.color || (isDark ? '#64b5f6' : '#0071e3');
    const size = 18;

    if (!info) {
      return <Thermometer size={size} color={iconColor} />;
    }

    switch (info.icon) {
      case 'Sun':
        return <Sun size={size} color={iconColor} />;
      case 'CloudSun':
        return <CloudSun size={size} color={iconColor} />;
      case 'Cloud':
        return <Cloud size={size} color={iconColor} />;
      case 'CloudFog':
        return <CloudFog size={size} color={iconColor} />;
      case 'CloudDrizzle':
        return <CloudDrizzle size={size} color={iconColor} />;
      case 'CloudRain':
        return <CloudRain size={size} color={iconColor} />;
      case 'Snowflake':
        return <Snowflake size={size} color={iconColor} />;
      case 'CloudLightning':
        return <CloudLightning size={size} color={iconColor} />;
      default:
        return <Thermometer size={size} color={iconColor} />;
    }
  };

  return (
    <View style={[styles.container, isDark ? styles.containerDark : styles.containerLight]}>
      {/* Top Bar with Minimal Theme Toggle */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.themeBtn, isDark ? styles.themeBtnDark : styles.themeBtnLight]}
          onPress={onToggleTheme}
          activeOpacity={0.7}
          accessibilityLabel="Alternar tema claro/escuro"
        >
          {isDark ? <Sun size={16} color="#ffd60a" /> : <Moon size={16} color="#1d1d1f" />}
        </TouchableOpacity>
      </View>

      {/* Center Search Experience */}
      <View style={styles.centerContent}>
        {/* Hero Section */}
        <View style={styles.heroBlock}>
          <View style={[styles.logoBadge, isDark ? styles.logoBadgeDark : styles.logoBadgeLight]}>
            <Globe2 size={28} color={isDark ? '#64b5f6' : '#0071e3'} />
          </View>
          <Text style={[styles.heroTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
            TerraData
          </Text>
          <Text style={[styles.heroTagline, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
            Clima, cultura e roteiros para qualquer cidade
          </Text>
        </View>

        {/* Search Box with Inline "Buscar" Button */}
        <View style={styles.searchWrapper}>
          <View
            style={[
              styles.searchField,
              isDark ? styles.searchFieldDark : styles.searchFieldLight,
              isFocused && (isDark ? styles.searchFieldFocusedDark : styles.searchFieldFocusedLight),
            ]}
          >
            <Search
              size={18}
              color={isFocused ? (isDark ? '#64b5f6' : '#0071e3') : '#86868b'}
              style={styles.searchIcon}
            />
            <TextInput
              style={[
                styles.searchInput,
                { outlineStyle: 'none', outline: 'none' } as any,
                isDark ? styles.textPrimaryDark : styles.textPrimaryLight,
              ]}
              placeholder="Digite uma cidade, como Salvador, Tóquio ou Paris"
              placeholderTextColor={isDark ? '#6e6e73' : '#86868b'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleManualSearch}
              returnKeyType="search"
              onFocus={() => {
                setIsFocused(true);
                if (suggestions.length > 0) setShowDropdown(true);
              }}
              onBlur={() => {
                setIsFocused(false);
              }}
            />

            {isSearching && (
              <ActivityIndicator size="small" color="#0071e3" style={styles.spinner} />
            )}

            {searchQuery.length > 0 && !isSearching && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSuggestions([]);
                  setShowDropdown(false);
                }}
                style={styles.clearBtn}
                accessibilityLabel="Limpar busca"
              >
                <X size={15} color="#86868b" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.goButton, isDark ? styles.goButtonDark : styles.goButtonLight]}
              onPress={handleManualSearch}
              activeOpacity={0.75}
            >
              <Text style={styles.goButtonText}>Buscar</Text>
            </TouchableOpacity>
          </View>

          {/* Autocomplete Suggestions Dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <View
              style={[
                styles.dropdownContainer,
                isDark ? styles.dropdownDark : styles.dropdownLight,
              ]}
            >
              <ScrollView
                style={{ maxHeight: 300 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {suggestions.map((city, idx) => (
                  <TouchableOpacity
                    key={`${city.id}-${idx}`}
                    style={[
                      styles.dropdownItem,
                      isDark ? styles.dropdownItemDark : styles.dropdownItemLight,
                    ]}
                    onPress={() => handleSelectSuggestion(city)}
                    activeOpacity={0.65}
                  >
                    <View style={[styles.pinCircle, isDark ? styles.pinCircleDark : styles.pinCircleLight]}>
                      <MapPin size={13} color={isDark ? '#64b5f6' : '#0071e3'} />
                    </View>
                    <View style={styles.dropdownInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text
                          style={[
                            styles.dropdownCityName,
                            isDark ? styles.textPrimaryDark : styles.textPrimaryLight,
                          ]}
                        >
                          {city.name}
                        </Text>
                        {city.isFuzzy && (
                          <View style={[styles.fuzzyBadge, isDark ? styles.fuzzyBadgeDark : styles.fuzzyBadgeLight]}>
                            <Sparkles size={9} color={isDark ? '#64b5f6' : '#0071e3'} />
                            <Text style={[styles.fuzzyBadgeText, isDark ? styles.fuzzyBadgeTextDark : styles.fuzzyBadgeTextLight]}>
                              Aproximado
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.dropdownSubtext, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                        {[city.admin1, city.country].filter(Boolean).join(' • ')}
                        {city.isFuzzy && city.fuzzyMatchedFrom ? ` • Sugestão para "${city.fuzzyMatchedFrom}"` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* GPS Quick Action Button */}
        <TouchableOpacity
          style={[styles.geoPillBtn, isDark ? styles.geoPillDark : styles.geoPillLight]}
          onPress={onCurrentLocation}
          disabled={isLoadingLocation}
          activeOpacity={0.75}
        >
          {isLoadingLocation ? (
            <ActivityIndicator size="small" color="#0071e3" />
          ) : (
            <Navigation size={15} color={isDark ? '#64b5f6' : '#0071e3'} />
          )}
          <Text style={[styles.geoPillText, isDark ? styles.geoTextDark : styles.geoTextLight]}>
            {isLoadingLocation ? 'Localizando…' : 'Usar minha localização'}
          </Text>
        </TouchableOpacity>



        {/* Recent Visited Cities (NO EMOJIS, real weather & clean Lucide icons) */}
        {activeRecentCities.length > 0 && (
          <View style={styles.recentsSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                Visitadas recentemente
              </Text>
              {(onClearRecentCities || onClearCache) && (
                <TouchableOpacity
                  onPress={onClearRecentCities || onClearCache}
                  activeOpacity={0.65}
                  style={styles.clearHistoryBtn}
                >
                  <Text style={[styles.clearHistoryText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                    Limpar histórico
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.recentsList}>
              {activeRecentCities.map((city, idx) => {
                const key = `${city.name}_${city.latitude.toFixed(2)}_${city.longitude.toFixed(2)}`;
                const w = weatherMap[key];

                return (
                  <View
                    key={`${city.name}-${city.latitude}-${idx}`}
                    style={[styles.recentCard, isDark ? styles.recentCardDark : styles.recentCardLight]}
                  >
                    <TouchableOpacity
                      style={styles.recentClickArea}
                      onPress={() => onSelectCity(city)}
                      activeOpacity={0.7}
                    >
                      {/* Weather Icon in Soft Rounded Box (NO EMOJIS) */}
                      <View style={[styles.weatherBox, isDark ? styles.weatherBoxDark : styles.weatherBoxLight]}>
                        {renderWeatherIcon(w)}
                      </View>

                      {/* City Name & Region */}
                      <View style={styles.recentInfo}>
                        <Text
                          style={[styles.recentCityName, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}
                          numberOfLines={1}
                        >
                          {city.name}
                        </Text>
                        <Text
                          style={[styles.recentRegion, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}
                          numberOfLines={1}
                        >
                          {[city.admin1, city.country].filter(Boolean).join(' • ')}
                        </Text>
                      </View>

                      {/* Real Temperature & Condition */}
                      <View style={styles.recentTempWrap}>
                        {w ? (
                          <>
                            <Text style={[styles.recentTempText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                              {w.temperature}°C
                            </Text>
                            <Text
                              style={[styles.recentConditionText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}
                              numberOfLines={1}
                            >
                              {w.conditionLabel}
                            </Text>
                          </>
                        ) : (
                          <View style={[styles.tempSkeleton, isDark ? styles.tempSkeletonDark : styles.tempSkeletonLight]} />
                        )}
                      </View>
                    </TouchableOpacity>

                    {/* Remove single city */}
                    {(onRemoveRecentCity || onClearCache) && (
                      <TouchableOpacity
                        style={styles.removeRecentBtn}
                        onPress={() => {
                          if (onRemoveRecentCity) {
                            onRemoveRecentCity(city);
                          } else if (onClearCache) {
                            onClearCache();
                          }
                        }}
                        activeOpacity={0.6}
                        accessibilityLabel={`Remover ${city.name} do histórico`}
                      >
                        <X size={15} color="#86868b" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* Refined Apple Footer with Static Pages Navigation */}
      <View style={styles.footer}>
        <View style={styles.footerNav}>
          <TouchableOpacity onPress={() => router.push('/sobre')} activeOpacity={0.6}>
            <Text style={[styles.footerLink, isDark ? styles.footerLinkDark : styles.footerLinkLight]}>
              Sobre
            </Text>
          </TouchableOpacity>
          <Text style={styles.footerDot}>•</Text>
          <TouchableOpacity onPress={() => router.push('/fontes')} activeOpacity={0.6}>
            <Text style={[styles.footerLink, isDark ? styles.footerLinkDark : styles.footerLinkLight]}>
              Fontes de dados
            </Text>
          </TouchableOpacity>
          <Text style={styles.footerDot}>•</Text>
          <TouchableOpacity onPress={() => router.push('/contato')} activeOpacity={0.6}>
            <Text style={[styles.footerLink, isDark ? styles.footerLinkDark : styles.footerLinkLight]}>
              Contato
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.footerText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
          Clima por Open-Meteo · © {new Date().getFullYear()} TerraData
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: '100vh',
    width: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  containerLight: {
    backgroundColor: '#f6f8fc',
  },
  containerDark: {
    backgroundColor: '#0d1219',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingVertical: 4,
  },
  themeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  themeBtnLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d5dded',
  },
  themeBtnDark: {
    backgroundColor: '#161e29',
    borderColor: '#2a3646',
  },
  centerContent: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 22,
    marginVertical: 28,
  },
  heroBlock: {
    alignItems: 'center',
    gap: 10,
    textAlign: 'center',
    marginBottom: 6,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoBadgeLight: {
    backgroundColor: '#e5effd',
  },
  logoBadgeDark: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: '750',
    letterSpacing: -1.2,
    textAlign: 'center',
  },
  heroTagline: {
    fontSize: 17,
    fontWeight: '400',
    textAlign: 'center',
    maxWidth: 380,
  },
  searchWrapper: {
    width: '100%',
    position: 'relative',
    zIndex: 200,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    borderRadius: 999,
    paddingLeft: 18,
    paddingRight: 8,
    borderWidth: 1,
    boxShadow: '0 4px 20px rgba(16, 24, 40, 0.06)',
  },
  searchFieldLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d5dded',
  },
  searchFieldDark: {
    backgroundColor: '#161e29',
    borderColor: '#2a3646',
  },
  searchFieldFocusedLight: {
    borderColor: '#0b6fe0',
    boxShadow: '0 0 0 3px rgba(11, 111, 224, 0.15), 0 4px 20px rgba(16, 24, 40, 0.08)',
  },
  searchFieldFocusedDark: {
    borderColor: '#5aa2ff',
    boxShadow: '0 0 0 3px rgba(90, 162, 255, 0.2), 0 4px 20px rgba(0, 0, 0, 0.3)',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    fontWeight: '400',
  },
  spinner: {
    marginRight: 8,
  },
  clearBtn: {
    marginRight: 8,
    padding: 6,
  },
  goButton: {
    height: 42,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goButtonLight: {
    backgroundColor: '#0b6fe0',
  },
  goButtonDark: {
    backgroundColor: '#5aa2ff',
  },
  goButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  dropdownContainer: {
    position: 'absolute',
    top: 66,
    left: 8,
    right: 8,
    borderRadius: 20,
    maxHeight: 300,
    boxShadow: '0 16px 36px rgba(0, 0, 0, 0.1)',
    zIndex: 999,
    overflow: 'hidden',
    borderWidth: 1,
  },
  dropdownLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d5dded',
  },
  dropdownDark: {
    backgroundColor: '#161e29',
    borderColor: '#2a3646',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  dropdownItemLight: {
    borderBottomColor: 'rgba(0, 0, 0, 0.04)',
  },
  dropdownItemDark: {
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  pinCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pinCircleLight: {
    backgroundColor: '#e5effd',
  },
  pinCircleDark: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
  },
  dropdownInfo: {
    flex: 1,
  },
  dropdownCityName: {
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  fuzzyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fuzzyBadgeLight: {
    backgroundColor: 'rgba(11, 111, 224, 0.08)',
  },
  fuzzyBadgeDark: {
    backgroundColor: 'rgba(90, 162, 255, 0.15)',
  },
  fuzzyBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  fuzzyBadgeTextLight: {
    color: '#0b6fe0',
  },
  fuzzyBadgeTextDark: {
    color: '#5aa2ff',
  },
  geoPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  geoPillLight: {
    backgroundColor: '#e5effd',
  },
  geoPillDark: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
  },
  geoPillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  geoTextLight: {
    color: '#0a58b4',
  },
  geoTextDark: {
    color: '#8bbdff',
  },

  recentsSection: {
    width: '100%',
    marginTop: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  clearHistoryBtn: {
    padding: 4,
  },
  clearHistoryText: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  recentsList: {
    gap: 10,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 6,
    borderWidth: 1,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
  },
  recentCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d5dded',
  },
  recentCardDark: {
    backgroundColor: '#161e29',
    borderColor: '#2a3646',
  },
  recentClickArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  weatherBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  weatherBoxLight: {
    backgroundColor: '#e5effd',
  },
  weatherBoxDark: {
    backgroundColor: '#1b2c45',
  },
  recentInfo: {
    flex: 1,
    minWidth: 0,
  },
  recentCityName: {
    fontSize: 15,
    fontWeight: '650',
    letterSpacing: -0.2,
  },
  recentRegion: {
    fontSize: 12,
    marginTop: 2,
  },
  recentTempWrap: {
    alignItems: 'flex-end',
    paddingHorizontal: 8,
  },
  recentTempText: {
    fontSize: 15,
    fontWeight: '700',
  },
  recentConditionText: {
    fontSize: 11,
    marginTop: 2,
    maxWidth: 110,
    textAlign: 'right',
  },
  tempSkeleton: {
    width: 44,
    height: 18,
    borderRadius: 6,
  },
  tempSkeletonLight: {
    backgroundColor: '#e8e8ed',
  },
  tempSkeletonDark: {
    backgroundColor: '#2c2c2e',
  },
  removeRecentBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  footerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '500',
  },
  footerLinkLight: {
    color: '#556070',
  },
  footerLinkDark: {
    color: '#9eabbd',
  },
  footerDot: {
    fontSize: 12,
    color: '#86868b',
  },
  footerText: {
    fontSize: 12,
  },
  textPrimaryLight: {
    color: '#0f1722',
  },
  textPrimaryDark: {
    color: '#eef2f8',
  },
  textSecondaryLight: {
    color: '#556070',
  },
  textSecondaryDark: {
    color: '#9eabbd',
  },
});

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  Search,
  Navigation,
  Globe2,
  MapPin,
  X,
  ArrowRight,
  Sun,
  Moon,
  Trash2,
} from 'lucide-react';
import { City } from '../types';
import { ApiService } from '../services/api';


interface LandingSearchProps {
  onSelectCity: (city: City) => void;
  onCurrentLocation: () => void;
  isLoadingLocation: boolean;
  cachedCity: City | null;
  onClearCache: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const LandingSearch: React.FC<LandingSearchProps> = ({
  onSelectCity,
  onCurrentLocation,
  isLoadingLocation,
  cachedCity,
  onClearCache,
  theme,
  onToggleTheme,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<City[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    }, 280);

    return () => {
      isCurrent = false;
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  const handleSelectSuggestion = (city: City) => {
    setSearchQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    onSelectCity(city);
  };

  const isDark = theme === 'dark';

  return (
    <View style={[styles.container, isDark ? styles.containerDark : styles.containerLight]}>
      {/* Top Bar with Minimal Theme Toggle */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.themeBtn, isDark ? styles.themeBtnDark : styles.themeBtnLight]}
          onPress={onToggleTheme}
          activeOpacity={0.7}
        >
          {isDark ? <Sun size={15} color="#ffd60a" /> : <Moon size={15} color="#1d1d1f" />}
        </TouchableOpacity>
      </View>

      {/* Center Search Experience */}
      <View style={styles.centerContent}>
        {/* Brand Icon & Heading */}
        <View style={styles.headerBlock}>
          <View style={[styles.brandIconWrap, isDark ? styles.brandIconDark : styles.brandIconLight]}>
            <Globe2 size={24} color={isDark ? '#64b5f6' : '#0071e3'} />
          </View>
          <Text style={[styles.brandTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
            TerraData
          </Text>
          <Text style={[styles.brandSubtitle, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
            Agregador Geográfico e Meteorológico
          </Text>
        </View>

        {/* Spotlight Search Box */}
        <View style={styles.searchWrapper}>
          <View
            style={[
              styles.searchBox,
              isDark ? styles.searchBoxDark : styles.searchBoxLight,
              isFocused && (isDark ? styles.searchBoxFocusedDark : styles.searchBoxFocusedLight),
            ]}
          >
            <Search size={18} color={isFocused ? (isDark ? '#64b5f6' : '#0071e3') : '#86868b'} style={styles.searchIcon} />
            <TextInput
              style={[
                styles.searchInput,
                { outlineStyle: 'none', outline: 'none' } as any,
                isDark ? styles.textPrimaryDark : styles.textPrimaryLight,
              ]}
              placeholder="Digite o nome de uma cidade (ex: Salvador, Tóquio, Paris)..."
              placeholderTextColor={isDark ? '#6e6e73' : '#86868b'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={true}
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
              >
                <X size={16} color="#86868b" />
              </TouchableOpacity>
            )}
          </View>

          {/* Autocomplete Suggestions Dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <View
              style={[
                styles.dropdownContainer,
                isDark ? styles.dropdownDark : styles.dropdownLight,
              ]}
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
                    <Text
                      style={[
                        styles.dropdownCityName,
                        isDark ? styles.textPrimaryDark : styles.textPrimaryLight,
                      ]}
                    >
                      {city.name}
                    </Text>
                    <Text style={[styles.dropdownSubtext, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                      {[city.admin1, city.country].filter(Boolean).join(' • ')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* GPS Quick Action Button */}
        <TouchableOpacity
          style={[styles.gpsActionBtn, isDark ? styles.gpsBtnDark : styles.gpsBtnLight]}
          onPress={onCurrentLocation}
          disabled={isLoadingLocation}
          activeOpacity={0.75}
        >
          {isLoadingLocation ? (
            <ActivityIndicator size="small" color="#0071e3" />
          ) : (
            <Navigation size={14} color={isDark ? '#64b5f6' : '#0071e3'} />
          )}
          <Text style={[styles.gpsActionText, isDark ? styles.gpsTextDark : styles.gpsTextLight]}>
            {isLoadingLocation ? 'Localizando...' : 'Minha localização atual'}
          </Text>
        </TouchableOpacity>

        {/* Cached City Quick Resume Card */}
        {cachedCity && (
          <View style={styles.cacheWrapper}>
            <Text style={[styles.cacheHeading, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              ÚLTIMA CIDADE VISITADA
            </Text>
            <View style={[styles.cacheCard, isDark ? styles.cacheCardDark : styles.cacheCardLight]}>
              <TouchableOpacity
                style={styles.cacheClickArea}
                onPress={() => onSelectCity(cachedCity)}
                activeOpacity={0.7}
              >
                <View style={[styles.cacheIconWrap, isDark ? styles.cacheIconWrapDark : styles.cacheIconWrapLight]}>
                  <MapPin size={18} color={isDark ? '#64b5f6' : '#0071e3'} />
                </View>
                <View style={styles.cacheInfo}>
                  <Text style={[styles.cacheCityName, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                    Continuar em {cachedCity.name}
                  </Text>
                  <Text style={[styles.cacheRegion, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                    {[cachedCity.admin1, cachedCity.country].filter(Boolean).join(' • ')}
                  </Text>
                </View>
                <View style={styles.cacheArrowWrap}>
                  <ArrowRight size={16} color={isDark ? '#64b5f6' : '#0071e3'} />
                </View>
              </TouchableOpacity>

              {/* Forget button */}
              <TouchableOpacity
                style={styles.cacheForgetBtn}
                onPress={onClearCache}
                activeOpacity={0.6}
              >
                <Trash2 size={13} color="#86868b" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
          TerraData • Dados Geográficos e Meteorológicos em Tempo Real
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
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  containerLight: {
    backgroundColor: '#fbfbfd',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
  },
  themeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeBtnLight: {
    backgroundColor: '#f0f0f2',
  },
  themeBtnDark: {
    backgroundColor: '#2c2c2e',
  },
  centerContent: {
    width: '100%',
    maxWidth: 580,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 20,
    marginVertical: 'auto',
  },
  headerBlock: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  brandIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  brandIconLight: {
    backgroundColor: '#eef5ff',
  },
  brandIconDark: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
  },
  brandTitle: {
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: -1,
  },
  brandAccent: {
    color: '#0071e3',
  },
  brandSubtitle: {
    fontSize: 15,
    fontWeight: '400',
  },
  searchWrapper: {
    width: '100%',
    position: 'relative',
    zIndex: 200,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderRadius: 27,
    paddingHorizontal: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 4,
  },
  searchBoxLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  searchBoxDark: {
    backgroundColor: '#1c1c1e',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchBoxFocusedLight: {
    borderColor: '#0071e3',
    shadowColor: '#0071e3',
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  searchBoxFocusedDark: {
    borderColor: '#64b5f6',
    shadowColor: '#64b5f6',
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    outlineWidth: 0,
    outlineStyle: 'none' as any,
    fontWeight: '400',
  },
  spinner: {
    marginLeft: 8,
  },
  clearBtn: {
    marginLeft: 8,
    padding: 4,
  },
  dropdownContainer: {
    position: 'absolute',
    top: 62,
    left: 0,
    right: 0,
    borderRadius: 22,
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 16,
    zIndex: 999,
    overflow: 'hidden',
    borderWidth: 1,
  },
  dropdownLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  dropdownDark: {
    backgroundColor: '#2c2c2e',
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pinCircleLight: {
    backgroundColor: '#eef5ff',
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
  gpsActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  gpsBtnLight: {
    backgroundColor: '#eef5ff',
  },
  gpsBtnDark: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
  },
  gpsActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  gpsTextLight: {
    color: '#0071e3',
  },
  gpsTextDark: {
    color: '#64b5f6',
  },
  cacheWrapper: {
    width: '100%',
    marginTop: 14,
    gap: 8,
  },
  cacheHeading: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  cacheCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 14,
  },
  cacheCardLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  cacheCardDark: {
    backgroundColor: '#1c1c1e',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cacheClickArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cacheIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cacheIconWrapLight: {
    backgroundColor: '#eef5ff',
  },
  cacheIconWrapDark: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
  },
  cacheInfo: {
    flex: 1,
  },
  cacheCityName: {
    fontSize: 14,
    fontWeight: '600',
  },
  cacheRegion: {
    fontSize: 11,
    marginTop: 2,
  },
  cacheArrowWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cacheForgetBtn: {
    padding: 8,
    marginLeft: 6,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  footerText: {
    fontSize: 11,
  },
  textPrimaryLight: {
    color: '#1d1d1f',
  },
  textPrimaryDark: {
    color: '#f5f5f7',
  },
  textSecondaryLight: {
    color: '#86868b',
  },
  textSecondaryDark: {
    color: '#a1a1a6',
  },
});

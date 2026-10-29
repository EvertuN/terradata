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
import {
  Search,
  Navigation,
  Sun,
  Moon,
  Globe2,
  MapPin,
  X,
  ChevronLeft,
  Sparkles,
} from 'lucide-react';
import { City } from '../types';
import { ApiService } from '../services/api';


interface HeaderProps {
  currentCity: City | null;
  onSelectCity: (city: City) => void;
  onBackToSearch?: () => void;
  onCurrentLocation: () => void;
  temperatureUnit: 'C' | 'F';
  onToggleUnit: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  isLoadingLocation?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentCity,
  onSelectCity,
  onBackToSearch,
  onCurrentLocation,
  temperatureUnit,
  onToggleUnit,
  theme,
  onToggleTheme,
  isLoadingLocation = false,
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
    onSelectCity(city);
    setSearchQuery('');
    setSuggestions([]);
    setShowDropdown(false);
  };

  const isDark = theme === 'dark';

  return (
    <View style={[styles.headerContainer, isDark ? styles.headerDark : styles.headerLight]}>
      <View style={styles.topRow}>
        {/* Left Side: Back to search + Brand */}
        <View style={styles.leftGroup}>
          {onBackToSearch && (
            <TouchableOpacity
              style={[styles.backBtn, isDark ? styles.backBtnDark : styles.backBtnLight]}
              onPress={onBackToSearch}
              activeOpacity={0.7}
            >
              <ChevronLeft size={16} color={isDark ? '#64b5f6' : '#0071e3'} />
              <Text style={[styles.backBtnText, isDark ? styles.backTextDark : styles.backTextLight]}>
                Cidades
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.brandContainer}
            onPress={onBackToSearch}
            activeOpacity={0.8}
          >
            <View style={[styles.brandIcon, isDark ? styles.brandIconDark : styles.brandIconLight]}>
              <Globe2 size={16} color={isDark ? '#64b5f6' : '#0071e3'} />
            </View>
            <Text style={[styles.brandTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              TerraData
            </Text>
          </TouchableOpacity>
        </View>

        {/* Spotlight-like Search Field */}
        <View style={styles.searchWrapper}>
          <View
            style={[
              styles.searchBox,
              isDark ? styles.searchBoxDark : styles.searchBoxLight,
              isFocused && (isDark ? styles.searchBoxFocusedDark : styles.searchBoxFocusedLight),
            ]}
          >
            <Search size={15} color={isFocused ? (isDark ? '#64b5f6' : '#0071e3') : '#86868b'} style={styles.searchIcon} />
            <TextInput
              style={[
                styles.searchInput,
                { outlineStyle: 'none', outline: 'none' } as any,
                isDark ? styles.textPrimaryDark : styles.textPrimaryLight,
              ]}
              placeholder="Buscar outra cidade..."
              placeholderTextColor={isDark ? '#6e6e73' : '#86868b'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => {
                setIsFocused(true);
                if (suggestions.length > 0) setShowDropdown(true);
              }}
              onBlur={() => {
                setIsFocused(false);
              }}
            />
            {isSearching && (
              <ActivityIndicator size="small" color="#0071e3" style={styles.searchSpinner} />
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
                <X size={14} color="#86868b" />
              </TouchableOpacity>
            )}
          </View>

          {/* Autocomplete Dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <View
              style={[
                styles.dropdownContainer,
                isDark ? styles.dropdownDark : styles.dropdownLight,
              ]}
            >
              <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                      <MapPin size={12} color={isDark ? '#64b5f6' : '#0071e3'} />
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
                      <Text style={styles.dropdownSubtext}>
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

        {/* Action Controls */}
        <View style={styles.controlsRow}>
          {/* Location GPS Button (Soft Pastel Blue) */}
          <TouchableOpacity
            style={[styles.actionBtn, isDark ? styles.gpsBtnDark : styles.gpsBtnLight]}
            onPress={onCurrentLocation}
            disabled={isLoadingLocation}
            activeOpacity={0.7}
          >
            {isLoadingLocation ? (
              <ActivityIndicator size="small" color="#0071e3" />
            ) : (
              <Navigation size={13} color={isDark ? '#64b5f6' : '#0071e3'} />
            )}
            <Text style={[styles.gpsText, isDark ? styles.gpsTextDark : styles.gpsTextLight]}>
              GPS
            </Text>
          </TouchableOpacity>

          {/* Temperature Unit Toggle */}
          <TouchableOpacity
            style={[styles.actionBtn, isDark ? styles.neutralBtnDark : styles.neutralBtnLight]}
            onPress={onToggleUnit}
            activeOpacity={0.7}
          >
            <Text style={[styles.unitText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              °{temperatureUnit}
            </Text>
          </TouchableOpacity>

          {/* Theme Toggle */}
          <TouchableOpacity
            style={[styles.actionBtn, isDark ? styles.neutralBtnDark : styles.neutralBtnLight]}
            onPress={onToggleTheme}
            activeOpacity={0.7}
          >
            {isDark ? (
              <Sun size={15} color="#ffd60a" />
            ) : (
              <Moon size={15} color="#1d1d1f" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    zIndex: 100,
  },
  headerLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderBottomColor: 'rgba(0, 0, 0, 0.04)',
  },
  headerDark: {
    backgroundColor: 'rgba(28, 28, 30, 0.92)',
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  backBtnLight: {
    backgroundColor: '#f5f5f7',
  },
  backBtnDark: {
    backgroundColor: '#2c2c2e',
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  backTextLight: {
    color: '#0071e3',
  },
  backTextDark: {
    color: '#64b5f6',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconLight: {
    backgroundColor: '#eef5ff',
  },
  brandIconDark: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  brandAccent: {
    color: '#0071e3',
  },
  searchWrapper: {
    flex: 1,
    minWidth: 220,
    maxWidth: 440,
    position: 'relative',
    zIndex: 200,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  searchBoxLight: {
    backgroundColor: '#f0f0f2',
    borderColor: 'transparent',
  },
  searchBoxDark: {
    backgroundColor: '#2c2c2e',
    borderColor: 'transparent',
  },
  searchBoxFocusedLight: {
    backgroundColor: '#ffffff',
    borderColor: '#0071e3',
    boxShadow: '0 0 10px rgba(0, 113, 227, 0.1)',
  },
  searchBoxFocusedDark: {
    backgroundColor: '#1c1c1e',
    borderColor: '#64b5f6',
    boxShadow: '0 0 10px rgba(100, 181, 246, 0.18)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 13,
    outlineWidth: 0,
    outlineStyle: 'none' as any,
    fontWeight: '400',
  },
  searchSpinner: {
    marginLeft: 6,
  },
  clearBtn: {
    marginLeft: 6,
    padding: 2,
  },
  dropdownContainer: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    borderRadius: 18,
    maxHeight: 280,
    boxShadow: '0 12px 24px rgba(0, 0, 0, 0.08)',
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
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  dropdownItemLight: {
    borderBottomColor: 'rgba(0, 0, 0, 0.04)',
  },
  dropdownItemDark: {
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  pinCircle: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
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
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownSubtext: {
    fontSize: 11,
    color: '#86868b',
    marginTop: 1,
  },
  fuzzyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  fuzzyBadgeLight: {
    backgroundColor: 'rgba(0, 113, 227, 0.08)',
  },
  fuzzyBadgeDark: {
    backgroundColor: 'rgba(100, 181, 246, 0.15)',
  },
  fuzzyBadgeText: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  fuzzyBadgeTextLight: {
    color: '#0071e3',
  },
  fuzzyBadgeTextDark: {
    color: '#64b5f6',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    height: 34,
    paddingHorizontal: 11,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  gpsBtnLight: {
    backgroundColor: '#eef5ff',
  },
  gpsBtnDark: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
  },
  gpsText: {
    fontSize: 12,
    fontWeight: '600',
  },
  gpsTextLight: {
    color: '#0071e3',
  },
  gpsTextDark: {
    color: '#64b5f6',
  },
  neutralBtnLight: {
    backgroundColor: '#f0f0f2',
  },
  neutralBtnDark: {
    backgroundColor: '#2c2c2e',
  },
  unitText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textPrimaryLight: {
    color: '#1d1d1f',
  },
  textPrimaryDark: {
    color: '#f5f5f7',
  },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {
  CloudSun,
  Wind,
  MapPin,
  Landmark,
  Compass,
  Layers,
} from 'lucide-react';
import {
  City,
  WeatherData,
  AirQualityData,
  CitySummary,
  PointOfInterest,
  NearbyCity,
} from '../types';
import { ApiService } from '../services/api';
import { LandingSearch } from '../components/LandingSearch';
import { Header } from '../components/Header';
import { HeroBanner } from '../components/HeroBanner';
import { WeatherSection } from '../components/WeatherSection';
import { HourlyChart } from '../components/HourlyChart';
import { AirQualitySection } from '../components/AirQualitySection';
import { POIsSection } from '../components/POIsSection';
import { NearbyCitiesSection } from '../components/NearbyCitiesSection';
import { InteractiveMap } from '../components/InteractiveMap';
import { Toast, ToastProps } from '../components/Toast';

export default function HomePage() {
  const [viewState, setViewState] = useState<'search' | 'dashboard'>('search');
  const [currentCity, setCurrentCity] = useState<City | null>(null);
  const [cachedCity, setCachedCity] = useState<City | null>(null);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [airQuality, setAirQuality] = useState<AirQualityData | null>(null);
  const [citySummary, setCitySummary] = useState<CitySummary | null>(null);
  const [pois, setPois] = useState<PointOfInterest[]>([]);
  const [nearbyCities, setNearbyCities] = useState<NearbyCity[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState<boolean>(false);
  const [temperatureUnit, setTemperatureUnit] = useState<'C' | 'F'>('C');
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [activeTab, setActiveTab] = useState<'all' | 'weather' | 'air' | 'map' | 'pois' | 'nearby'>('all');
  const [toast, setToast] = useState<Omit<ToastProps, 'onClose'> | null>(null);

  const showToast = useCallback(
    (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
      setToast({ message, type });
    },
    []
  );

  // Load cache and preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = (localStorage.getItem('terradata_theme') || localStorage.getItem('urbanpulse_theme')) as 'dark' | 'light' | null;
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
      } else {
        setTheme('light');
        document.documentElement.setAttribute('data-theme', 'light');
      }

      const savedUnit = (localStorage.getItem('terradata_unit') || localStorage.getItem('urbanpulse_unit')) as 'C' | 'F' | null;
      if (savedUnit) {
        setTemperatureUnit(savedUnit);
      }

      try {
        const rawLastCity = localStorage.getItem('terradata_last_city') || localStorage.getItem('urbanpulse_last_city');
        if (rawLastCity) {
          const parsed = JSON.parse(rawLastCity);
          if (parsed && parsed.name) {
            setCachedCity(parsed);
          }
        }
      } catch (e) {
        console.warn('Could not parse cached city', e);
      }
    }
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('terradata_theme', nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
    }
    showToast(`Modo ${nextTheme === 'dark' ? 'Escuro' : 'Claro'} ativado`, 'info');
  };

  const handleToggleUnit = () => {
    const nextUnit = temperatureUnit === 'C' ? 'F' : 'C';
    setTemperatureUnit(nextUnit);
    if (typeof window !== 'undefined') {
      localStorage.setItem('terradata_unit', nextUnit);
    }
    showToast(`Unidade alterada para °${nextUnit}`, 'info');
  };

  const handleClearCache = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('terradata_last_city');
      localStorage.removeItem('urbanpulse_last_city');
    }
    setCachedCity(null);
    showToast('Histórico limpo com sucesso', 'info');
  };

  // City selection handler: saves to cache and navigates to dashboard
  const handleSelectCity = useCallback(
    (city: City) => {
      setCurrentCity(city);
      setCachedCity(city);
      if (typeof window !== 'undefined') {
        localStorage.setItem('terradata_last_city', JSON.stringify(city));
      }
      setViewState('dashboard');
    },
    []
  );

  // Main data fetch orchestrator with Promise.allSettled
  const loadCityData = useCallback(
    async (city: City) => {
      setIsLoading(true);
      try {
        const [resWeather, resAir, resWiki, resPois, resNearby] = await Promise.allSettled([
          ApiService.getWeather(city.latitude, city.longitude),
          ApiService.getAirQuality(city.latitude, city.longitude),
          ApiService.getCitySummary(city.name, city.admin1),
          ApiService.getNearbyPOIs(city.latitude, city.longitude, 12),
          ApiService.getNearbyCities(city.latitude, city.longitude, city.name),
        ]);

        if (resWeather.status === 'fulfilled' && resWeather.value) {
          setWeather(resWeather.value);
        }
        if (resAir.status === 'fulfilled' && resAir.value) {
          setAirQuality(resAir.value);
        }
        if (resWiki.status === 'fulfilled' && resWiki.value) {
          setCitySummary(resWiki.value);
        }
        if (resPois.status === 'fulfilled' && resPois.value) {
          setPois(resPois.value);
        }
        if (resNearby.status === 'fulfilled' && resNearby.value) {
          setNearbyCities(resNearby.value);
        }
      } catch (err) {
        console.error('Error loading city data:', err);
        showToast('Não foi possível sincronizar todos os dados', 'warning');
      } finally {
        setIsLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (currentCity && viewState === 'dashboard') {
      loadCityData(currentCity);
    }
  }, [currentCity, viewState, loadCityData]);

  // GPS Geolocation Handler
  const handleCurrentLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      showToast('Geolocalização não disponível no navegador', 'error');
      return;
    }

    setIsLoadingLocation(true);
    showToast('Identificando sua localização...', 'info');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const reverseResult = await ApiService.reverseGeocode(lat, lon);

          if (reverseResult) {
            handleSelectCity(reverseResult);
            showToast(`${reverseResult.name} identificada com sucesso!`, 'success');
          } else {
            const fallbackCity: City = {
              id: Date.now(),
              name: 'Sua Localização',
              latitude: lat,
              longitude: lon,
              elevation: 0,
              country: 'Local',
              countryCode: '',
              admin1: '',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
              population: 0,
            };
            handleSelectCity(fallbackCity);
            showToast('Localização aproximada obtida', 'info');
          }
        } catch (err) {
          console.error('Reverse geocode error:', err);
          showToast('Erro ao obter o nome da cidade', 'warning');
        } finally {
          setIsLoadingLocation(false);
        }
      },
      (err) => {
        setIsLoadingLocation(false);
        showToast('Permissão de GPS necessária para prosseguir', 'error');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const isDark = theme === 'dark';

  // 1. Initial Landing / Search Screen
  if (viewState === 'search' || !currentCity) {
    return (
      <View style={[styles.rootContainer, isDark ? styles.rootDark : styles.rootLight]}>
        <LandingSearch
          onSelectCity={handleSelectCity}
          onCurrentLocation={handleCurrentLocation}
          isLoadingLocation={isLoadingLocation}
          cachedCity={cachedCity}
          onClearCache={handleClearCache}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </View>
    );
  }

  // 2. City Intelligence Dashboard Screen
  return (
    <View style={[styles.rootContainer, isDark ? styles.rootDark : styles.rootLight]}>
      {/* Apple Minimalist Header with Back to Cities Button */}
      <Header
        currentCity={currentCity}
        onSelectCity={(c) => {
          handleSelectCity(c);
          showToast(`${c.name} selecionada`, 'info');
        }}
        onBackToSearch={() => setViewState('search')}
        onCurrentLocation={handleCurrentLocation}
        temperatureUnit={temperatureUnit}
        onToggleUnit={handleToggleUnit}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        isLoadingLocation={isLoadingLocation}
      />

      {/* Main Content Area */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Apple Segmented Control Navigation */}
        <View style={styles.segmentedContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmentedScroll}>
            <View style={[styles.segmentedTrack, isDark ? styles.segmentedTrackDark : styles.segmentedTrackLight]}>
              <TouchableOpacity
                style={[
                  styles.segmentItem,
                  activeTab === 'all' && (isDark ? styles.segmentItemActiveDark : styles.segmentItemActiveLight),
                ]}
                onPress={() => setActiveTab('all')}
                activeOpacity={0.7}
              >
                <Layers size={13} color={activeTab === 'all' ? (isDark ? '#64b5f6' : '#0071e3') : '#86868b'} />
                <Text
                  style={[
                    styles.segmentLabel,
                    activeTab === 'all'
                      ? (isDark ? styles.textPrimaryDark : styles.textPrimaryLight)
                      : (isDark ? styles.textSecondaryDark : styles.textSecondaryLight),
                  ]}
                >
                  Visão Geral
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentItem,
                  activeTab === 'weather' && (isDark ? styles.segmentItemActiveDark : styles.segmentItemActiveLight),
                ]}
                onPress={() => setActiveTab('weather')}
                activeOpacity={0.7}
              >
                <CloudSun size={13} color={activeTab === 'weather' ? (isDark ? '#64b5f6' : '#0071e3') : '#86868b'} />
                <Text
                  style={[
                    styles.segmentLabel,
                    activeTab === 'weather'
                      ? (isDark ? styles.textPrimaryDark : styles.textPrimaryLight)
                      : (isDark ? styles.textSecondaryDark : styles.textSecondaryLight),
                  ]}
                >
                  Clima
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentItem,
                  activeTab === 'air' && (isDark ? styles.segmentItemActiveDark : styles.segmentItemActiveLight),
                ]}
                onPress={() => setActiveTab('air')}
                activeOpacity={0.7}
              >
                <Wind size={13} color={activeTab === 'air' ? (isDark ? '#64b5f6' : '#0071e3') : '#86868b'} />
                <Text
                  style={[
                    styles.segmentLabel,
                    activeTab === 'air'
                      ? (isDark ? styles.textPrimaryDark : styles.textPrimaryLight)
                      : (isDark ? styles.textSecondaryDark : styles.textSecondaryLight),
                  ]}
                >
                  Qualidade do Ar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentItem,
                  activeTab === 'map' && (isDark ? styles.segmentItemActiveDark : styles.segmentItemActiveLight),
                ]}
                onPress={() => setActiveTab('map')}
                activeOpacity={0.7}
              >
                <MapPin size={13} color={activeTab === 'map' ? (isDark ? '#64b5f6' : '#0071e3') : '#86868b'} />
                <Text
                  style={[
                    styles.segmentLabel,
                    activeTab === 'map'
                      ? (isDark ? styles.textPrimaryDark : styles.textPrimaryLight)
                      : (isDark ? styles.textSecondaryDark : styles.textSecondaryLight),
                  ]}
                >
                  Mapa
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentItem,
                  activeTab === 'pois' && (isDark ? styles.segmentItemActiveDark : styles.segmentItemActiveLight),
                ]}
                onPress={() => setActiveTab('pois')}
                activeOpacity={0.7}
              >
                <Landmark size={13} color={activeTab === 'pois' ? (isDark ? '#64b5f6' : '#0071e3') : '#86868b'} />
                <Text
                  style={[
                    styles.segmentLabel,
                    activeTab === 'pois'
                      ? (isDark ? styles.textPrimaryDark : styles.textPrimaryLight)
                      : (isDark ? styles.textSecondaryDark : styles.textSecondaryLight),
                  ]}
                >
                  Atrações ({pois.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentItem,
                  activeTab === 'nearby' && (isDark ? styles.segmentItemActiveDark : styles.segmentItemActiveLight),
                ]}
                onPress={() => setActiveTab('nearby')}
                activeOpacity={0.7}
              >
                <Compass size={13} color={activeTab === 'nearby' ? (isDark ? '#64b5f6' : '#0071e3') : '#86868b'} />
                <Text
                  style={[
                    styles.segmentLabel,
                    activeTab === 'nearby'
                      ? (isDark ? styles.textPrimaryDark : styles.textPrimaryLight)
                      : (isDark ? styles.textSecondaryDark : styles.textSecondaryLight),
                  ]}
                >
                  Vizinhas ({nearbyCities.length})
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {/* Sync Indicator */}
        {isLoading && (
          <View style={[styles.loadingPill, isDark ? styles.loadingPillDark : styles.loadingPillLight]}>
            <ActivityIndicator size="small" color="#0071e3" />
            <Text style={[styles.loadingText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              Atualizando dados...
            </Text>
          </View>
        )}

        {/* Hero Section */}
        <HeroBanner
          city={currentCity}
          summary={citySummary}
          theme={theme}
          onNotify={showToast}
        />

        {/* Dynamic Sections Based on Active Tab */}
        {(activeTab === 'all' || activeTab === 'weather') && (
          <View style={styles.sectionWrap}>
            <WeatherSection
              weather={weather}
              temperatureUnit={temperatureUnit}
              theme={theme}
            />
            {weather?.hourly && (
              <HourlyChart
                hourly={weather.hourly}
                temperatureUnit={temperatureUnit}
                theme={theme}
              />
            )}
          </View>
        )}

        {(activeTab === 'all' || activeTab === 'air') && (
          <View style={styles.sectionWrap}>
            <AirQualitySection airQuality={airQuality} theme={theme} />
          </View>
        )}

        {(activeTab === 'all' || activeTab === 'map') && (
          <View style={styles.sectionWrap}>
            <InteractiveMap
              city={currentCity}
              pois={pois}
              nearbyCities={nearbyCities}
              onSelectCity={(nc) => {
                handleSelectCity(nc);
                showToast(`${nc.name} selecionada`, 'info');
              }}
              theme={theme}
            />
          </View>
        )}

        {(activeTab === 'all' || activeTab === 'pois') && (
          <View style={styles.sectionWrap}>
            <POIsSection pois={pois} theme={theme} />
          </View>
        )}

        {(activeTab === 'all' || activeTab === 'nearby') && (
          <View style={styles.sectionWrap}>
            <NearbyCitiesSection
              cities={nearbyCities}
              onSelectCity={(nc) => {
                handleSelectCity(nc);
                showToast(`${nc.name} selecionada`, 'info');
              }}
              theme={theme}
            />
          </View>
        )}

        {/* Apple Style Legal & Source Notes */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            TerraData • Dados meteorológicos fornecidos por Open-Meteo • Cartografia por OpenStreetMap & CartoDB • Informações geográficas via GeoDB Cities & Wikipédia
          </Text>
        </View>
      </ScrollView>

      {/* Floating Apple Capsule Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    minHeight: '100vh',
    width: '100%',
  },
  rootLight: {
    backgroundColor: '#fbfbfd',
  },
  rootDark: {
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    gap: 16,
  },
  segmentedContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  segmentedScroll: {
    paddingVertical: 2,
  },
  segmentedTrack: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 16,
  },
  segmentedTrackLight: {
    backgroundColor: '#e5e5ea',
  },
  segmentedTrackDark: {
    backgroundColor: '#1c1c1e',
  },
  segmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 13,
  },
  segmentItemActiveLight: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  segmentItemActiveDark: {
    backgroundColor: '#2c2c2e',
    elevation: 2,
  },
  segmentLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  loadingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  loadingPillLight: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
  },
  loadingPillDark: {
    backgroundColor: '#1c1c1e',
  },
  loadingText: {
    fontSize: 12,
  },
  sectionWrap: {
    width: '100%',
    gap: 16,
  },
  footer: {
    paddingVertical: 28,
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    color: '#86868b',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 700,
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

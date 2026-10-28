import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Map, Layers, Landmark, Compass, CloudRain, Play, Pause, Clock } from 'lucide-react';
import { City, PointOfInterest, NearbyCity } from '../types';

interface InteractiveMapProps {
  city: City;
  pois: PointOfInterest[];
  nearbyCities: NearbyCity[];
  onSelectCity: (city: City) => void;
  theme: 'dark' | 'light';
}

/**
 * Leaflet's stylesheet is only needed once the map is rendered. Loading it here
 * (instead of a render-blocking <link> in _document) keeps the landing screen
 * free of a third-party CSS request.
 */
function ensureLeafletStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('leaflet-styles')) return;
  const link = document.createElement('link');
  link.id = 'leaflet-styles';
  link.rel = 'stylesheet';
  link.href = '/leaflet.css';
  document.head.appendChild(link);
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  city,
  pois,
  nearbyCities,
  onSelectCity,
  theme,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const radarTileLayerRef = useRef<any>(null);
  const radarHostRef = useRef<string>('https://tilecache.rainviewer.com');

  const [filter, setFilter] = useState<'all' | 'pois' | 'nearby'>('all');
  const [isMapReady, setIsMapReady] = useState(false);

  // RainViewer Radar State
  const [isRadarActive, setIsRadarActive] = useState(false);
  const [radarFrames, setRadarFrames] = useState<Array<{ time: number; path: string }>>([]);
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const [isPlayingRadar, setIsPlayingRadar] = useState(false);

  const isDark = theme === 'dark';

  // 1. Fetch RainViewer public API once on mount (100% free, no API key)
  useEffect(() => {
    let isMounted = true;
    const fetchRadar = async () => {
      try {
        const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        if (res.ok && isMounted) {
          const data = await res.json();
          radarHostRef.current = data.host || 'https://tilecache.rainviewer.com';
          const past = data.radar?.past || [];
          if (past.length > 0) {
            setRadarFrames(past);
            setCurrentFrameIdx(past.length - 1); // Default to the newest frame
          }
        }
      } catch (e) {
        console.warn('RainViewer fetch error:', e);
      }
    };
    fetchRadar();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Initialize Leaflet Map once and tear it down cleanly on unmount (zero memory leak)
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let isMounted = true;
    let localMap: any = null;

    const initMap = async () => {
      ensureLeafletStyles();
      const L = (await import('leaflet')).default;
      if (!isMounted || !mapContainerRef.current) return;

      // Clean container if it previously had a leaflet instance attached
      if ((mapContainerRef.current as any)._leaflet_id) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }

      const map = L.map(mapContainerRef.current, {
        center: [city.latitude, city.longitude],
        zoom: 12,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const markers = L.layerGroup().addTo(map);

      leafletMapRef.current = map;
      markersLayerRef.current = markers;
      localMap = map;
      setIsMapReady(true);
    };

    initMap();

    return () => {
      isMounted = false;
      setIsMapReady(false);
      if (localMap) {
        try {
          localMap.remove();
        } catch (e) {
          console.warn('Map cleanup error:', e);
        }
      }
      leafletMapRef.current = null;
      markersLayerRef.current = null;
      radarTileLayerRef.current = null;
    };
  }, []);

  // 3. Add / Update / Remove RainViewer Radar Layer dynamically
  useEffect(() => {
    if (!isMapReady || !leafletMapRef.current) return;
    const map = leafletMapRef.current;

    const updateRadar = async () => {
      const L = (await import('leaflet')).default;

      // Always remove previous radar layer first to prevent memory leak & stacking
      if (radarTileLayerRef.current) {
        try {
          map.removeLayer(radarTileLayerRef.current);
        } catch (e) {
          console.warn('Layer removal warning:', e);
        }
        radarTileLayerRef.current = null;
      }

      if (isRadarActive && radarFrames.length > 0) {
        const frame = radarFrames[currentFrameIdx];
        if (frame) {
          // Color scheme 2 = Universal Blue (Clean Apple Weather Aesthetic), smooth 1_1
          const tileUrl = `${radarHostRef.current}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
          const layer = L.tileLayer(tileUrl, {
            opacity: 0.72,
            zIndex: 40,
          });
          layer.addTo(map);
          radarTileLayerRef.current = layer;
        }
      }
    };

    updateRadar();
  }, [isMapReady, isRadarActive, currentFrameIdx, radarFrames]);

  // 4. Play / Pause Radar Loop Animation
  useEffect(() => {
    if (!isPlayingRadar || !isRadarActive || radarFrames.length === 0) return;

    const interval = setInterval(() => {
      setCurrentFrameIdx((prev) => (prev + 1) % radarFrames.length);
    }, 800);

    return () => clearInterval(interval);
  }, [isPlayingRadar, isRadarActive, radarFrames]);

  // 5. Update markers and view when city, pois, nearbyCities, or filter change
  useEffect(() => {
    if (!isMapReady || !leafletMapRef.current || !markersLayerRef.current) return;

    let isMounted = true;

    const updateLayers = async () => {
      const L = (await import('leaflet')).default;
      if (!isMounted || !leafletMapRef.current || !markersLayerRef.current) return;

      const map = leafletMapRef.current;
      const markersLayer = markersLayerRef.current;
      markersLayer.clearLayers();

      // 1. Central City Marker (Apple Blue Pulse)
      const centerIcon = L.divIcon({
        className: 'apple-center-marker',
        html: `
          <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 30px; height: 30px; border-radius: 50%; background: rgba(0, 113, 227, 0.25); animation: applePulse 2.4s infinite cubic-bezier(0.45, 0, 0.55, 1);"></div>
            <div style="width: 14px; height: 14px; border-radius: 50%; background: #0071e3; border: 2.5px solid #ffffff; box-shadow: 0 2px 8px rgba(0, 113, 227, 0.5);"></div>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const centerMarker = L.marker([city.latitude, city.longitude], { icon: centerIcon });
      centerMarker.bindPopup(`
        <div style="font-family: -apple-system, sans-serif; padding: 2px;">
          <h4 style="margin: 0; font-size: 14px; font-weight: 600; color: #1d1d1f;">${city.name}</h4>
          <p style="margin: 2px 0 0 0; font-size: 11px; color: #86868b;">${city.admin1}, ${city.country}</p>
        </div>
      `);
      markersLayer.addLayer(centerMarker);

      // 2. POIs Markers (Soft Lavender Pin)
      if (filter === 'all' || filter === 'pois') {
        const poiIcon = L.divIcon({
          className: 'apple-poi-marker',
          html: `
            <div style="width: 24px; height: 24px; border-radius: 12px; background: #8b5cf6; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.12); font-size: 11px;">
              🏛️
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        pois.forEach((poi) => {
          const marker = L.marker([poi.lat, poi.lon], { icon: poiIcon });
          marker.bindPopup(`
            <div style="font-family: -apple-system, sans-serif; max-width: 200px; padding: 2px;">
              ${
                poi.thumbnail
                  ? `<img src="${poi.thumbnail}" style="width: 100%; height: 80px; object-fit: cover; border-radius: 10px; margin-bottom: 6px;" />`
                  : ''
              }
              <h5 style="margin: 0; font-size: 13px; font-weight: 600; color: #1d1d1f;">${poi.title}</h5>
              <p style="margin: 3px 0; font-size: 11px; color: #86868b;">${poi.distFormatted}</p>
              ${
                poi.url
                  ? `<a href="${poi.url}" target="_blank" rel="noopener noreferrer" style="color: #0071e3; font-size: 11px; text-decoration: none; font-weight: 500;">Ver na Wikipédia →</a>`
                  : ''
              }
            </div>
          `);
          markersLayer.addLayer(marker);
        });
      }

      // 3. Nearby Cities Markers (Soft Mint Pin)
      if (filter === 'all' || filter === 'nearby') {
        const nearbyIcon = L.divIcon({
          className: 'apple-nearby-marker',
          html: `
            <div style="width: 24px; height: 24px; border-radius: 12px; background: #10b981; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.12); font-size: 11px;">
              📍
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        nearbyCities.forEach((nc, idx) => {
          const marker = L.marker([nc.latitude, nc.longitude], { icon: nearbyIcon });
          const popupContent = document.createElement('div');
          popupContent.style.fontFamily = '-apple-system, sans-serif';
          popupContent.style.padding = '2px';

          popupContent.innerHTML = `
            <h5 style="margin: 0; font-size: 13px; font-weight: 600; color: #1d1d1f;">${nc.name}</h5>
            <p style="margin: 2px 0 8px 0; font-size: 11px; color: #86868b;">${nc.distanceKm} km • ${nc.region}</p>
            <button id="btn-explore-map-${idx}" style="background: #eef5ff; color: #0071e3; border: none; padding: 5px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; cursor: pointer; width: 100%;">
              Explorar Cidade
            </button>
          `;

          marker.bindPopup(popupContent);
          marker.on('popupopen', () => {
            const btn = document.getElementById(`btn-explore-map-${idx}`);
            if (btn) {
              btn.onclick = () => {
                onSelectCity({
                  id: nc.id || Math.round(nc.latitude * 1000 + nc.longitude * 1000),
                  name: nc.name,
                  latitude: nc.latitude,
                  longitude: nc.longitude,
                  elevation: 0,
                  country: nc.country,
                  countryCode: nc.countryCode,
                  admin1: nc.region,
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
                  population: nc.population || 0,
                });
              };
            }
          });

          markersLayer.addLayer(marker);
        });
      }

      map.setView([city.latitude, city.longitude], 12, { animate: true });
    };

    updateLayers();

    return () => {
      isMounted = false;
    };
  }, [isMapReady, city.latitude, city.longitude, city.name, pois, nearbyCities, filter, onSelectCity]);

  // Formatted Frame Time label
  const formattedFrameTime = useMemo(() => {
    if (radarFrames.length === 0 || !radarFrames[currentFrameIdx]) return '--:--';
    const date = new Date(radarFrames[currentFrameIdx].time * 1000);
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (currentFrameIdx === radarFrames.length - 1) {
      return `Agora (${timeStr})`;
    }
    return timeStr;
  }, [radarFrames, currentFrameIdx]);

  return (
    <View style={styles.container}>
      <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
        {/* Header with Segmented Filter Control & Radar Toggle */}
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Map size={16} color={isDark ? '#64b5f6' : '#0071e3'} />
            <Text style={[styles.cardTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              Mapa da Região
            </Text>
          </View>

          {/* Right Controls Row: Segmented Filters + Rain Radar Toggle */}
          <View style={styles.controlsRow}>
            {/* Radar Toggle Button */}
            <TouchableOpacity
              style={[
                styles.radarToggleBtn,
                isRadarActive
                  ? (isDark ? styles.radarActiveDark : styles.radarActiveLight)
                  : (isDark ? styles.radarInactiveDark : styles.radarInactiveLight),
              ]}
              onPress={() => {
                setIsRadarActive((prev) => !prev);
                if (!isRadarActive) {
                  setIsPlayingRadar(true);
                } else {
                  setIsPlayingRadar(false);
                }
              }}
              activeOpacity={0.75}
            >
              <CloudRain size={13} color={isRadarActive ? '#0071e3' : (isDark ? '#a1a1a6' : '#6e6e73')} />
              <Text
                style={[
                  styles.radarToggleText,
                  isRadarActive
                    ? styles.radarActiveText
                    : (isDark ? styles.textSecondaryDark : styles.textSecondaryLight),
                ]}
              >
                Radar de Chuva
              </Text>
            </TouchableOpacity>

            {/* Apple Segmented Control */}
            <View style={[styles.segmentedWrapper, isDark ? styles.segmentedDark : styles.segmentedLight]}>
              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  filter === 'all' && (isDark ? styles.segmentActiveDark : styles.segmentActiveLight),
                ]}
                onPress={() => setFilter('all')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.segmentText,
                    filter === 'all'
                      ? (isDark ? styles.textPrimaryDark : styles.textPrimaryLight)
                      : (isDark ? styles.textSecondaryDark : styles.textSecondaryLight),
                  ]}
                >
                  Todos
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  filter === 'pois' && (isDark ? styles.segmentActiveDark : styles.segmentActiveLight),
                ]}
                onPress={() => setFilter('pois')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.segmentText,
                    filter === 'pois'
                      ? (isDark ? styles.textPrimaryDark : styles.textPrimaryLight)
                      : (isDark ? styles.textSecondaryDark : styles.textSecondaryLight),
                  ]}
                >
                  Atrações ({pois.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  filter === 'nearby' && (isDark ? styles.segmentActiveDark : styles.segmentActiveLight),
                ]}
                onPress={() => setFilter('nearby')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.segmentText,
                    filter === 'nearby'
                      ? (isDark ? styles.textPrimaryDark : styles.textPrimaryLight)
                      : (isDark ? styles.textSecondaryDark : styles.textSecondaryLight),
                  ]}
                >
                  Vizinhas ({nearbyCities.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Map Container View with Floating Radar Controls */}
        <View style={styles.mapFrame}>
          <div
            ref={mapContainerRef}
            style={{
              width: '100%',
              height: '400px',
              borderRadius: '18px',
              overflow: 'hidden',
            }}
          />

          {/* Floating Radar Glass Pill Bar (Visible when Radar is Active) */}
          {isRadarActive && radarFrames.length > 0 && (
            <View style={[styles.floatingRadarBar, isDark ? styles.radarBarDark : styles.radarBarLight]}>
              {/* Play / Pause Button */}
              <TouchableOpacity
                style={styles.radarPlayBtn}
                onPress={() => setIsPlayingRadar((prev) => !prev)}
                activeOpacity={0.8}
              >
                {isPlayingRadar ? (
                  <Pause size={12} color="#ffffff" fill="#ffffff" />
                ) : (
                  <Play size={12} color="#ffffff" fill="#ffffff" />
                )}
              </TouchableOpacity>

              {/* Time display */}
              <View style={styles.radarTimeBadge}>
                <Clock size={11} color={isDark ? '#64b5f6' : '#0071e3'} />
                <Text style={[styles.radarTimeText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                  {formattedFrameTime}
                </Text>
              </View>

              {/* Frame Timeline Dots */}
              <View style={styles.radarDotsContainer}>
                {radarFrames.map((_, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.radarDot,
                      idx === currentFrameIdx && styles.radarDotActive,
                      isDark ? styles.radarDotDark : styles.radarDotLight,
                    ]}
                    onPress={() => setCurrentFrameIdx(idx)}
                    activeOpacity={0.7}
                  />
                ))}
              </View>

              {/* Radar Intensity Color Strip */}
              <View style={styles.legendWrap}>
                <Text style={[styles.legendLabel, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                  Intensidade:
                </Text>
                <div
                  style={{
                    width: '54px',
                    height: '6px',
                    borderRadius: '3px',
                    background: 'linear-gradient(to right, #00b0ff, #00e676, #ffea00, #ff1744)',
                  }}
                />
              </View>
            </View>
          )}
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
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  radarToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  radarActiveLight: {
    backgroundColor: '#eef5ff',
    borderColor: '#0071e3',
    borderWidth: 1,
  },
  radarActiveDark: {
    backgroundColor: 'rgba(10, 132, 255, 0.2)',
    borderColor: '#64b5f6',
    borderWidth: 1,
  },
  radarInactiveLight: {
    backgroundColor: '#f0f0f2',
  },
  radarInactiveDark: {
    backgroundColor: '#2c2c2e',
  },
  radarToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  radarActiveText: {
    color: '#0071e3',
  },
  segmentedWrapper: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: 14,
  },
  segmentedLight: {
    backgroundColor: '#f0f0f2',
  },
  segmentedDark: {
    backgroundColor: '#2c2c2e',
  },
  segmentBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  segmentActiveLight: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  segmentActiveDark: {
    backgroundColor: '#3a3a3c',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '500',
  },
  mapFrame: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  floatingRadarBar: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
    zIndex: 500,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    flexWrap: 'wrap',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  radarBarLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  radarBarDark: {
    backgroundColor: 'rgba(28, 28, 30, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  radarPlayBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0071e3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  radarTimeText: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  radarDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  radarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  radarDotLight: {
    backgroundColor: '#c7c7cc',
  },
  radarDotDark: {
    backgroundColor: '#48484a',
  },
  radarDotActive: {
    width: 14,
    backgroundColor: '#0071e3',
  },
  legendWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendLabel: {
    fontSize: 10,
    fontWeight: '500',
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

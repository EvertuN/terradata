import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Map, Layers, Landmark, Compass } from 'lucide-react';
import { City, PointOfInterest, NearbyCity } from '../types';

interface InteractiveMapProps {
  city: City;
  pois: PointOfInterest[];
  nearbyCities: NearbyCity[];
  onSelectCity: (city: City) => void;
  theme: 'dark' | 'light';
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
  const [filter, setFilter] = useState<'all' | 'pois' | 'nearby'>('all');

  const isDark = theme === 'dark';

  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let isMounted = true;

    const initMap = async () => {
      const L = (await import('leaflet')).default;

      if (!leafletMapRef.current && mapContainerRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [city.latitude, city.longitude],
          zoom: 12,
          zoomControl: true,
          attributionControl: true,
        });

        // CartoDB Voyager tile layer for Apple Maps look and feel
        const tileLayerUrl = isDark
          ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

        L.tileLayer(tileLayerUrl, {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        leafletMapRef.current = map;
        markersLayerRef.current = L.layerGroup().addTo(map);
      }

      if (!isMounted || !leafletMapRef.current) return;

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

    initMap();

    return () => {
      isMounted = false;
    };
  }, [city, pois, nearbyCities, filter, isDark]);

  return (
    <View style={styles.container}>
      <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
        {/* Header with Segmented Filter Control */}
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Map size={16} color={isDark ? '#64b5f6' : '#0071e3'} />
            <Text style={[styles.cardTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              Mapa da Região
            </Text>
          </View>

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

        {/* Map Container View */}
        <View style={styles.mapFrame}>
          <div
            ref={mapContainerRef}
            style={{
              width: '100%',
              height: '380px',
              borderRadius: '18px',
              overflow: 'hidden',
            }}
          />
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

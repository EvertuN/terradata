import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import {
  Users,
  Mountain,
  Compass,
  Clock,
  ExternalLink,
  Copy,
  Check,
  MapPin,
  Camera,
} from 'lucide-react';
import { City, CitySummary } from '../types';
import { formatNumberBR } from '../services/utils';
import { LazyImage } from './LazyImage';

interface HeroBannerProps {
  city: City;
  summary: CitySummary | null;
  theme: 'dark' | 'light';
  onNotify?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onOpenSnapshot?: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  city,
  summary,
  theme,
  onNotify,
  onOpenSnapshot,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [copiedCoords, setCopiedCoords] = useState(false);
  const copyTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const updateClock = () => {
      try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('pt-BR', {
          timeZone: city.timezone || 'UTC',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });
        setCurrentTime(formatter.format(now));
      } catch {
        const now = new Date();
        setCurrentTime(now.toLocaleTimeString('pt-BR'));
      }
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [city.timezone]);

  const handleCopyCoordinates = () => {
    const coords = `${city.latitude.toFixed(4)}, ${city.longitude.toFixed(4)}`;
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(coords);
      setCopiedCoords(true);
      if (onNotify) {
        onNotify(`Coordenadas ${coords} copiadas`, 'success');
      }
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopiedCoords(false), 2000);
    }
  };

  const isDark = theme === 'dark';
  const photoUrl = summary?.bannerImage || summary?.thumbnail;

  return (
    <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
      <View style={styles.contentRow}>
        {/* Left Column: City Info, Live Time & Pastel Badges */}
        <View style={styles.leftCol}>
          {/* Top Line: Flag & Region Pill */}
          <View style={styles.topPillRow}>
            <View style={[styles.regionPill, isDark ? styles.regionPillDark : styles.regionPillLight]}>
              <MapPin size={12} color={isDark ? '#64b5f6' : '#0071e3'} />
              <Text style={[styles.regionText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                {[city.admin1, city.country].filter(Boolean).join(' • ')}
              </Text>
            </View>

            {/* Time Pill */}
            <View style={[styles.timePill, isDark ? styles.timePillDark : styles.timePillLight]}>
              <Clock size={12} color={isDark ? '#64b5f6' : '#0071e3'} />
              <Text style={[styles.timeText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                {currentTime || '--:--'}
              </Text>
            </View>

            {/* Snapshot Story Button */}
            {onOpenSnapshot && (
              <TouchableOpacity
                style={[styles.actionPill, isDark ? styles.actionPillDark : styles.actionPillLight]}
                onPress={onOpenSnapshot}
                activeOpacity={0.7}
              >
                <Camera size={12} color={isDark ? '#64b5f6' : '#0071e3'} />
                <Text style={[styles.actionPillText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                  Snapshot
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Large Clean City Heading */}
          <Text style={[styles.cityName, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
            {city.name}
          </Text>

          {/* Wikipedia Extract (Editorial Snippet) */}
          {summary?.extract ? (
            <Text
              style={[styles.wikiSnippet, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}
              numberOfLines={2}
            >
              {summary.extract}
            </Text>
          ) : null}

          {/* Clean Editorial Stats Strip (Anti-AI-Slop: No Pill Soup) */}
          <View style={styles.statsStrip}>
            {/* Population */}
            <View style={styles.statItem}>
              <Users size={13} color={isDark ? '#93c5fd' : '#2563eb'} />
              <Text style={[styles.statValue, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                {city.population > 0 ? `${formatNumberBR(city.population)} hab.` : 'Metrópole'}
              </Text>
            </View>

            <Text style={styles.dotSeparator}>•</Text>

            {/* Elevation */}
            <View style={styles.statItem}>
              <Mountain size={13} color={isDark ? '#a1a1a6' : '#6e6e73'} />
              <Text style={[styles.statValue, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                {city.elevation ? `${Math.round(city.elevation)} m` : 'Nível do mar'}
              </Text>
            </View>

            <Text style={styles.dotSeparator}>•</Text>

            {/* Coordinates with copy */}
            <TouchableOpacity
              style={styles.statItem}
              onPress={handleCopyCoordinates}
              activeOpacity={0.65}
            >
              <Compass size={13} color={isDark ? '#a1a1a6' : '#6e6e73'} />
              <Text style={[styles.statValue, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                {city.latitude.toFixed(2)}°, {city.longitude.toFixed(2)}°
              </Text>
              {copiedCoords ? (
                <Check size={12} color="#10b981" />
              ) : (
                <Copy size={11} color={isDark ? '#71717a' : '#a1a1a6'} />
              )}
            </TouchableOpacity>

            {summary?.url ? (
              <>
                <Text style={styles.dotSeparator}>•</Text>
                <TouchableOpacity
                  style={styles.statItem}
                  onPress={() => Linking.openURL(summary.url)}
                  activeOpacity={0.65}
                >
                  <Text style={styles.linkText}>Wikipédia</Text>
                  <ExternalLink size={11} color={isDark ? '#64b5f6' : '#0071e3'} />
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>

        {/* Right Column: Refined City Photograph */}
        {photoUrl ? (
          <View style={styles.photoContainer}>
            <LazyImage src={photoUrl} alt={city.name} eager />
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 24,
  },
  leftCol: {
    flex: 1,
    minWidth: 260,
    gap: 12,
  },
  topPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  regionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  regionPillLight: {
    backgroundColor: '#f5f5f7',
  },
  regionPillDark: {
    backgroundColor: '#2c2c2e',
  },
  flagText: {
    fontSize: 13,
  },
  regionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  timePillLight: {
    backgroundColor: '#eef5ff',
  },
  timePillDark: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  actionPillLight: {
    backgroundColor: '#f5f5f7',
  },
  actionPillDark: {
    backgroundColor: '#2c2c2e',
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cityName: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  wikiSnippet: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
  },
  statsStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  dotSeparator: {
    fontSize: 12,
    color: '#86868b',
    opacity: 0.6,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0071e3',
  },
  badgeBlueLight: {
    backgroundColor: '#eef5ff',
  },
  badgeBlueDark: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
  },
  badgeTextBlueLight: {
    color: '#0071e3',
  },
  badgeTextBlueDark: {
    color: '#64b5f6',
  },
  badgeMintLight: {
    backgroundColor: '#eef9f2',
  },
  badgeMintDark: {
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
  },
  badgeTextMintLight: {
    color: '#10b981',
  },
  badgeTextMintDark: {
    color: '#81c784',
  },
  badgePurpleLight: {
    backgroundColor: '#f5f3ff',
  },
  badgePurpleDark: {
    backgroundColor: 'rgba(191, 90, 242, 0.15)',
  },
  badgeTextPurpleLight: {
    color: '#8b5cf6',
  },
  badgeTextPurpleDark: {
    color: '#ba68c8',
  },
  badgeNeutralLight: {
    backgroundColor: '#f5f5f7',
  },
  badgeNeutralDark: {
    backgroundColor: '#2c2c2e',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  photoContainer: {
    width: 220,
    height: 140,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  cityPhoto: {
    width: '100%',
    height: '100%',
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

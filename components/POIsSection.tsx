import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { Landmark, MapPin, ExternalLink } from 'lucide-react';
import { PointOfInterest } from '../types';

interface POIsSectionProps {
  pois: PointOfInterest[];
  theme: 'dark' | 'light';
}

export const POIsSection: React.FC<POIsSectionProps> = ({ pois, theme }) => {
  if (!pois || pois.length === 0) return null;

  const isDark = theme === 'dark';

  return (
    <View style={styles.container}>
      <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
        {/* Section Header */}
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Landmark size={16} color={isDark ? '#ba68c8' : '#8b5cf6'} />
            <Text style={[styles.cardTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              Pontos de Interesse
            </Text>
          </View>
          <View style={[styles.countBadge, isDark ? styles.badgePurpleDark : styles.badgePurpleLight]}>
            <Text style={[styles.countText, isDark ? styles.textPurpleDark : styles.textPurpleLight]}>
              {pois.length} locais
            </Text>
          </View>
        </View>

        {/* POI Clean Cards Grid */}
        <View style={styles.grid}>
          {pois.map((poi) => (
            <View
              key={poi.pageId}
              style={[styles.poiCard, isDark ? styles.poiCardDark : styles.poiCardLight]}
            >
              {/* Photo or Placeholder */}
              <View style={styles.imageContainer}>
                {poi.thumbnail ? (
                  <Image source={{ uri: poi.thumbnail }} style={styles.image} resizeMode="cover" />
                ) : (
                  <View style={[styles.placeholderImage, isDark ? styles.placeholderDark : styles.placeholderLight]}>
                    <Landmark size={22} color="#86868b" />
                  </View>
                )}
                {/* Distance Badge in Soft Apple Blur style */}
                <View style={styles.distanceBadge}>
                  <Text style={styles.distanceText}>{poi.distFormatted}</Text>
                </View>
              </View>

              {/* Body */}
              <View style={styles.infoBody}>
                <Text
                  style={[styles.poiTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}
                  numberOfLines={1}
                >
                  {poi.title}
                </Text>
                <Text
                  style={[styles.poiExtract, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}
                  numberOfLines={2}
                >
                  {poi.extract || 'Ponto histórico e cultural de destaque na cidade.'}
                </Text>

                {poi.url ? (
                  <TouchableOpacity
                    style={styles.actionPill}
                    onPress={() => Linking.openURL(poi.url)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionText}>Wikipédia</Text>
                    <ExternalLink size={11} color="#0071e3" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))}
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
  badgePurpleLight: {
    backgroundColor: '#f5f3ff',
  },
  badgePurpleDark: {
    backgroundColor: 'rgba(191, 90, 242, 0.15)',
  },
  countText: {
    fontSize: 11,
    fontWeight: '600',
  },
  textPurpleLight: {
    color: '#8b5cf6',
  },
  textPurpleDark: {
    color: '#ba68c8',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  poiCard: {
    flex: 1,
    minWidth: 240,
    maxWidth: 380,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  poiCardLight: {
    backgroundColor: '#f5f5f7',
    borderColor: 'transparent',
  },
  poiCardDark: {
    backgroundColor: '#2c2c2e',
    borderColor: 'transparent',
  },
  imageContainer: {
    width: '100%',
    height: 130,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderLight: {
    backgroundColor: '#e5e5ea',
  },
  placeholderDark: {
    backgroundColor: '#3a3a3c',
  },
  distanceBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(29, 29, 31, 0.72)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  distanceText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  infoBody: {
    padding: 14,
    gap: 4,
  },
  poiTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  poiExtract: {
    fontSize: 12,
    lineHeight: 17,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0071e3',
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

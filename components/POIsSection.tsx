import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { Landmark, ExternalLink, Star, Camera } from 'lucide-react';
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
            <Landmark size={16} color={isDark ? '#64b5f6' : '#0071e3'} />
            <Text style={[styles.cardTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              Pontos de Interesse
            </Text>
          </View>
          <View style={[styles.countBadge, isDark ? styles.countBadgeDark : styles.countBadgeLight]}>
            <Text style={[styles.countText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              {pois.length} locais
            </Text>
          </View>
        </View>

        {/* POI Clean Cards Grid */}
        <View style={styles.grid}>
          {pois.map((poi, idx) => {
            const mapsUrl =
              poi.mapsUrl ||
              poi.url ||
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(poi.title)}`;

            return (
              <View
                key={`${poi.pageId}-${idx}`}
                style={[styles.poiCard, isDark ? styles.poiCardDark : styles.poiCardLight]}
              >
                {/* Photo: Real photo from Wikipedia/Wikidata or Direct Google Maps Photos Action */}
                <View style={styles.imageContainer}>
                  {poi.thumbnail ? (
                    <Image source={{ uri: poi.thumbnail }} style={styles.image} resizeMode="cover" />
                  ) : (
                    <TouchableOpacity
                      style={[styles.placeholderImage, isDark ? styles.placeholderDark : styles.placeholderLight]}
                      onPress={() => Linking.openURL(mapsUrl)}
                      activeOpacity={0.75}
                    >
                      <Camera size={24} color={isDark ? '#64b5f6' : '#0071e3'} />
                      <Text style={[styles.mapsBtnText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                        Ver fotos no Google Maps
                      </Text>
                      <ExternalLink size={12} color={isDark ? '#64b5f6' : '#0071e3'} />
                    </TouchableOpacity>
                  )}

                  {/* Category Badge */}
                  {poi.category && (
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>{poi.category}</Text>
                    </View>
                  )}

                  {/* Distance Badge in Soft Apple Blur style */}
                  <View style={styles.distanceBadge}>
                    <Text style={styles.distanceText}>{poi.distFormatted}</Text>
                  </View>
                </View>

                {/* Body */}
                <View style={styles.infoBody}>
                  {/* Rating & Reviews */}
                  <View style={styles.ratingRow}>
                    <Star size={13} color="#f59e0b" fill="#f59e0b" />
                    <Text style={[styles.ratingScore, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                      {poi.rating || 4.8}
                    </Text>
                    <Text style={[styles.reviewsCount, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                      ({poi.reviewsCount || '2.5k avaliações'})
                    </Text>
                  </View>

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
                    {poi.extract || 'Ponto histórico e cultural de grande destaque e alta visitação.'}
                  </Text>

                  <TouchableOpacity
                    style={[styles.actionPill, isDark ? styles.actionPillDark : styles.actionPillLight]}
                    onPress={() => Linking.openURL(mapsUrl)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.actionText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                      Ver no Google Maps
                    </Text>
                    <ExternalLink size={11} color={isDark ? '#64b5f6' : '#0071e3'} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
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
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
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
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  countBadgeLight: {
    backgroundColor: '#f0f0f2',
  },
  countBadgeDark: {
    backgroundColor: '#2c2c2e',
  },
  countText: {
    fontSize: 11,
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  poiCard: {
    flex: 1,
    minWidth: 260,
    maxWidth: '100%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
  },
  poiCardLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  poiCardDark: {
    backgroundColor: '#262629',
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  imageContainer: {
    width: '100%',
    height: 150,
    position: 'relative',
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
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
    padding: 16,
    gap: 8,
  },
  placeholderLight: {
    backgroundColor: '#f5f8ff',
  },
  placeholderDark: {
    backgroundColor: '#1a2233',
  },
  mapsBtnText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  categoryText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  distanceBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  distanceText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  infoBody: {
    padding: 14,
    gap: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingScore: {
    fontSize: 12,
    fontWeight: '700',
  },
  reviewsCount: {
    fontSize: 11,
  },
  poiTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  poiExtract: {
    fontSize: 12,
    lineHeight: 16,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  actionPillLight: {
    backgroundColor: '#eef5ff',
  },
  actionPillDark: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
  },
  actionText: {
    fontSize: 11,
    fontWeight: '600',
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

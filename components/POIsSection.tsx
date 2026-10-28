import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { Landmark, ExternalLink, Star } from 'lucide-react';
import { PointOfInterest } from '../types';
import { LazyImage } from './LazyImage';

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
                {/* Real photo from Wikipedia/Wikidata (only rendered if it exists) */}
                {poi.thumbnail ? (
                  <View style={styles.imageContainer}>
                    <LazyImage src={poi.thumbnail} alt={poi.title} />

                    {/* Category Badge on photo */}
                    {poi.category && (
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>{poi.category}</Text>
                      </View>
                    )}

                    {/* Distance Badge on photo */}
                    <View style={styles.distanceBadge}>
                      <Text style={styles.distanceText}>{poi.distFormatted}</Text>
                    </View>
                  </View>
                ) : null}

                {/* Body: Adapts cleanly whether there's a photo or not */}
                <View style={styles.infoBody}>
                  {/* Inline header for cards without a photo banner */}
                  {!poi.thumbnail ? (
                    <View style={styles.inlineHeaderRow}>
                      {poi.category ? (
                        <View style={[styles.inlineCategoryBadge, isDark ? styles.inlineBadgeDark : styles.inlineBadgeLight]}>
                          <Text style={[styles.inlineCategoryText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                            {poi.category}
                          </Text>
                        </View>
                      ) : null}
                      <Text style={[styles.inlineDistanceText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                        {poi.distFormatted}
                      </Text>
                    </View>
                  ) : null}

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
                      Ver no mapa
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
  inlineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  inlineCategoryBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  inlineBadgeLight: {
    backgroundColor: '#f0f0f2',
  },
  inlineBadgeDark: {
    backgroundColor: '#3a3a3c',
  },
  inlineCategoryText: {
    fontSize: 10,
    fontWeight: '600',
  },
  inlineDistanceText: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
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

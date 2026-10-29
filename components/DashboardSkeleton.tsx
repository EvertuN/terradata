import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';

interface DashboardSkeletonProps {
  theme: 'dark' | 'light';
  activeTab?: 'all' | 'weather' | 'air' | 'map' | 'pois' | 'nearby';
}

const SkeletonBox: React.FC<{
  isDark: boolean;
  style?: any;
}> = ({ isDark, style }) => (
  <View
    style={[
      styles.skeletonBase,
      isDark ? styles.skeletonDark : styles.skeletonLight,
      style,
    ]}
    {...({ className: 'td-skeleton-box' } as any)}
  />
);

export const DashboardSkeleton: React.FC<DashboardSkeletonProps> = ({
  theme,
  activeTab = 'all',
}) => {
  const isDark = theme === 'dark';
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;

  return (
    <View style={styles.container}>
      {/* 1. Hero Banner Skeleton */}
      <View style={[styles.card, cardStyle, styles.heroCard]}>
        <View style={styles.heroLeft}>
          {/* Top Metadata Pills */}
          <View style={styles.rowPills}>
            <SkeletonBox isDark={isDark} style={{ width: 110, height: 26, borderRadius: 13 }} />
            <SkeletonBox isDark={isDark} style={{ width: 75, height: 26, borderRadius: 13 }} />
            <SkeletonBox isDark={isDark} style={{ width: 85, height: 26, borderRadius: 13 }} />
          </View>

          {/* City Name Title Skeleton */}
          <SkeletonBox isDark={isDark} style={{ width: 240, height: 38, borderRadius: 10, marginTop: 14 }} />

          {/* Wikipedia Extract 2 Lines Skeleton */}
          <View style={{ marginTop: 14, gap: 8 }}>
            <SkeletonBox isDark={isDark} style={{ width: '92%', height: 14, borderRadius: 6 }} />
            <SkeletonBox isDark={isDark} style={{ width: '68%', height: 14, borderRadius: 6 }} />
          </View>

          {/* Stats Strip Skeleton */}
          <View style={[styles.rowPills, { marginTop: 18 }]}>
            <SkeletonBox isDark={isDark} style={{ width: 110, height: 20, borderRadius: 6 }} />
            <SkeletonBox isDark={isDark} style={{ width: 80, height: 20, borderRadius: 6 }} />
            <SkeletonBox isDark={isDark} style={{ width: 130, height: 20, borderRadius: 6 }} />
          </View>
        </View>

        {/* Right City Photo Skeleton */}
        <View style={styles.heroRight}>
          <SkeletonBox isDark={isDark} style={styles.photoSkeleton} />
        </View>
      </View>

      {/* 2. Weather Section Skeleton (shown for 'all' and 'weather') */}
      {(activeTab === 'all' || activeTab === 'weather') && (
        <View style={styles.sectionWrap}>
          {/* Current Weather Card */}
          <View style={[styles.card, cardStyle]}>
            <SkeletonBox isDark={isDark} style={{ width: 100, height: 14, borderRadius: 4, marginBottom: 8 }} />
            <SkeletonBox isDark={isDark} style={{ width: 140, height: 26, borderRadius: 6, marginBottom: 16 }} />

            {/* Large Temperature Display Skeleton */}
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
              <SkeletonBox isDark={isDark} style={{ width: 130, height: 56, borderRadius: 12 }} />
              <SkeletonBox isDark={isDark} style={{ width: 100, height: 16, borderRadius: 6 }} />
            </View>

            {/* 4 Metric Cards Grid */}
            <View style={styles.metricsGrid}>
              <SkeletonBox isDark={isDark} style={styles.metricCardSkeleton} />
              <SkeletonBox isDark={isDark} style={styles.metricCardSkeleton} />
              <SkeletonBox isDark={isDark} style={styles.metricCardSkeleton} />
              <SkeletonBox isDark={isDark} style={styles.metricCardSkeleton} />
            </View>
          </View>

          {/* Hourly Forecast 24h Card Skeleton */}
          <View style={[styles.card, cardStyle, { marginTop: 16 }]}>
            <SkeletonBox isDark={isDark} style={{ width: 150, height: 16, borderRadius: 4, marginBottom: 16 }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {Array.from({ length: 8 }).map((_, idx) => (
                <SkeletonBox
                  key={idx}
                  isDark={isDark}
                  style={{ width: 68, height: 100, borderRadius: 18 }}
                />
              ))}
            </ScrollView>
          </View>

          {/* Smart Day Insights Skeleton */}
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 16, flexWrap: 'wrap' }}>
            <View style={[styles.card, cardStyle, { flex: 1, minWidth: 260, height: 120 }]}>
              <SkeletonBox isDark={isDark} style={{ width: 140, height: 16, borderRadius: 6, marginBottom: 12 }} />
              <SkeletonBox isDark={isDark} style={{ width: '85%', height: 14, borderRadius: 4, marginBottom: 8 }} />
              <SkeletonBox isDark={isDark} style={{ width: '60%', height: 14, borderRadius: 4 }} />
            </View>
            <View style={[styles.card, cardStyle, { flex: 1, minWidth: 260, height: 120 }]}>
              <SkeletonBox isDark={isDark} style={{ width: 120, height: 16, borderRadius: 6, marginBottom: 12 }} />
              <SkeletonBox isDark={isDark} style={{ width: '85%', height: 14, borderRadius: 4, marginBottom: 8 }} />
              <SkeletonBox isDark={isDark} style={{ width: '50%', height: 14, borderRadius: 4 }} />
            </View>
          </View>
        </View>
      )}

      {/* 3. Air Quality Section Skeleton */}
      {(activeTab === 'all' || activeTab === 'air') && (
        <View style={[styles.card, cardStyle, { marginTop: 16 }]}>
          <SkeletonBox isDark={isDark} style={{ width: 140, height: 16, borderRadius: 4, marginBottom: 16 }} />
          <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <SkeletonBox isDark={isDark} style={{ width: 120, height: 120, borderRadius: 60 }} />
            <View style={{ flex: 1, minWidth: 200, gap: 10 }}>
              <SkeletonBox isDark={isDark} style={{ width: '70%', height: 18, borderRadius: 6 }} />
              <SkeletonBox isDark={isDark} style={{ width: '90%', height: 14, borderRadius: 4 }} />
              <SkeletonBox isDark={isDark} style={{ width: '50%', height: 14, borderRadius: 4 }} />
            </View>
          </View>
        </View>
      )}

      {/* 4. Interactive Map Skeleton */}
      {(activeTab === 'all' || activeTab === 'map') && (
        <View style={[styles.card, cardStyle, { marginTop: 16, height: 360, overflow: 'hidden' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
            <SkeletonBox isDark={isDark} style={{ width: 160, height: 18, borderRadius: 6 }} />
            <SkeletonBox isDark={isDark} style={{ width: 100, height: 28, borderRadius: 14 }} />
          </View>
          <SkeletonBox isDark={isDark} style={{ flex: 1, width: '100%', borderRadius: 18 }} />
        </View>
      )}

      {/* 5. Points of Interest Skeleton */}
      {(activeTab === 'all' || activeTab === 'pois') && (
        <View style={{ marginTop: 16 }}>
          <SkeletonBox isDark={isDark} style={{ width: 160, height: 18, borderRadius: 6, marginBottom: 14, marginLeft: 4 }} />
          <View style={styles.poisGrid}>
            {Array.from({ length: 4 }).map((_, idx) => (
              <View key={idx} style={[styles.card, cardStyle, styles.poiCardSkeleton]}>
                <SkeletonBox isDark={isDark} style={{ width: '100%', height: 130, borderRadius: 14, marginBottom: 12 }} />
                <SkeletonBox isDark={isDark} style={{ width: '75%', height: 16, borderRadius: 6, marginBottom: 8 }} />
                <SkeletonBox isDark={isDark} style={{ width: '45%', height: 12, borderRadius: 4 }} />
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 6. Nearby Cities Skeleton */}
      {(activeTab === 'all' || activeTab === 'nearby') && (
        <View style={{ marginTop: 16, marginBottom: 30 }}>
          <SkeletonBox isDark={isDark} style={{ width: 160, height: 18, borderRadius: 6, marginBottom: 14, marginLeft: 4 }} />
          <View style={styles.poisGrid}>
            {Array.from({ length: 4 }).map((_, idx) => (
              <View key={idx} style={[styles.card, cardStyle, { flex: 1, minWidth: 200, padding: 16 }]}>
                <SkeletonBox isDark={isDark} style={{ width: '60%', height: 16, borderRadius: 6, marginBottom: 8 }} />
                <SkeletonBox isDark={isDark} style={{ width: '40%', height: 12, borderRadius: 4 }} />
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: 24,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
  },
  cardLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.035,
    shadowRadius: 20,
    elevation: 2,
  },
  cardDark: {
    backgroundColor: '#1c1c1e',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 3,
  },
  skeletonBase: {
    overflow: 'hidden',
  },
  skeletonLight: {
    backgroundColor: '#e5e5ea',
  },
  skeletonDark: {
    backgroundColor: '#2c2c2e',
  },
  heroCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLeft: {
    flex: 1,
    minWidth: 280,
  },
  heroRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoSkeleton: {
    width: 220,
    height: 140,
    borderRadius: 18,
  },
  rowPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  sectionWrap: {
    width: '100%',
    marginTop: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCardSkeleton: {
    flex: 1,
    minWidth: 140,
    height: 68,
    borderRadius: 16,
  },
  poisGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  poiCardSkeleton: {
    flex: 1,
    minWidth: 220,
    maxWidth: 320,
    padding: 14,
  },
});

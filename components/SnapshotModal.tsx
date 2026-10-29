import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { X, Download, Copy, Check, Globe2, Sparkles, Wind } from 'lucide-react';
import { City, WeatherData, AirQualityData, CitySummary } from '../types';

interface SnapshotModalProps {
  visible: boolean;
  onClose: () => void;
  city: City;
  weather: WeatherData | null;
  airQuality: AirQualityData | null;
  summary: CitySummary | null;
  temperatureUnit: 'C' | 'F';
  theme: 'dark' | 'light';
  onNotify?: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export const SnapshotModal: React.FC<SnapshotModalProps> = ({
  visible,
  onClose,
  city,
  weather,
  airQuality,
  summary,
  temperatureUnit,
  theme,
  onNotify,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const isDark = theme === 'dark';

  const photoUrl = summary?.bannerImage || summary?.thumbnail;
  const temp = weather?.current?.temperature ?? 24;
  const aqiLabel = airQuality?.status?.label || 'Boa';
  const aqiVal = airQuality?.usAqi || airQuality?.europeanAqi || 22;

  // Canvas 1080x1920 PNG generator without heavy npm dependencies
  const handleDownloadImage = async () => {
    setIsExporting(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not create canvas context');

      // 1. Background Fill
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, 0, 1080, 1920);

      // 2. Draw Image if available
      if (photoUrl) {
        try {
          const img = new (window as any).Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve; // Continue on CORS error
            img.src = photoUrl;
          });
          if (img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, 0, 0, 1080, 1100);
          }
        } catch {
          // Fallback to gradient
        }
      }

      // 3. Cinematic Gradients
      const topGrad = ctx.createLinearGradient(0, 0, 0, 300);
      topGrad.addColorStop(0, 'rgba(0,0,0,0.7)');
      topGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, 1080, 300);

      const bottomGrad = ctx.createLinearGradient(0, 700, 0, 1920);
      bottomGrad.addColorStop(0, 'rgba(10,10,12,0)');
      bottomGrad.addColorStop(0.35, 'rgba(10,10,12,0.92)');
      bottomGrad.addColorStop(1, '#0a0a0c');
      ctx.fillStyle = bottomGrad;
      ctx.fillRect(0, 700, 1080, 1220);

      // 4. Header: TerraData Brand
      ctx.font = '700 36px -apple-system, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('TerraData', 80, 120);

      ctx.font = '400 24px -apple-system, sans-serif';
      ctx.fillStyle = '#a1a1a6';
      const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
      ctx.fillText(dateStr, 80, 160);

      // 5. City Name & Region
      ctx.font = '800 84px -apple-system, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(city.name, 80, 1180);

      ctx.font = '500 36px -apple-system, sans-serif';
      ctx.fillStyle = '#64b5f6';
      ctx.fillText([city.admin1, city.country].filter(Boolean).join(' • '), 80, 1240);

      // 6. Temperature & Weather
      ctx.font = '800 130px -apple-system, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${temp}°${temperatureUnit}`, 80, 1390);

      ctx.font = '500 34px -apple-system, sans-serif';
      ctx.fillStyle = '#a1a1a6';
      ctx.fillText(`Qualidade do ar: ${aqiLabel} (AQI ${aqiVal})`, 80, 1450);

      // 7. Wikipedia extract snippet
      if (summary?.extract) {
        ctx.font = '400 28px -apple-system, sans-serif';
        ctx.fillStyle = '#d1d1d6';
        const words = summary.extract.split(' ');
        let line = '';
        let y = 1530;
        for (const w of words) {
          const test = line + w + ' ';
          if (ctx.measureText(test).width > 920) {
            ctx.fillText(line, 80, y);
            line = w + ' ';
            y += 42;
            if (y > 1650) break;
          } else {
            line = test;
          }
        }
        if (y <= 1650) ctx.fillText(line, 80, y);
      }

      // 8. Footer Watermark
      ctx.font = '500 24px -apple-system, sans-serif';
      ctx.fillStyle = '#6e6e73';
      ctx.fillText('terradata.app • Geointeligência & Meteorologia', 80, 1830);

      // Export canvas to download
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `terradata-${city.name.toLowerCase().replace(/\s+/g, '-')}-snapshot.png`;
      a.click();

      if (onNotify) onNotify('Snapshot em alta resolução baixado!', 'success');
    } catch (e) {
      console.error('Error generating snapshot:', e);
      if (onNotify) onNotify('Erro ao gerar imagem para download', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (onNotify) onNotify('Link do snapshot copiado!', 'success');
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.backdrop}>
      <View style={[styles.modalCard, isDark ? styles.modalDark : styles.modalLight]}>
          {/* Top Bar with Close Button */}
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleWrap}>
              <Sparkles size={16} color="#0071e3" />
              <Text style={[styles.modalTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                Snapshot para Compartilhamento
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={18} color="#86868b" />
            </TouchableOpacity>
          </View>

          {/* 9:16 Vertical Card Preview */}
          <View style={styles.previewContainer}>
            <View style={styles.storyCard}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.cardImage} resizeMode="cover" />
              ) : (
                <View style={styles.fallbackBg} />
              )}

              {/* Top Vignette */}
              <View style={styles.topVignette}>
                <View style={styles.brandRow}>
                  <Globe2 size={14} color="#64b5f6" />
                  <Text style={styles.brandText}>TerraData</Text>
                </View>
                <Text style={styles.dateText}>
                  {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </Text>
              </View>

              {/* Bottom Vignette with Editorial Typography */}
              <View style={styles.bottomVignette}>
                <Text style={styles.storyCityName} numberOfLines={1}>
                  {city.name}
                </Text>
                <Text style={styles.storyRegion}>
                  {[city.admin1, city.country].filter(Boolean).join(' • ')}
                </Text>

                <View style={styles.tempRow}>
                  <Text style={styles.storyTemp}>
                    {temp}°{temperatureUnit}
                  </Text>
                  <View style={styles.aqiPill}>
                    <Wind size={11} color="#ffffff" />
                    <Text style={styles.aqiPillText}>Ar {aqiLabel}</Text>
                  </View>
                </View>

                {summary?.extract ? (
                  <Text style={styles.storyExtract} numberOfLines={2}>
                    {summary.extract}
                  </Text>
                ) : null}

                <Text style={styles.storyWatermark}>terradata.app</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons Row */}
          <View style={styles.actionsBar}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.downloadBtn]}
              onPress={handleDownloadImage}
              disabled={isExporting}
              activeOpacity={0.8}
            >
              <Download size={14} color="#ffffff" />
              <Text style={styles.downloadBtnText}>
                {isExporting ? 'Renderizando...' : 'Baixar Imagem (9:16 PNG)'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, isDark ? styles.copyBtnDark : styles.copyBtnLight]}
              onPress={handleCopyLink}
              activeOpacity={0.7}
            >
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} color={isDark ? '#f5f5f7' : '#1d1d1f'} />}
              <Text style={[styles.copyBtnText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                {copied ? 'Copiado!' : 'Copiar Link'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    boxShadow: '0 20px 36px rgba(0, 0, 0, 0.25)',
  },
  modalLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  modalDark: {
    backgroundColor: '#1c1c1e',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
  previewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  storyCard: {
    width: 270,
    height: 480, // 9:16 aspect ratio
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0a0a0c',
    boxShadow: '0 12px 24px rgba(0, 0, 0, 0.35)',
  },
  cardImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  fallbackBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1e293b',
  },
  topVignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  brandText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  dateText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
  },
  bottomVignette: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 18,
    backgroundColor: 'rgba(0,0,0,0.75)',
    gap: 4,
  },
  storyCityName: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  storyRegion: {
    color: '#64b5f6',
    fontSize: 11,
    fontWeight: '600',
  },
  tempRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  storyTemp: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
  },
  aqiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  aqiPillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  storyExtract: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10,
    lineHeight: 14,
  },
  storyWatermark: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    marginTop: 4,
  },
  actionsBar: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  downloadBtn: {
    backgroundColor: '#0071e3',
  },
  downloadBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  copyBtnLight: {
    backgroundColor: '#f0f0f2',
  },
  copyBtnDark: {
    backgroundColor: '#2c2c2e',
  },
  copyBtnText: {
    fontSize: 12,
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

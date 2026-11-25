import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Linking,
} from 'react-native';
import { Sparkles, MapPin, RefreshCw } from 'lucide-react';
import { City, WeatherData, PointOfInterest, AIItinerary, AIItineraryStop, ItineraryDuration, ItineraryTransport } from '../types';
import { ApiService } from '../services/api';

interface AIItinerarySectionProps {
  city: City;
  pois?: PointOfInterest[];
  weather?: WeatherData | null;
  theme: 'dark' | 'light';
  isAiAvailable?: boolean;
  onAiUnavailable?: () => void;
}

const DURATIONS: ItineraryDuration[] = ['Meio dia', '1 dia', '2 dias', '3 dias'];
const TRANSPORTS: ItineraryTransport[] = ['Carro', 'Moto', 'A pé', 'Bicicleta', 'Transporte público'];
const STYLE_OPTIONS: string[] = [
  'Cafés & Padarias',
  'Restaurantes',
  'Bares & Noite',
  'Compras & Lojas',
  'Parques & Natureza',
  'Cultura & História',
  'Em Família',
];

// Colors per stop index
const STOP_COLORS = ['#0071e3', '#10b981', '#f59e0b', '#8b5cf6', '#f97316', '#ef4444', '#06b6d4', '#ec4899'];

export const AIItinerarySection: React.FC<AIItinerarySectionProps> = ({
  city,
  pois = [],
  weather,
  theme,
  isAiAvailable = true,
  onAiUnavailable,
}) => {
  const isDark = theme === 'dark';

  const [preferences, setPreferences] = useState('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [duration, setDuration] = useState<ItineraryDuration>('1 dia');
  const [transport, setTransport] = useState<ItineraryTransport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<AIItinerary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canGenerate = !isGenerating && transport !== null;

  const toggleStyle = useCallback((styleName: string) => {
    setSelectedStyles((prev) => {
      if (prev.includes(styleName)) {
        return prev.filter((item) => item !== styleName);
      }
      if (prev.length >= 4) {
        return [...prev.slice(1), styleName];
      }
      return [...prev, styleName];
    });
  }, []);

  const handleGenerate = useCallback(async (excludePrevious = false) => {
    if (!canGenerate || !transport) return;

    const previousTitles = excludePrevious && result
      ? result.days.flatMap((d) => d.stops.map((s) => s.title))
      : [];

    setIsGenerating(true);
    setErrorMsg(null);
    if (!excludePrevious) {
      setResult(null);
    }

    const conditionLabel = weather?.current
      ? ApiService.getWeatherMeta(weather.current.weatherCode).label
      : undefined;

    try {
      const res = await fetch('/api/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'custom',
          cityName: city.name,
          admin1: city.admin1,
          country: city.country,
          lat: city.latitude,
          lon: city.longitude,
          currentTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          weather: weather?.current
            ? {
              temperature: Math.round(weather.current.temperature),
              apparentTemperature: Math.round(weather.current.apparentTemperature),
              condition: conditionLabel,
            }
            : null,
          preferences: preferences.slice(0, 160),
          styles: selectedStyles,
          excludeTitles: previousTitles,
          nearbyPois: pois.slice(0, 15).map((p) => ({ title: p.title, category: p.category })),
          duration,
          transport,
        }),
        signal: AbortSignal.timeout ? AbortSignal.timeout(30000) : undefined,
      });

      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (!res.ok) {
        if (res.status >= 500 || res.status === 404) {
          // AI service is offline/disabled -> Hide the section gracefully
          onAiUnavailable?.();
          return;
        }
        const msg = typeof data.error === 'string' ? data.error : 'Erro ao gerar roteiro.';
        setErrorMsg(msg);
        return;
      }

      setResult(data as unknown as AIItinerary);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setErrorMsg('A requisição demorou demais. Tente novamente.');
      } else {
        // Network failure or AI down -> hide creation section
        onAiUnavailable?.();
      }
    } finally {
      setIsGenerating(false);
    }
  }, [canGenerate, transport, result, city.name, city.admin1, city.country, city.latitude, city.longitude, pois, weather?.current?.weatherCode, weather?.current?.temperature, preferences, selectedStyles, duration, onAiUnavailable]);

  // If AI is offline, do not show the create itinerary section
  if (!isAiAvailable) {
    return null;
  }

  const buildMapsUrl = (stop: AIItineraryStop) =>
    stop.mapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.title + ' ' + city.name)}`;

  return (
    <View style={styles.container}>
      <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Sparkles size={16} color={isDark ? '#64b5f6' : '#0071e3'} />
          <Text style={[styles.cardTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
            Crie seu próprio roteiro
          </Text>
        </View>

        <Text style={[styles.subtitle, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
          A IA monta um roteiro personalizado para {city.name} adaptado ao clima, meio de transporte e suas preferências.
        </Text>

        {/* Campo 1 - Preferências */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
            Preferências
          </Text>
          <View style={[styles.inputWrapper, isDark ? styles.inputWrapperDark : styles.inputWrapperLight]}>
            <TextInput
              style={[styles.textInput, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}
              placeholder="Ex.: Cafés artesanais, almoço típico, livraria e bar descontraído à noite."
              placeholderTextColor={isDark ? '#636366' : '#aeaeb2'}
              value={preferences}
              onChangeText={(t) => setPreferences(t.slice(0, 160))}
              maxLength={160}
              multiline={false}
              returnKeyType="done"
              editable={!isGenerating}
            />
            <Text style={[styles.charCount, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              {preferences.length}/160
            </Text>
          </View>
        </View>

        {/* Campo 1.5 - Estilos / Foco rápido */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
            Estilos e Estabelecimentos (opcional)
          </Text>
          <View style={styles.pillRow}>
            {STYLE_OPTIONS.map((styleName) => {
              const active = selectedStyles.includes(styleName);
              return (
                <TouchableOpacity
                  key={styleName}
                  style={[
                    styles.pill,
                    isDark ? styles.pillDark : styles.pillLight,
                    active && (isDark ? styles.pillActiveDark : styles.pillActiveLight),
                  ]}
                  onPress={() => toggleStyle(styleName)}
                  activeOpacity={0.7}
                  disabled={isGenerating}
                >
                  <Text
                    style={[
                      styles.pillText,
                      active
                        ? styles.pillTextActive
                        : isDark
                          ? styles.textSecondaryDark
                          : styles.textSecondaryLight,
                    ]}
                  >
                    {styleName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Campo 2 - Duração */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
            Duração
          </Text>
          <View style={styles.pillRow}>
            {DURATIONS.map((d) => {
              const active = duration === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.pill,
                    isDark ? styles.pillDark : styles.pillLight,
                    active && (isDark ? styles.pillActiveDark : styles.pillActiveLight),
                  ]}
                  onPress={() => setDuration(d)}
                  activeOpacity={0.7}
                  disabled={isGenerating}
                >
                  <Text
                    style={[
                      styles.pillText,
                      active
                        ? styles.pillTextActive
                        : isDark
                          ? styles.textSecondaryDark
                          : styles.textSecondaryLight,
                    ]}
                  >
                    {d}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Campo 3 - Transporte */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
            Transporte <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.pillRow}>
            {TRANSPORTS.map((t) => {
              const active = transport === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.pill,
                    isDark ? styles.pillDark : styles.pillLight,
                    active && (isDark ? styles.pillActiveDark : styles.pillActiveLight),
                  ]}
                  onPress={() => setTransport(t)}
                  activeOpacity={0.7}
                  disabled={isGenerating}
                >
                  <Text
                    style={[
                      styles.pillText,
                      active
                        ? styles.pillTextActive
                        : isDark
                          ? styles.textSecondaryDark
                          : styles.textSecondaryLight,
                    ]}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {transport === null && (
            <Text style={[styles.hintText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              Selecione um meio de transporte para continuar.
            </Text>
          )}
        </View>

        {/* Botão Gerar */}
        <TouchableOpacity
          style={[styles.generateBtn, !canGenerate && styles.generateBtnDisabled]}
          onPress={() => handleGenerate(false)}
          activeOpacity={0.8}
          disabled={!canGenerate}
        >
          {isGenerating ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.generateBtnText}>Gerar Roteiro Personalizado</Text>
          )}
        </TouchableOpacity>

        {/* Estado de carregamento */}
        {isGenerating && (
          <Text style={[styles.loadingHint, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
            Consultando pontos urbanos e adaptando ao clima atual de {city.name}...
          </Text>
        )}

        {/* Erro */}
        {errorMsg && !isGenerating && (
          <View style={[styles.errorBox, isDark ? styles.errorBoxDark : styles.errorBoxLight]}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Resultado */}
        {result && !isGenerating && (
          <View style={styles.resultContainer}>
            <View style={styles.resultHeader}>
              <Text style={[styles.resultTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                {result.title}
              </Text>
              <Text style={[styles.resultMeta, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                {result.transport} · {result.duration}
                {result.weatherContext ? ` · ${result.weatherContext}` : ''}
              </Text>
            </View>

            {result.days.map((day) => (
              <View key={day.day}>
                {result.days.length > 1 && (
                  <Text style={[styles.dayLabel, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                    Dia {day.day}
                  </Text>
                )}
                <View style={styles.timelineList}>
                  {day.stops.map((stop, idx) => {
                    const color = STOP_COLORS[idx % STOP_COLORS.length];
                    const mapsUrl = buildMapsUrl(stop);
                    const globalIdx = (day.day - 1) * 10 + idx;
                    return (
                      <View key={globalIdx} style={styles.timelineItem}>
                        {/* Hora & linha conectora */}
                        <View style={styles.nodeCol}>
                          <View
                            style={[
                              styles.shiftBadge,
                              { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f2' },
                            ]}
                          >
                            <Text style={[styles.hourText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                              {stop.time}
                            </Text>
                          </View>
                          {idx < day.stops.length - 1 && (
                            <View style={[styles.connectorLine, isDark ? styles.lineDark : styles.lineLight]} />
                          )}
                        </View>

                        {/* Card da parada */}
                        <View style={[styles.stopCard, isDark ? styles.stopCardDark : styles.stopCardLight]}>
                          <View style={styles.stopContent}>
                            <View style={styles.stopHeader}>
                              <Text style={[styles.shiftLabel, { color }]}>{stop.category}</Text>
                              {stop.tip && (
                                <Text style={[styles.tipTag, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                                  {stop.tip}
                                </Text>
                              )}
                            </View>
                            <Text
                              style={[styles.poiTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}
                              numberOfLines={1}
                            >
                              {stop.title}
                            </Text>
                            <Text
                              style={[styles.poiExtract, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}
                              numberOfLines={2}
                            >
                              {stop.description}
                            </Text>
                            <View style={styles.footerRow}>
                              <View style={styles.categoryPill}>
                                <MapPin size={10} color="#86868b" />
                                <Text style={styles.categoryText} numberOfLines={1}>
                                  {stop.address ? `${stop.category} · ${stop.address}` : stop.category}
                                </Text>
                              </View>
                              <TouchableOpacity onPress={() => Linking.openURL(mapsUrl)} activeOpacity={0.65}>
                                <Text style={styles.detailsLink}>Ver no mapa →</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}

            {/* Ações - Variar ou Limpar */}
            <View style={styles.resultActions}>
              <TouchableOpacity
                style={[styles.retryBtn, styles.varyBtn, isDark ? styles.retryBtnDark : styles.retryBtnLight]}
                onPress={() => handleGenerate(true)}
                activeOpacity={0.7}
                disabled={isGenerating}
              >
                <RefreshCw size={12} color={isDark ? '#64b5f6' : '#0071e3'} />
                <Text style={[styles.retryBtnText, styles.varyBtnText]}>
                  Gerar nova variação
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.retryBtn, isDark ? styles.retryBtnDark : styles.retryBtnLight]}
                onPress={() => {
                  setResult(null);
                  setErrorMsg(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.retryBtnText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                  Limpar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%' },
  card: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
    gap: 20,
  },
  cardLight: { backgroundColor: '#ffffff', borderColor: 'rgba(0,0,0,0.04)' },
  cardDark: { backgroundColor: '#1c1c1e', borderColor: 'rgba(255,255,255,0.08)' },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: -8 },

  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  required: { color: '#f97316' },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  inputWrapperLight: { backgroundColor: '#f5f5f7', borderColor: 'rgba(0,0,0,0.06)' },
  inputWrapperDark: { backgroundColor: '#2c2c2e', borderColor: 'rgba(255,255,255,0.08)' },
  textInput: { flex: 1, fontSize: 13, outlineStyle: 'none' } as any,
  charCount: { fontSize: 11, minWidth: 36, textAlign: 'right' },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillLight: { backgroundColor: '#f5f5f7', borderColor: 'rgba(0,0,0,0.06)' },
  pillDark: { backgroundColor: '#2c2c2e', borderColor: 'rgba(255,255,255,0.08)' },
  pillActiveLight: { backgroundColor: '#0071e3', borderColor: '#0071e3' },
  pillActiveDark: { backgroundColor: '#0071e3', borderColor: '#0071e3' },
  pillText: { fontSize: 12, fontWeight: '500' },
  pillTextActive: { color: '#ffffff', fontWeight: '600' },

  hintText: { fontSize: 11, marginTop: 2 },

  generateBtn: {
    backgroundColor: '#0071e3',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  generateBtnDisabled: { backgroundColor: '#aeaeb2' },
  generateBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  loadingHint: { fontSize: 12, textAlign: 'center', marginTop: -8 },

  errorBox: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  errorBoxLight: { backgroundColor: '#fff5f5', borderColor: 'rgba(239,68,68,0.15)' },
  errorBoxDark: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' },
  errorText: { color: '#ef4444', fontSize: 13, lineHeight: 18 },

  resultContainer: { gap: 16, marginTop: 4 },
  resultHeader: { gap: 2 },
  resultTitle: { fontSize: 14, fontWeight: '700' },
  resultMeta: { fontSize: 12 },
  dayLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8 },

  // Timeline
  timelineList: { gap: 14 },
  timelineItem: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  nodeCol: { alignItems: 'center', width: 60 },
  shiftBadge: { paddingVertical: 4, paddingHorizontal: 6, borderRadius: 8, alignItems: 'center', width: '100%' },
  hourText: { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  connectorLine: { width: 2, flex: 1, marginTop: 4 },
  lineLight: { backgroundColor: '#e5e5ea' },
  lineDark: { backgroundColor: '#2c2c2e' },
  stopCard: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 12,
    alignItems: 'center',
  },
  stopCardLight: { backgroundColor: '#fafafc', borderColor: 'rgba(0,0,0,0.03)' },
  stopCardDark: { backgroundColor: '#262629', borderColor: 'rgba(255,255,255,0.05)' },
  stopContent: { flex: 1, gap: 4 },
  stopHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  shiftLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  tipTag: { fontSize: 10, fontStyle: 'italic' },
  poiTitle: { fontSize: 14, fontWeight: '600' },
  poiExtract: { fontSize: 12, lineHeight: 16 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 8 },
  categoryPill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
  categoryText: { flexShrink: 1, fontSize: 10, color: '#86868b' },
  detailsLink: { fontSize: 11, color: '#0071e3', fontWeight: '600' },

  resultActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
  },
  varyBtn: {
    borderColor: 'rgba(0, 113, 227, 0.25)',
  },
  varyBtnText: {
    color: '#0071e3',
    fontWeight: '600',
  },
  retryBtnLight: { backgroundColor: '#f5f5f7', borderColor: 'rgba(0,0,0,0.06)' },
  retryBtnDark: { backgroundColor: '#2c2c2e', borderColor: 'rgba(255,255,255,0.08)' },
  retryBtnText: { fontSize: 12, fontWeight: '500' },

  textPrimaryLight: { color: '#1d1d1f' },
  textPrimaryDark: { color: '#f5f5f7' },
  textSecondaryLight: { color: '#6e6e73' },
  textSecondaryDark: { color: '#a1a1a6' },
});

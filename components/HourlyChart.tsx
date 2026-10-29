import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp } from 'lucide-react';
import { HourlyForecast } from '../types';

interface HourlyChartProps {
  hourly: HourlyForecast;
  temperatureUnit: 'C' | 'F';
  theme: 'dark' | 'light';
}

export const HourlyChart: React.FC<HourlyChartProps> = ({
  hourly,
  temperatureUnit,
  theme,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<any>(null);

  const isDark = theme === 'dark';

  useEffect(() => {
    if (typeof window === 'undefined' || !canvasRef.current) return;

    let isMounted = true;

    const initChart = async () => {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);

      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }

      if (!isMounted || !canvasRef.current) return;

      const labels = hourly.times.slice(0, 24).map((t) => {
        try {
          const d = new Date(t);
          return `${String(d.getHours()).padStart(2, '0')}h`;
        } catch {
          return t.slice(11, 13) + 'h';
        }
      });

      const temps = hourly.temperatures.slice(0, 24).map((t) => {
        if (temperatureUnit === 'F') {
          return Math.round((t * 9) / 5 + 32);
        }
        return Math.round(t);
      });

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const gradient = ctx.createLinearGradient(0, 0, 0, 180);
      if (isDark) {
        gradient.addColorStop(0, 'rgba(10, 132, 255, 0.25)');
        gradient.addColorStop(1, 'rgba(10, 132, 255, 0.0)');
      } else {
        gradient.addColorStop(0, 'rgba(0, 113, 227, 0.15)');
        gradient.addColorStop(1, 'rgba(0, 113, 227, 0.0)');
      }

      chartInstanceRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: `Temperatura (°${temperatureUnit})`,
              data: temps,
              borderColor: isDark ? '#64b5f6' : '#0071e3',
              borderWidth: 2,
              backgroundColor: gradient,
              fill: true,
              tension: 0.4,
              pointRadius: 0,
              pointHoverRadius: 5,
              pointHoverBackgroundColor: isDark ? '#64b5f6' : '#0071e3',
              pointHoverBorderColor: '#ffffff',
              pointHoverBorderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              backgroundColor: isDark ? '#2c2c2e' : '#ffffff',
              titleColor: isDark ? '#f5f5f7' : '#1d1d1f',
              bodyColor: isDark ? '#a1a1a6' : '#6e6e73',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              borderWidth: 1,
              padding: 10,
              displayColors: false,
              callbacks: {
                label: (context) => `${context.parsed.y}°${temperatureUnit}`,
              },
            },
          },
          scales: {
            x: {
              grid: {
                display: false,
              },
              ticks: {
                color: isDark ? '#86868b' : '#86868b',
                font: { size: 10, family: '-apple-system' },
                maxTicksLimit: 8,
              },
              border: {
                display: false,
              },
            },
            y: {
              grid: {
                color: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
              },
              ticks: {
                color: isDark ? '#86868b' : '#86868b',
                font: { size: 10, family: '-apple-system' },
                callback: (val) => `${val}°`,
                maxTicksLimit: 5,
              },
              border: {
                display: false,
              },
            },
          },
        },
      });
    };

    initChart();

    return () => {
      isMounted = false;
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [hourly, temperatureUnit, isDark]);

  return (
    <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
      <View style={styles.cardHeader}>
        <TrendingUp size={16} color={isDark ? '#64b5f6' : '#0071e3'} />
        <Text style={[styles.cardTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
          Variação Térmica Contínua
        </Text>
      </View>

      <View style={styles.chartFrame}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '180px' }} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
  },
  cardLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  cardDark: {
    backgroundColor: '#1c1c1e',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  chartFrame: {
    width: '100%',
    height: 180,
  },
  textPrimaryLight: {
    color: '#1d1d1f',
  },
  textPrimaryDark: {
    color: '#f5f5f7',
  },
});

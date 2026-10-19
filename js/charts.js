/**
 * WeatherCharts Module
 * Renders interactive Chart.js graphs for 24-hour forecast
 * (Temperature line curve + Precipitation probability bars)
 */

const WeatherCharts = {
  chartInstance: null,

  /**
   * Helper to convert Celsius to Fahrenheit
   */
  toFahrenheit(c) {
    return (c * 9) / 5 + 32;
  },

  /**
   * Render or update 24-Hour Forecast Chart
   */
  renderHourlyChart(canvasId, hourlyData, unit = 'c') {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !hourlyData || !hourlyData.time) return;

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    // Find index of current hour
    const now = new Date();
    let startIndex = 0;
    for (let i = 0; i < hourlyData.time.length; i++) {
      const itemTime = new Date(hourlyData.time[i]);
      if (itemTime >= now) {
        startIndex = Math.max(0, i - 1);
        break;
      }
    }

    // Take next 24 points
    const next24Times = hourlyData.time.slice(startIndex, startIndex + 24);
    let next24Temps = hourlyData.temperature_2m.slice(startIndex, startIndex + 24);
    const next24Precip = (hourlyData.precipitation_probability || []).slice(startIndex, startIndex + 24);
    const next24Codes = (hourlyData.weather_code || []).slice(startIndex, startIndex + 24);

    // Apply unit conversion if needed
    if (unit === 'f') {
      next24Temps = next24Temps.map(t => Math.round(this.toFahrenheit(t)));
    } else {
      next24Temps = next24Temps.map(t => Math.round(t));
    }

    // Formatted labels (e.g. "14:00", "15:00")
    const labels = next24Times.map(t => {
      const d = new Date(t);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    });

    // Destroy existing chart if present
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    const ctx = canvas.getContext('2d');

    // Create subtle gradient for temperature line
    const tempGradient = ctx.createLinearGradient(0, 0, 0, 260);
    if (isLight) {
      tempGradient.addColorStop(0, 'rgba(2, 132, 199, 0.35)');
      tempGradient.addColorStop(1, 'rgba(2, 132, 199, 0.0)');
    } else {
      tempGradient.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
      tempGradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
    }

    const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)';
    const textColor = isLight ? '#475569' : '#94a3b8';
    const primaryColor = isLight ? '#0284c7' : '#38bdf8';
    const rainColor = isLight ? 'rgba(99, 102, 241, 0.5)' : 'rgba(129, 140, 248, 0.5)';

    this.chartInstance = new Chart(ctx, {
      data: {
        labels: labels,
        datasets: [
          {
            type: 'line',
            label: `Temperatura (°${unit.toUpperCase()})`,
            data: next24Temps,
            borderColor: primaryColor,
            borderWidth: 3,
            backgroundColor: tempGradient,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: primaryColor,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 7,
            yAxisID: 'yTemp'
          },
          {
            type: 'bar',
            label: 'Chance de Chuva (%)',
            data: next24Precip,
            backgroundColor: rainColor,
            borderRadius: 6,
            barPercentage: 0.5,
            yAxisID: 'yRain'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: textColor,
              font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' },
              usePointStyle: true,
              boxWidth: 8
            }
          },
          tooltip: {
            backgroundColor: isLight ? '#ffffff' : '#0f172a',
            titleColor: isLight ? '#0f172a' : '#f8fafc',
            bodyColor: isLight ? '#334155' : '#cbd5e1',
            borderColor: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.15)',
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            callbacks: {
              afterTitle: function(context) {
                const idx = context[0].dataIndex;
                const code = next24Codes[idx];
                const meta = window.ApiService ? window.ApiService.getWeatherMeta(code) : null;
                return meta ? `Condição: ${meta.label}` : '';
              },
              label: function(context) {
                if (context.dataset.type === 'line') {
                  return ` Temp: ${context.parsed.y}°${unit.toUpperCase()}`;
                } else {
                  return ` Chuva: ${context.parsed.y}%`;
                }
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: gridColor,
              drawBorder: false
            },
            ticks: {
              color: textColor,
              font: { family: 'Plus Jakarta Sans', size: 11 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 12
            }
          },
          yTemp: {
            type: 'linear',
            position: 'left',
            grid: {
              color: gridColor,
              drawBorder: false
            },
            ticks: {
              color: textColor,
              font: { family: 'Plus Jakarta Sans', size: 11 },
              callback: function(value) {
                return `${value}°`;
              }
            }
          },
          yRain: {
            type: 'linear',
            position: 'right',
            min: 0,
            max: 100,
            grid: {
              drawOnChartArea: false,
              drawBorder: false
            },
            ticks: {
              color: '#818cf8',
              font: { family: 'Plus Jakarta Sans', size: 11 },
              callback: function(value) {
                return `${value}%`;
              }
            }
          }
        }
      }
    });
  }
};

window.WeatherCharts = WeatherCharts;

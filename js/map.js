/**
 * CityMap Module
 * Manages Leaflet.js interactive map, custom HTML markers,
 * POIs layers, nearby cities layers, and pan/zoom interactions.
 */

const CityMap = {
  map: null,
  centerMarker: null,
  poiLayerGroup: null,
  nearbyLayerGroup: null,
  currentCityCoords: null,
  poiMarkersMap: new Map(),
  nearbyMarkersMap: new Map(),

  /**
   * Initializes the Leaflet map container
   */
  init(containerId = 'leaflet-map') {
    if (this.map) return;

    const el = document.getElementById(containerId);
    if (!el) return;

    // Default center (Brasília)
    this.map = L.map(containerId, {
      center: [-15.7975, -47.8919],
      zoom: 12,
      zoomControl: false,
      scrollWheelZoom: true
    });

    // Add custom zoom control in top-right
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // OpenStreetMap standard tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);

    // Initialize Layer Groups
    this.poiLayerGroup = L.layerGroup().addTo(this.map);
    this.nearbyLayerGroup = L.layerGroup().addTo(this.map);

    // Ensure map resizes properly when container changes or tabs switch
    window.addEventListener('resize', () => {
      if (this.map) this.map.invalidateSize();
    });
  },

  /**
   * Invalidate map size (call after showing tab)
   */
  invalidateSize() {
    if (this.map) {
      setTimeout(() => {
        this.map.invalidateSize();
      }, 100);
    }
  },

  /**
   * Updates map with current city, POIs, and nearby cities
   */
  updateCity(cityData, pois = [], nearbyCities = [], onSelectNearbyCity = null) {
    if (!this.map) this.init();
    if (!cityData) return;

    const lat = cityData.latitude;
    const lon = cityData.longitude;
    this.currentCityCoords = [lat, lon];

    // Clear previous markers
    if (this.centerMarker) {
      this.map.removeLayer(this.centerMarker);
    }
    this.poiLayerGroup.clearLayers();
    this.nearbyLayerGroup.clearLayers();
    this.poiMarkersMap.clear();
    this.nearbyMarkersMap.clear();

    // 1. Center pulsing marker
    const centerIcon = L.divIcon({
      className: 'custom-city-marker',
      html: `
        <div class="pulse-marker-ring"></div>
        <div class="marker-inner-dot"></div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
      popupAnchor: [0, -20]
    });

    this.centerMarker = L.marker([lat, lon], { icon: centerIcon })
      .addTo(this.map)
      .bindPopup(`
        <div class="popup-inner-card">
          <div class="popup-title">${cityData.name}</div>
          <div class="popup-sub">${cityData.admin1 ? cityData.admin1 + ', ' : ''}${cityData.country}</div>
          <div style="font-size: 0.75rem; color: #64748b; font-family: monospace;">
            Lat: ${lat.toFixed(4)} • Lon: ${lon.toFixed(4)}
          </div>
        </div>
      `);

    // 2. Add POIs (Amber markers)
    pois.forEach(poi => {
      const poiIcon = L.divIcon({
        className: 'poi-marker-wrapper',
        html: `
          <div class="poi-marker-icon" title="${poi.title}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 21s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 7.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18]
      });

      const popupHtml = `
        <div class="popup-inner-card">
          ${poi.thumbnail ? `<img src="${poi.thumbnail}" alt="${poi.title}" class="popup-thumb" onerror="this.style.display='none'">` : ''}
          <div class="popup-title">${poi.title}</div>
          <div class="popup-sub">Distância: <strong>${poi.distFormatted}</strong></div>
          <p style="font-size:0.775rem; color:#94a3b8; margin-bottom:0.75rem; line-height:1.4;">${poi.extract.slice(0, 100)}...</p>
          <a href="${poi.url}" target="_blank" rel="noopener noreferrer" class="popup-btn">Ver na Wikipédia</a>
        </div>
      `;

      const marker = L.marker([poi.lat, poi.lon], { icon: poiIcon })
        .bindPopup(popupHtml)
        .addTo(this.poiLayerGroup);

      this.poiMarkersMap.set(poi.pageId || poi.title, marker);
    });

    // 3. Add Nearby Cities (Emerald markers)
    nearbyCities.forEach(c => {
      const neighborIcon = L.divIcon({
        className: 'neighbor-marker-wrapper',
        html: `
          <div class="neighbor-marker-icon" title="${c.name}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="M12 16V8"/></svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18]
      });

      const marker = L.marker([c.latitude, c.longitude], { icon: neighborIcon })
        .addTo(this.nearbyLayerGroup);

      const popupContainer = document.createElement('div');
      popupContainer.className = 'popup-inner-card';
      popupContainer.innerHTML = `
        <div class="popup-title">${c.name}</div>
        <div class="popup-sub">${c.region ? c.region + ', ' : ''}${c.country}</div>
        <div style="font-size:0.78rem; color:#64748b; margin-bottom:0.75rem;">
          Distância: <strong>${c.distanceKm} km</strong> (${c.direction})
          ${c.population ? `<br>População: ${new Intl.NumberFormat('pt-BR').format(c.population)}` : ''}
        </div>
        <button class="popup-btn btn-explore-map-city" data-city-name="${c.name}">Explorar Esta Cidade</button>
      `;

      popupContainer.querySelector('.btn-explore-map-city').addEventListener('click', () => {
        if (typeof onSelectNearbyCity === 'function') {
          onSelectNearbyCity(c);
        }
      });

      marker.bindPopup(popupContainer);
      this.nearbyMarkersMap.set(c.name, marker);
    });

    // Reset view to center city
    this.resetView();
  },

  /**
   * Resets map view to center city
   */
  resetView() {
    if (this.map && this.currentCityCoords) {
      this.map.setView(this.currentCityCoords, 12, { animate: true });
    }
  },

  /**
   * Fits bounds to show all markers (center + POIs + nearby cities)
   */
  fitAllBounds() {
    if (!this.map) return;
    const allLatLngs = [];
    if (this.currentCityCoords) allLatLngs.push(this.currentCityCoords);

    this.poiLayerGroup.eachLayer(layer => {
      if (layer.getLatLng) allLatLngs.push(layer.getLatLng());
    });

    this.nearbyLayerGroup.eachLayer(layer => {
      if (layer.getLatLng) allLatLngs.push(layer.getLatLng());
    });

    if (allLatLngs.length > 0) {
      this.map.fitBounds(L.latLngBounds(allLatLngs), { padding: [40, 40], maxZoom: 14 });
    }
  },

  /**
   * Smoothly pans to a specific POI or City by key and opens its popup
   */
  focusPOI(key, lat, lon) {
    if (!this.map) return;
    this.map.setView([lat, lon], 15, { animate: true });
    const marker = this.poiMarkersMap.get(key);
    if (marker) {
      setTimeout(() => marker.openPopup(), 400);
    }
  },

  /**
   * Toggles visibility of layer groups
   */
  toggleLayer(layerName, visible) {
    if (!this.map) return;
    if (layerName === 'pois') {
      if (visible) this.map.addLayer(this.poiLayerGroup);
      else this.map.removeLayer(this.poiLayerGroup);
    } else if (layerName === 'nearby') {
      if (visible) this.map.addLayer(this.nearbyLayerGroup);
      else this.map.removeLayer(this.nearbyLayerGroup);
    }
  }
};

window.CityMap = CityMap;

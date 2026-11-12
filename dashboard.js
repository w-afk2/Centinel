(() => {
  'use strict';

  const places = [
    { name: 'Managua', short: 'MGA', lat: 12.114, lon: -86.236 },
    { name: 'León', short: 'LEO', lat: 12.435, lon: -86.879 },
    { name: 'Chinandega', short: 'CHI', lat: 12.629, lon: -87.131 },
    { name: 'Matagalpa', short: 'MAT', lat: 12.925, lon: -85.917 },
    { name: 'Jinotega', short: 'JIN', lat: 13.091, lon: -86.001 },
    { name: 'Estelí', short: 'EST', lat: 13.091, lon: -86.354 },
    { name: 'Bluefields', short: 'BLU', lat: 12.012, lon: -83.764 },
    { name: 'Puerto Cabezas', short: 'PCA', lat: 14.035, lon: -83.388 },
    { name: 'Rivas', short: 'RIV', lat: 11.437, lon: -85.826 },
    { name: 'Juigalpa', short: 'JUI', lat: 12.107, lon: -85.364 }
  ];

  // Se reciben de dbo.vw_DashboardCentinel a través de la API.
  let sampleNodes = [];
  let apiOnline = false;

  const $ = (selector) => document.querySelector(selector);
  const mapElement = $('#nicaraguaMap');
  const statusElement = $('#mapStatus');
  const refreshButton = $('#refreshWeather');
  const slider = $('#forecastHour');
  const sliderLabel = $('#forecastHourLabel');
  const layerButtons = [...document.querySelectorAll('.map-layer-button')];
  const mapFallback = $('#mapFallback');
  const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  let map;
  let weatherLayer;
  let demoLayer;
  let nodeLayer;
  let weatherRecords = [];
  let currentLayer = 'temperature';
  let selectedIndex = 0;
  let forecastIndex = 0;
  let forecastTimes = [];
  let lastUpdated = null;

  function setStatus(message, kind = '') {
    if (!statusElement) return;
    statusElement.className = `map-status${kind ? ` is-${kind}` : ''}`;
    const label = statusElement.querySelector('span');
    if (label) label.textContent = message;
  }

  function getDeviceCounts() {
    return sampleNodes.reduce((total, node) => {
      if (node.kind === 'online') total.active++;
      else if (node.kind === 'warn') total.intermittent++;
      else total.inactive++;
      return total;
    }, { active: 0, intermittent: 0, inactive: 0 });
  }

  function updateDeviceSummary() {
    const counts = getDeviceCounts();
    $('#surveyTotal').textContent = String(sampleNodes.length);
    $('#surveyActive').textContent = String(counts.active);
    $('#surveyIntermittent').textContent = String(counts.intermittent);
    $('#surveyInactive').textContent = String(counts.inactive);
    $('#networkSurveySummary').textContent = apiOnline
      ? `${sampleNodes.length} sensores registrados en SQL Server: ${counts.active} activos, ${counts.intermittent} en mantenimiento y ${counts.inactive} inactivos.`
      : 'No se ha podido consultar la red Centinel en SQL Server.';
  }

  function paintNodeTable() {
    const table = $('#networkNodes');
    if (!table) return;
    table.querySelectorAll('.node-row').forEach(row => row.remove());
    if (!sampleNodes.length) {
      const row = document.createElement('div'); row.className = 'node-row';
      for (const part of ['Sin registros', apiOnline ? 'Agrega un sensor desde la API' : 'No se pudo conectar con la API', '—', '—']) {
        const el = document.createElement('span'); el.textContent = part; row.append(el);
      }
      table.append(row);
      return;
    }
    for (const node of sampleNodes) {
      const row = document.createElement('div'); row.className = 'node-row';
      const code = document.createElement('strong'); code.textContent = node.id;
      const zone = document.createElement('span'); zone.textContent = node.place;
      const state = document.createElement('span');
      state.className = `node-state node-${node.kind}`;
      state.textContent = node.status;
      const signal = document.createElement('span'); signal.textContent = node.signal;
      row.append(code, zone, state, signal);
      table.append(row);
    }
  }

  const htmlEscape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function setReadoutLabels(sensorMode) {
    const source = $('#mapDataSource');
    const sourceTitle = document.querySelector('.map-source > span');
    if (source) {
      source.textContent = sensorMode ? 'CentinelDB · SQL Server' : 'Open-Meteo · modelo de pronóstico ↗';
      if (sensorMode) source.removeAttribute('href');
      else source.href = 'https://open-meteo.com/';
    }
    if (sourceTitle) sourceTitle.textContent = sensorMode ? 'FUENTE SQL' : 'FUENTE METEO';
    const labels = document.querySelectorAll('.readout-grid > div > span');
    const values = sensorMode
      ? ['ÚLTIMA LECTURA', 'TIPO', 'UMBRAL', 'ESTADO']
      : ['TEMPERATURA', 'VIENTO', 'PRECIPITACIÓN', 'DIRECCIÓN'];
    labels.forEach((label, index) => { if (values[index]) label.textContent = values[index]; });
  }

  async function loadAlerts() {
    const table = $('#sqlAlerts');
    if (!table) return;
    let rows;
    try {
      const response = await fetch('/api/alertas/detalle?limit=10', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('Formato inesperado');
    } catch (error) {
      rows = [];
      console.warn('No se pudo consultar Alertas:', error);
    }
    table.querySelectorAll('.node-row').forEach(row => row.remove());
    if (!rows.length) {
      const row = document.createElement('div'); row.className = 'node-row';
      for (const value of ['Sin alertas registradas', 'Registra una lectura superior al umbral', '—', '—']) {
        const span = document.createElement('span'); span.textContent = value; row.append(span);
      }
      table.append(row);
      return;
    }
    for (const alert of rows) {
      const row = document.createElement('div'); row.className = 'node-row';
      const name = document.createElement('strong'); name.textContent = `#${alert.IdAlerta}`;
      const node = document.createElement('span'); node.textContent = `${alert.Codigo} · ${alert.Zona}`;
      const value = document.createElement('span'); value.textContent = Number(alert.Valor).toFixed(1);
      const state = document.createElement('span');
      state.className = 'alert-state-cell';
      const label = document.createElement('span');
      label.textContent = alert.Estado;
      state.append(label);
      if (alert.Estado === 'PENDIENTE') {
        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'alert-attend-button';
        action.textContent = 'Atender';
        action.setAttribute('aria-label', `Marcar alerta ${alert.IdAlerta} como atendida`);
        action.addEventListener('click', async () => {
          if (!window.confirm(`¿Marcar la alerta #${alert.IdAlerta} como ATENDIDA?`)) return;
          action.disabled = true;
          action.textContent = 'Guardando…';
          try {
            const response = await fetch(`/api/alertas/${alert.IdAlerta}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ Estado: 'ATENDIDA' })
            });
            if (!response.ok) {
              const error = await response.json().catch(() => ({}));
              throw new Error(error.error || `HTTP ${response.status}`);
            }
            await loadAlerts();
          } catch (error) {
            action.disabled = false;
            action.textContent = 'Atender';
            window.alert(`No fue posible actualizar la alerta: ${error.message}`);
          }
        });
        state.append(action);
      }
      row.append(name, node, value, state);
      table.append(row);
    }
  }

  async function loadDashboard() {
    try {
      const response = await fetch('/api/dashboard', { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`API: HTTP ${response.status}`);
      const records = await response.json();
      if (!Array.isArray(records)) throw new Error('La API devolvió una respuesta inesperada.');
      sampleNodes = records.map((row) => ({
        id: row.Codigo,
        place: row.NombreZona,
        lat: row.Latitud == null ? null : Number(row.Latitud),
        lon: row.Longitud == null ? null : Number(row.Longitud),
        kind: row.EstadoSensor === 'ACTIVO' ? 'online' : row.EstadoSensor === 'MANTENIMIENTO' ? 'warn' : 'off',
        status: row.EstadoSensor,
        signal: row.EstadoLectura || 'SIN LECTURAS',
        value: row.UltimoValor == null ? null : Number(row.UltimoValor),
        unit: row.UnidadMedida,
        type: row.TipoSensor,
        threshold: Number(row.UmbralAlerta),
        origin: row.OrigenUltimaLectura,
        time: row.FechaUltimaLectura,
        alert: row.EstadoLectura === 'ALERTA'
      }));
      apiOnline = true;
      updateDeviceSummary();
      paintNodeTable();
      paintDemoNodes();
      if (currentLayer === 'centinela') setLayer('centinela');
    } catch (error) {
      console.error('No se pudo leer el dashboard de la API:', error);
      apiOnline = false;
      sampleNodes = [];
      updateDeviceSummary();
      paintNodeTable();
      paintDemoNodes();
      if (currentLayer === 'centinela') setLayer('centinela');
    }
  }

  function number(value, digits = 1) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(digits) : '—';
  }

  function directionName(degrees) {
    const value = Number(degrees);
    if (!Number.isFinite(value)) return '—';
    return ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round((((value % 360) + 360) % 360) / 45) % 8];
  }

  function weatherDescription(code) {
    const value = Number(code);
    if (value === 0) return 'Despejado';
    if (value === 1) return 'Mayormente despejado';
    if (value === 2) return 'Parcialmente nublado';
    if (value === 3) return 'Nublado';
    if ([45, 48].includes(value)) return 'Neblina';
    if ([51, 53, 55].includes(value)) return 'Llovizna';
    if ([56, 57].includes(value)) return 'Llovizna helada';
    if ([61, 63, 65].includes(value)) return 'Lluvia';
    if ([66, 67].includes(value)) return 'Lluvia helada';
    if ([71, 73, 75, 77].includes(value)) return 'Nieve';
    if ([80, 81, 82].includes(value)) return 'Chubascos';
    if ([85, 86].includes(value)) return 'Chubascos de nieve';
    if ([95, 96, 99].includes(value)) return 'Tormenta eléctrica';
    return 'Condición no clasificada';
  }

  function parseLocalTime(value) {
    if (!value) return null;
    const [datePart, timePart = '00:00'] = String(value).split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
    return new Date(year, month - 1, day, hour, minute);
  }

  function formatForecastTime(value) {
    if (!value) return '—';
    const date = parseLocalTime(value);
    if (!date) return String(value).replace('T', ' ');
    const dateLabel = `${date.getDate()} ${monthNames[date.getMonth()]}`;
    return `${dateLabel} · ${String(value).split('T')[1]?.slice(0, 5) || '—'}`;
  }

  function normalizeWeatherResponse(payload) {
    const locations = Array.isArray(payload) ? payload : [payload];
    if (!locations.length || locations.some((location) => !location?.hourly?.time)) {
      throw new Error(payload?.reason || 'La respuesta no contiene series horarias.');
    }
    const times = locations[0].hourly.time;
    forecastTimes = times;
    weatherRecords = places.map((place, index) => {
      const hourly = locations[index]?.hourly;
      if (!hourly) return { ...place, series: null };
      return {
        ...place,
        series: times.map((time, hour) => ({
          time,
          temperature: hourly.temperature_2m?.[hour],
          precipitation: hourly.precipitation?.[hour],
          windSpeed: hourly.wind_speed_10m?.[hour],
          windDirection: hourly.wind_direction_10m?.[hour],
          code: hourly.weather_code?.[hour]
        }))
      };
    });
  }

  function chooseCurrentHour() {
    if (!forecastTimes.length) return 0;
    const now = Date.now();
    let bestIndex = 0;
    let bestGap = Infinity;
    forecastTimes.forEach((time, index) => {
      const date = parseLocalTime(time);
      if (!date) return;
      const gap = Math.abs(date.getTime() - now);
      if (gap < bestGap) {
        bestGap = gap;
        bestIndex = index;
      }
    });
    return bestIndex;
  }

  function setReadout({ place, data, label, status, detail, isNode = false }) {
    setReadoutLabels(isNode);
    $('#selectedPlaceLabel').textContent = label || place?.name?.toLocaleUpperCase('es-NI') || 'NICARAGUA';
    $('#selectedPlaceValue').textContent = isNode ? status : `${number(data?.temperature, 1)}°`;
    $('#selectedPlaceCondition').textContent = isNode ? detail : `${weatherDescription(data?.code)} · ${place?.name || ''}`;
    if (isNode) {
      const node = data;
      $('#readTemp').textContent = node?.value == null ? 'Sin lecturas' : `${number(node.value, 1)} ${node.unit || ''}`;
      $('#readWind').textContent = node?.type || '—';
      $('#readRain').textContent = node ? `${number(node.threshold, 1)} ${node.unit || ''}` : '—';
      $('#readDirection').textContent = node?.signal || '—';
      $('#mapTimestamp').textContent = node?.time
        ? `Última lectura: ${new Date(node.time).toLocaleString('es-NI', { timeZone: 'America/Managua' })} · ${node.origin || '—'}`
        : 'Sin lecturas registradas';
      $('#mapDataNote').textContent = 'Datos guardados en SQL Server. Las lecturas marcadas PRUEBA o SIMULACION son sintéticas, no avisos oficiales.';
    } else {
      $('#readTemp').textContent = `${number(data?.temperature, 1)} °C`;
      $('#readWind').textContent = `${number(data?.windSpeed, 1)} km/h`;
      $('#readRain').textContent = `${number(data?.precipitation, 1)} mm`;
      $('#readDirection').textContent = directionName(data?.windDirection);
      $('#mapTimestamp').textContent = `Hora local del modelo: ${formatForecastTime(data?.time)}`;
      $('#mapDataNote').textContent = 'Pronóstico de modelo por ubicación. No equivale a observación en superficie ni a alerta oficial.';
    }
  }

  function currentRecord(record) {
    if (!record?.series?.length) return null;
    return record.series[Math.min(forecastIndex, record.series.length - 1)];
  }

  function temperatureColor(value) {
    const temp = Number(value);
    if (!Number.isFinite(temp)) return '#91aaa4';
    if (temp < 25) return '#79b6e2';
    if (temp < 28) return '#53c8ad';
    if (temp < 31) return '#bdcf75';
    if (temp < 34) return '#efb363';
    return '#e97d67';
  }

  function windColor(value) {
    const speed = Number(value);
    if (speed < 12) return '#63d1af';
    if (speed < 25) return '#7cb7e8';
    if (speed < 40) return '#eab672';
    return '#ee816d';
  }

  function precipitationColor(value) {
    const rain = Number(value);
    if (rain < 0.1) return '#586d6e';
    if (rain < 1) return '#70cce1';
    if (rain < 5) return '#559fe0';
    if (rain < 15) return '#806bdb';
    return '#bd72cb';
  }

  function weatherIcon(record, data) {
    const temperature = number(data?.temperature, 0);
    const windSpeed = number(data?.windSpeed, 0);
    const rain = number(data?.precipitation, 0);
    if (currentLayer === 'wind') {
      const angle = ((Number(data?.windDirection) || 0) + 180) % 360;
      return L.divIcon({ className: '', html: `<div class="weather-marker wind"><span class="wind-arrow" style="transform:rotate(${angle}deg)">➤</span>${windSpeed}</div>`, iconSize: [44, 25], iconAnchor: [22, 12] });
    }
    if (currentLayer === 'rain') {
      const rainValue = Number(data?.precipitation) || 0;
      return L.divIcon({ className: '', html: `<div class="weather-marker rain" style="background:${precipitationColor(rainValue)}">${rain}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
    }
    return L.divIcon({ className: '', html: `<div class="weather-marker" style="background:${temperatureColor(data?.temperature)}">${temperature}°</div>`, iconSize: [39, 25], iconAnchor: [19, 12] });
  }

  function setMapLegend() {
    const title = $('.gradient-label span:nth-child(2)');
    const bar = $('.gradient-bar');
    const min = $('#legendMin');
    const max = $('#legendMax');
    if (currentLayer === 'wind') {
      title.textContent = 'VIENTO · KM/H'; min.textContent = '0'; max.textContent = '40+';
      bar.style.background = 'linear-gradient(90deg,#63d1af,#7cb7e8,#eab672,#ee816d)';
    } else if (currentLayer === 'rain') {
      title.textContent = 'PRECIPITACIÓN · MM/H'; min.textContent = '0'; max.textContent = '15+';
      bar.style.background = 'linear-gradient(90deg,#586d6e,#70cce1,#559fe0,#806bdb,#bd72cb)';
    } else if (currentLayer === 'centinela') {
      title.textContent = 'ESTADO DE NODOS · SQL SERVER'; min.textContent = 'Activo'; max.textContent = 'Sin conexión';
      bar.style.background = 'linear-gradient(90deg,#53c99e,#e9b45f,#df736d)';
    } else {
      title.textContent = 'ESCALA DE TEMPERATURA'; min.textContent = '24°'; max.textContent = '36°';
      bar.style.background = 'linear-gradient(90deg,#79b6e2,#53c8ad,#bdcf75,#efb363,#e97d67)';
    }
  }

  function popupContent(place, data) {
    return `<strong>${place.name}</strong><span>${weatherDescription(data?.code)} · ${number(data?.temperature, 1)} °C</span><br><span>Viento ${number(data?.windSpeed, 1)} km/h · Lluvia ${number(data?.precipitation, 1)} mm</span>`;
  }

  function paintWeather() {
    if (!map || !weatherLayer || !weatherRecords.length) return;
    weatherLayer.clearLayers();
    weatherRecords.forEach((place, index) => {
      const data = currentRecord(place);
      if (!data) return;
      const fieldColor = currentLayer === 'wind'
        ? windColor(data.windSpeed)
        : currentLayer === 'rain'
          ? precipitationColor(data.precipitation)
          : temperatureColor(data.temperature);
      const rainAmount = Number(data.precipitation) || 0;
      const fieldRadius = currentLayer === 'rain' ? 72000 + Math.min(rainAmount, 18) * 2600 : 96000;
      const fieldOpacity = currentLayer === 'rain' ? (rainAmount < 0.1 ? 0.015 : Math.min(0.22, 0.08 + rainAmount * 0.012)) : 0.12;
      L.circle([place.lat, place.lon], {
        radius: fieldRadius,
        stroke: false,
        fillColor: fieldColor,
        fillOpacity: fieldOpacity,
        interactive: false
      }).addTo(weatherLayer);
      const marker = L.marker([place.lat, place.lon], { icon: weatherIcon(place, data), keyboard: true, title: `${place.name}: ${weatherDescription(data.code)}` });
      marker.bindPopup(popupContent(place, data));
      marker.on('click', () => { selectedIndex = index; setReadout({ place, data }); });
      marker.addTo(weatherLayer);
    });
    const active = weatherRecords.map(currentRecord).filter(Boolean);
    const averageTemp = active.reduce((sum, item) => sum + (Number(item.temperature) || 0), 0) / Math.max(active.length, 1);
    $('#overviewWeather').textContent = `${number(averageTemp, 1)} °C promedio`;
    $('#overviewWeatherSub').textContent = `${active.length} puntos · ${formatForecastTime(forecastTimes[forecastIndex])}`;
    if (weatherRecords[selectedIndex]) setReadout({ place: weatherRecords[selectedIndex], data: currentRecord(weatherRecords[selectedIndex]) });
  }

  function paintDemoNodes() {
    if (!map || !demoLayer || !nodeLayer) return;
    demoLayer.clearLayers(); // No se muestran eventos ficticios como registros reales.
    nodeLayer.clearLayers();
    sampleNodes.forEach((node) => {
      if (!Number.isFinite(node.lat) || !Number.isFinite(node.lon)) return;
      const icon = L.divIcon({ className: '', html: `<div class="centinela-marker node-${node.kind}">⌖</div>`, iconSize: [21, 21], iconAnchor: [10, 10] });
      const marker = L.marker([node.lat, node.lon], { icon, title: `${node.id} · ${node.status}` });
      marker.bindPopup(`<strong>Sensor ${htmlEscape(node.id)} · ${htmlEscape(node.status)}</strong><span>${htmlEscape(node.place)} · señal ${htmlEscape(node.signal)} · lectura ${node.value == null ? 'sin datos' : `${number(node.value, 1)} ${htmlEscape(node.unit)}`} ${node.alert ? '· UMBRAL SUPERADO' : ''}</span>`);
      marker.on('click', () => setReadout({ label: `${node.id} · ${node.place.toLocaleUpperCase('es-NI')}`, status: node.status, detail: node.alert ? 'Última lectura: umbral superado' : 'Información de la base de datos', data: node, isNode: true }));
      marker.addTo(nodeLayer);
    });
  }

  function setLayer(layer) {
    currentLayer = layer;
    layerButtons.forEach((button) => {
      const selected = button.dataset.layer === layer;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    setMapLegend();
    if (!map) return;
    if (layer === 'centinela') {
      if (map.hasLayer(weatherLayer)) map.removeLayer(weatherLayer);
      demoLayer.addTo(map);
      nodeLayer.addTo(map);
      const counts = getDeviceCounts();
      $('#overviewWeather').textContent = apiOnline ? `${sampleNodes.length} sensores registrados` : 'Sin conexión SQL';
      $('#overviewWeatherSub').textContent = `${counts.active} activos · ${counts.intermittent} mantenimiento · ${counts.inactive} inactivos`;
      const first = sampleNodes[0];
      if (first) {
        setReadout({ label: `${first.id} · ${first.place.toLocaleUpperCase('es-NI')}`, status: first.status,
          detail: first.alert ? 'Última lectura supera el umbral' : 'Registro de SQL Server', data: first, isNode: true });
      } else {
        setReadout({ label: 'RED CENTINEL', status: apiOnline ? 'Sin sensores' : 'API no disponible',
          detail: apiOnline ? 'Registra sensores para mostrarlos aquí' : 'Verifica SQL Server y el backend', isNode: true });
      }
    } else {
      if (map.hasLayer(demoLayer)) map.removeLayer(demoLayer);
      weatherLayer.addTo(map);
      nodeLayer.addTo(map);
      paintWeather();
    }
  }

  function updateTimeControl() {
    const maxIndex = Math.max(0, Math.min(24, forecastTimes.length - 1));
    slider.max = String(maxIndex);
    forecastIndex = Math.min(forecastIndex, maxIndex);
    slider.value = String(forecastIndex);
    sliderLabel.textContent = formatForecastTime(forecastTimes[forecastIndex]);
  }

  async function loadWeather() {
    if (!refreshButton) return;
    refreshButton.disabled = true;
    refreshButton.classList.add('is-loading');
    setStatus('Consultando modelo…');
    const params = new URLSearchParams({
      latitude: places.map((place) => place.lat).join(','),
      longitude: places.map((place) => place.lon).join(','),
      hourly: 'temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,weather_code',
      forecast_days: '2',
      timezone: 'America/Managua'
    });
    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error(`Open-Meteo respondió ${response.status}`);
      const payload = await response.json();
      if (payload?.error) throw new Error(payload.reason || 'El servicio de pronóstico devolvió un error.');
      normalizeWeatherResponse(payload);
      forecastIndex = chooseCurrentHour();
      updateTimeControl();
      lastUpdated = new Date();
      $('#mapTimestamp').textContent = `Hora local del modelo: ${formatForecastTime(forecastTimes[forecastIndex])}`;
      if (mapFallback) mapFallback.hidden = true;
      paintWeather();
      setStatus(`Pronóstico actualizado · ${lastUpdated.toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' })}`, 'ready');
      if (currentLayer === 'centinela') setLayer('centinela');
    } catch (error) {
      console.warn('No fue posible obtener el pronóstico meteorológico:', error);
      setStatus('Sin datos meteorológicos', 'error');
      $('#overviewWeather').textContent = 'Datos no disponibles';
      $('#overviewWeatherSub').textContent = 'Revisa tu conexión e inténtalo de nuevo';
      $('#mapTimestamp').textContent = 'No fue posible consultar el modelo.';
      if (mapFallback) {
        mapFallback.hidden = false;
        mapFallback.querySelector('strong').textContent = 'Pronóstico no disponible';
        mapFallback.querySelector('small').textContent = 'La cartografía puede seguir disponible; comprueba la conexión y actualiza el pronóstico.';
      }
    } finally {
      refreshButton.disabled = false;
      refreshButton.classList.remove('is-loading');
    }
  }

  function initMap() {
    if (!mapElement || !window.L) {
      setStatus('No se pudo cargar la cartografía', 'error');
      if (mapFallback) {
        mapFallback.hidden = false;
        mapFallback.querySelector('strong').textContent = 'Mapa base no disponible';
        mapFallback.querySelector('small').textContent = 'Revisa la conexión para cargar Leaflet y OpenStreetMap.';
      }
      return false;
    }
    map = L.map(mapElement, { zoomControl: true, scrollWheelZoom: false, preferCanvas: true }).setView([12.65, -85.55], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    weatherLayer = L.layerGroup().addTo(map);
    nodeLayer = L.layerGroup().addTo(map);
    demoLayer = L.layerGroup();
    paintDemoNodes();
    if (mapFallback) mapFallback.hidden = true;
    map.fitBounds([[10.65, -87.72], [15.05, -82.7]], { padding: [14, 14] });
    window.setTimeout(() => map.invalidateSize(), 120);
    return true;
  }

  layerButtons.forEach((button) => button.addEventListener('click', () => setLayer(button.dataset.layer)));
  slider?.addEventListener('input', () => {
    forecastIndex = Number(slider.value) || 0;
    sliderLabel.textContent = formatForecastTime(forecastTimes[forecastIndex]);
    if (currentLayer !== 'centinela') paintWeather();
  });
  refreshButton?.addEventListener('click', () => { loadWeather(); loadDashboard(); loadAlerts(); });

  const navLinks = [...document.querySelectorAll('.dash-nav-link')];
  navLinks.forEach((link) => link.addEventListener('click', (event) => {
    const section = document.querySelector(link.hash);
    if (!section) return;
    event.preventDefault();
    navLinks.forEach((item) => item.classList.toggle('is-active', item === link));
    try { history.replaceState(null, '', link.hash); }
    catch (_) { window.location.hash = link.hash; }
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!section.hasAttribute('tabindex')) section.setAttribute('tabindex', '-1');
    section.focus({ preventScroll: true });
  }));
  if ('IntersectionObserver' in window && navLinks.length) {
    const sectionObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach((link) => link.classList.toggle('is-active', link.hash === `#${visible.target.id}`));
    }, { rootMargin: '-14% 0px -68% 0px', threshold: [0, 0.15, 0.35] });
    navLinks.forEach((link) => {
      const section = document.querySelector(link.hash);
      if (section) sectionObserver.observe(section);
    });
  }

  setMapLegend();
  updateDeviceSummary();
  paintNodeTable();
  if (initMap()) loadWeather();
  loadDashboard();
  loadAlerts();
  window.setInterval(() => { loadDashboard(); loadAlerts(); }, 15000);
})();

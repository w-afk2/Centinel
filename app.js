(() => {
  'use strict';

  const DURATION = 60;
  const REFERENCES = { vehicle: [10, 18], quake: [31, 46] };
  const COLORS = {
    x: '#55dfbd', y: '#7cb7e8', z: '#eab672', magnitude: '#55dfbd',
    slow: '#55dfbd', fast: '#7cb7e8', threshold: '#eab672',
    candidate: '#859295', accepted: '#ee816d'
  };
  const scenarioText = {
    combined: 'Dos fuentes superpuestas para observar el rechazo del tránsito.',
    quake: 'Llegada P y fase S sintéticas; no representa un registro real.',
    vehicle: 'Ráfaga de vibración rápida para revisar posibles falsos positivos.',
    quiet: 'Solo ruido de fondo para revisar el nivel basal del detector.'
  };
  const hazardProfiles = {
    earthquake: {
      label: 'Sismo / terremoto', curve: [[0, 4], [.16, 7], [.3, 18], [.43, 42], [.55, 78], [.67, 98], [.82, 90], [1, 94]],
      advice: ['Durante el movimiento, agáchate y protégete junto a una estructura estable; cubre la cabeza y el cuello.', 'Cuando termine, sal con calma hacia un sitio seguro si el edificio presenta daños; evita regresar mientras exista peligro.', 'Escucha las indicaciones de INETER y SINAPRED y ayuda a quienes necesiten apoyo para evacuar.'],
      source: 'https://www.sinapred.gob.ni/index.php?Itemid=151&id=31&option=com_content&view=article'
    },
    hurricane: {
      label: 'Huracán / ciclón tropical', curve: [[0, 4], [.2, 7], [.4, 18], [.58, 39], [.74, 67], [.88, 91], [.96, 98], [1, 94]],
      advice: ['Sigue los avisos de INETER y SINAPRED; prepara documentos, agua, medicinas y una ruta de evacuación.', 'Aléjate de ríos, costas y zonas bajas si las autoridades indican evacuar; no salgas durante vientos peligrosos.', 'Resguárdate en un lugar seguro, lejos de ventanas, y espera la autorización oficial antes de volver.'],
      source: 'https://www.sinapred.gob.ni/index.php/aprendamos-de-prevencion'
    },
    flood: {
      label: 'Inundación', curve: [[0, 4], [.15, 7], [.32, 19], [.5, 42], [.65, 69], [.8, 92], [.9, 98], [1, 94]],
      advice: ['Trasládate a terreno alto y sigue las rutas de evacuación indicadas por las autoridades.', 'No camines, conduzcas ni cruces cauces o calles con agua en movimiento.', 'Mantente fuera de edificios y caminos inundados hasta recibir indicaciones oficiales.'],
      source: 'https://www.sinapred.gob.ni/index.php/aprendamos-de-prevencion'
    },
    heavyRain: {
      label: 'Lluvia extrema', curve: [[0, 4], [.18, 8], [.35, 23], [.52, 48], [.68, 72], [.82, 94], [.92, 98], [1, 93]],
      advice: ['Consulta los avisos oficiales y evita permanecer en cauces, quebradas o laderas inestables.', 'Si el agua sube o la autoridad lo indica, evacúa temprano hacia un sitio seguro.', 'No cruces caminos anegados ni te acerques a tendidos eléctricos caídos.'],
      source: 'https://www.sinapred.gob.ni/index.php/aprendamos-de-prevencion'
    },
    landslide: {
      label: 'Deslizamiento / deslave', curve: [[0, 4], [.17, 8], [.34, 22], [.5, 47], [.64, 72], [.78, 94], [.9, 99], [1, 94]],
      advice: ['Aléjate de inmediato de la ladera, el cauce y la trayectoria posible del material; avisa a otras personas.', 'Presta atención a grietas nuevas, inclinación de árboles o postes, caída de rocas y sonidos inusuales.', 'Reporta la situación al comité local y sigue la evacuación indicada por las autoridades.'],
      source: 'https://web-geofisica.ineter.gob.ni/alerta-temprana.html'
    },
    volcano: {
      label: 'Erupción volcánica', curve: [[0, 4], [.18, 7], [.36, 19], [.52, 43], [.68, 68], [.82, 89], [.94, 98], [1, 94]],
      advice: ['Respeta las zonas de exclusión y evacúa si lo indican las autoridades.', 'Ante caída de ceniza, permanece bajo techo si es seguro y protege ojos y vías respiratorias siguiendo la guía oficial.', 'Evita cauces y valles cercanos al volcán, donde pueden bajar flujos de lodo, y consulta avisos de INETER.'],
      source: 'https://www.sinapred.gob.ni/index.php/aprendamos-de-prevencion'
    },
    tsunami: {
      label: 'Tsunami / maremoto', curve: [[0, 4], [.17, 7], [.3, 16], [.42, 45], [.53, 82], [.62, 99], [.8, 96], [1, 94]],
      advice: ['Si estás en la costa y sientes un sismo fuerte o prolongado, aléjate de la playa y sube a terreno alto sin esperar a ver el mar.', 'Sigue las rutas de evacuación y los avisos de las autoridades; un tsunami puede tener varias olas.', 'No regreses a la costa hasta que las autoridades indiquen que es seguro.'],
      source: 'https://web-geofisica.ineter.gob.ni/alerta-temprana.html'
    },
    stormSurge: {
      label: 'Marejada ciclónica', curve: [[0, 4], [.2, 7], [.4, 17], [.58, 39], [.72, 68], [.86, 91], [.96, 98], [1, 94]],
      advice: ['Si vives cerca de la costa, esteros o desembocaduras, atiende las órdenes de evacuación con anticipación.', 'Dirígete tierra adentro o a un sitio alto siguiendo rutas oficiales; no te acerques a observar el oleaje.', 'Mantente fuera de zonas costeras hasta que SINAPRED o las autoridades locales den el aviso de retorno.'],
      source: 'https://www.sinapred.gob.ni/index.php/aprendamos-de-prevencion'
    },
    drought: {
      label: 'Sequía', curve: [[0, 4], [.2, 7], [.4, 17], [.58, 39], [.74, 65], [.88, 89], [.97, 98], [1, 94]],
      advice: ['Usa el agua de manera responsable y sigue las recomendaciones locales sobre abastecimiento y consumo seguro.', 'Protege del calor a niñas, niños, personas mayores, animales y cultivos; consulta a las autoridades de salud y agricultura.', 'Evita quemas y fogatas en vegetación seca, y reporta humo o fuego a las autoridades.'],
      source: 'https://www.sinapred.gob.ni/index.php/aprendamos-de-prevencion'
    },
    wildfire: {
      label: 'Incendio forestal', curve: [[0, 4], [.16, 8], [.32, 22], [.48, 46], [.63, 73], [.77, 93], [.9, 99], [1, 94]],
      advice: ['Al ver humo o fuego, avisa de inmediato a bomberos y autoridades locales.', 'Si el fuego se aproxima, aléjate y evacúa en dirección contraria al avance del incendio, según indiquen los equipos de emergencia.', 'No regreses al área hasta recibir autorización: el fuego puede reactivarse.'],
      source: 'https://www.sinapred.gob.ni/index.php/incendios-forestales'
    },
    thunderstorm: {
      label: 'Tormenta eléctrica', curve: [[0, 4], [.15, 8], [.28, 24], [.4, 53], [.5, 85], [.58, 99], [.76, 93], [1, 94]],
      advice: ['Refúgiate dentro de un edificio cerrado o vehículo con techo rígido; evita refugiarte bajo árboles aislados.', 'Aléjate de ventanas, agua y objetos metálicos conectados; desconecta equipos solo si puedes hacerlo con seguridad.', 'Espera a que pase la tormenta y atiende las alertas meteorológicas oficiales.'],
      source: 'https://www.sinapred.gob.ni/index.php/aprendamos-de-prevencion'
    },
    hail: {
      label: 'Granizada', curve: [[0, 4], [.15, 8], [.28, 24], [.4, 52], [.52, 83], [.6, 98], [.78, 92], [1, 94]],
      advice: ['Busca refugio bajo techo y aléjate de ventanas, tragaluces y superficies frágiles.', 'Evita conducir o permanecer al aire libre durante la caída de granizo.', 'Atiende los avisos meteorológicos y revisa posibles daños solo cuando haya pasado el peligro.'],
      source: 'https://www.sinapred.gob.ni/index.php/aprendamos-de-prevencion'
    },
    heat: {
      label: 'Ola de calor', curve: [[0, 4], [.2, 8], [.38, 20], [.55, 43], [.7, 68], [.84, 91], [.95, 98], [1, 94]],
      advice: ['Busca sombra o un lugar fresco y reduce el esfuerzo físico durante las horas de mayor calor.', 'Bebe agua con frecuencia y vigila a niñas, niños, personas mayores y personas enfermas.', 'Si alguien presenta confusión, desmayo o malestar intenso, busca atención médica de inmediato.'],
      source: 'https://www.sinapred.gob.ni/index.php/aprendamos-de-prevencion'
    },
    strongWinds: {
      label: 'Vientos extremos', curve: [[0, 4], [.17, 7], [.32, 21], [.46, 48], [.58, 77], [.68, 97], [.82, 91], [1, 94]],
      advice: ['Resguárdate en un edificio sólido, lejos de ventanas y objetos que puedan caer o salir proyectados.', 'Evita árboles, rótulos, tendidos eléctricos y zonas expuestas; no intentes cruzar áreas dañadas.', 'Sigue los avisos oficiales y espera instrucciones antes de salir.'],
      source: 'https://www.sinapred.gob.ni/index.php/aprendamos-de-prevencion'
    },
    tornado: {
      label: 'Tornado / viento tornádico', curve: [[0, 4], [.18, 8], [.32, 27], [.43, 59], [.51, 89], [.57, 99], [.75, 91], [1, 94]],
      advice: ['Entra a una habitación interior, en el nivel más bajo disponible, y aléjate de puertas y ventanas.', 'Cubre la cabeza y sigue las instrucciones de emergencia locales; no te refugies bajo puentes o pasos elevados.', 'No salgas a inspeccionar los daños hasta que las autoridades indiquen que el peligro pasó.'],
      source: 'https://www.sinapred.gob.ni/index.php/aprendamos-de-prevencion'
    },
    other: {
      label: 'Otro fenómeno natural', curve: [[0, 4], [.18, 8], [.36, 22], [.54, 48], [.7, 72], [.84, 92], [.94, 98], [1, 94]],
      advice: ['Identifica el peligro inmediato y aléjate de la zona expuesta si hacerlo es seguro.', 'Busca información en los canales oficiales de SINAPRED, INETER y las autoridades de tu localidad.', 'Sigue las instrucciones de evacuación y apoyo emitidas para el fenómeno específico.'],
      source: 'https://www.sinapred.gob.ni/index.php/aprendamos-de-prevencion'
    }
  };
  const riskBands = [
    { key: 'low', min: 0, label: 'BAJO', title: 'Riesgo bajo', copy: 'Escenario en nivel inicial. Mantén atención a la evolución de la simulación.', className: 'risk-low', color: '#55dfbd' },
    { key: 'attention', min: 25, label: 'ATENCIÓN', title: 'Atención', copy: 'El índice subió a nivel de atención. Revisa las recomendaciones preventivas.', className: 'risk-attention', color: '#eab672' },
    { key: 'high', min: 50, label: 'ALTO', title: 'Riesgo alto', copy: 'La simulación entró en nivel alto. Prepárate para seguir instrucciones oficiales.', className: 'risk-high', color: '#f39b63' },
    { key: 'critical', min: 80, label: 'CRÍTICO', title: 'Punto crítico', copy: 'La curva alcanzó el punto crítico simulado. Esto no es una alerta oficial.', className: 'risk-critical', color: '#ee816d' }
  ];
  const defaults = {
    sampleRate: 100, noise: 0.004, vehicleAmp: 0.045, quakeAmp: 0.085,
    threshold: 0.012, ratio: 1.25, persistence: 2.0, scenario: 'combined', phenomenon: 'earthquake'
  };

  const el = (id) => document.getElementById(id);
  const ui = {
    phenomenon: el('phenomenon'), scenario: el('scenario'), scenarioNote: el('scenarioNote'), sampleRate: el('sampleRate'),
    noise: el('noise'), vehicleAmp: el('vehicleAmp'), quakeAmp: el('quakeAmp'),
    threshold: el('threshold'), ratio: el('ratio'), persistence: el('persistence'),
    signalView: el('signalView'), speed: el('speed'), runBtn: el('runBtn'), resetBtn: el('resetBtn'),
    playBtn: el('playBtn'), playLabel: el('playLabel'), restartBtn: el('restartBtn'), exportBtn: el('exportBtn'),
    signalChart: el('signalChart'), energyChart: el('energyChart'), alarmChart: el('alarmChart'), riskChart: el('riskChart'),
    runId: el('runId'), runStatus: el('runStatus'), peakValue: el('peakValue'), slowValue: el('slowValue'),
    eventsValue: el('eventsValue'), ratioValue: el('ratioValue'), detectorStatus: el('detectorStatus'),
    statusTitle: el('statusTitle'), statusCopy: el('statusCopy'), energyCriterion: el('energyCriterion'),
    persistenceCriterion: el('persistenceCriterion'), eventList: el('eventList'), eventCountLabel: el('eventCountLabel'),
    cursorReadout: el('cursorReadout'), timeLabel: el('timeLabel'), endTimeLabel: el('endTimeLabel'),
    durationLabel: el('durationLabel'), progressFill: el('progressFill'), progressThumb: el('progressThumb'),
    hazardName: el('hazardName'), hazardStatus: el('hazardStatus'), hazardStatusTitle: el('hazardStatusTitle'),
    hazardStatusCopy: el('hazardStatusCopy'), hazardLiveLabel: el('hazardLiveLabel'), riskCurrent: el('riskCurrent'),
    riskAverage: el('riskAverage'), riskTimeLabel: el('riskTimeLabel'), recommendationTitle: el('recommendationTitle'),
    recommendationLevel: el('recommendationLevel'), recommendationList: el('recommendationList'),
    hazardAnnouncement: el('hazardAnnouncement')
  };

  const state = {
    data: null, events: [], candidate: null, accepted: null, scenario: 'combined', risk: null,
    phenomenon: 'earthquake', lastRiskBand: 'low', started: false,
    cursor: 0, hoverCursor: null, playing: false, raf: 0, playStartedAt: 0,
    playFrom: 0, runNumber: 0, updateTimer: 0
  };

  function readParams() {
    return {
      sampleRate: Number(ui.sampleRate.value),
      noise: Number(ui.noise.value),
      vehicleAmp: Number(ui.vehicleAmp.value),
      quakeAmp: Number(ui.quakeAmp.value),
      threshold: Number(ui.threshold.value),
      ratio: Number(ui.ratio.value),
      persistence: Number(ui.persistence.value),
      scenario: ui.scenario.value
    };
  }

  function formatParam(key, value) {
    if (key === 'sampleRate') return `${value} Hz`;
    if (key === 'noise' || key === 'vehicleAmp' || key === 'quakeAmp' || key === 'threshold') return `${Number(value).toFixed(3)} g`;
    if (key === 'ratio') return `${Number(value).toFixed(2)} ×`;
    if (key === 'persistence') return `${Number(value).toFixed(1)} s`;
    return String(value);
  }

  function syncControls() {
    for (const key of ['sampleRate', 'noise', 'vehicleAmp', 'quakeAmp', 'threshold', 'ratio', 'persistence']) {
      el(`${key}Out`).textContent = formatParam(key, Number(ui[key].value));
    }
    ui.scenarioNote.textContent = scenarioText[ui.scenario.value];
  }

  function getHazardProfile() {
    return hazardProfiles[ui.phenomenon.value] || hazardProfiles.other;
  }

  function updateHazardProfile() {
    const profile = getHazardProfile();
    ui.hazardName.textContent = profile.label;
    ui.recommendationTitle.textContent = `Recomendaciones · ${profile.label}`;
    const source = el('hazardSource');
    source.href = profile.source;
    ui.recommendationList.replaceChildren();
    for (const recommendation of profile.advice) {
      const item = document.createElement('li');
      item.textContent = recommendation;
      ui.recommendationList.append(item);
    }
  }

  function interpolateRisk(points, fraction) {
    for (let i = 1; i < points.length; i++) {
      if (fraction <= points[i][0]) {
        const [startX, startY] = points[i - 1];
        const [endX, endY] = points[i];
        const raw = Math.max(0, Math.min(1, (fraction - startX) / (endX - startX)));
        const eased = raw * raw * (3 - 2 * raw);
        return startY + (endY - startY) * eased;
      }
    }
    return points[points.length - 1][1];
  }

  function generateRiskSeries(profile, count) {
    const values = new Float32Array(count);
    const averages = new Float32Array(count);
    let sum = 0;
    for (let i = 0; i < count; i++) {
      const fraction = i / Math.max(1, count - 1);
      const value = interpolateRisk(profile.curve, fraction);
      values[i] = value;
      sum += value;
      averages[i] = sum / (i + 1);
    }
    return { values, averages };
  }

  function riskBandFor(value) {
    let selected = riskBands[0];
    for (const band of riskBands) if (value >= band.min) selected = band;
    return selected;
  }

  function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gaussianGenerator(random) {
    let spare = null;
    return () => {
      if (spare !== null) {
        const value = spare;
        spare = null;
        return value;
      }
      let u = 0;
      let v = 0;
      while (u === 0) u = random();
      while (v === 0) v = random();
      const radius = Math.sqrt(-2 * Math.log(u));
      const angle = 2 * Math.PI * v;
      spare = radius * Math.sin(angle);
      return radius * Math.cos(angle);
    };
  }

  function generateSignal(params, seed) {
    const fs = params.sampleRate;
    const count = DURATION * fs + 1;
    const time = new Float32Array(count);
    const axes = [new Float32Array(count), new Float32Array(count), new Float32Array(count)];
    const random = seededRandom(seed);
    const normal = gaussianGenerator(random);
    const hasVehicle = params.scenario === 'combined' || params.scenario === 'vehicle';
    const hasQuake = params.scenario === 'combined' || params.scenario === 'quake';
    const vehicleScale = params.vehicleAmp / defaults.vehicleAmp;
    const quakeScale = params.quakeAmp / defaults.quakeAmp;

    for (let i = 0; i < count; i++) {
      const t = i / fs;
      time[i] = t;
      axes[0][i] = params.noise * normal();
      axes[1][i] = params.noise * normal();
      axes[2][i] = params.noise * normal();

      if (hasVehicle && t >= 10 && t < 18) {
        const tau = t - 10;
        const envelope = Math.sin(Math.PI * tau / 8) ** 2 * vehicleScale;
        axes[0][i] += 0.045 * envelope * Math.sin(2 * Math.PI * 8 * tau);
        axes[1][i] += 0.030 * envelope * Math.sin(2 * Math.PI * 10 * tau + 0.5);
        axes[2][i] += 0.020 * envelope * Math.sin(2 * Math.PI * 7 * tau + 1.1);
      }

      if (hasQuake && t >= 31 && t < 33) {
        const tau = t - 31;
        const envelope = Math.sin(Math.PI * tau / 2) ** 2 * quakeScale;
        axes[0][i] += 0.022 * envelope * Math.sin(2 * Math.PI * 3.2 * tau);
        axes[1][i] += 0.015 * envelope * Math.sin(2 * Math.PI * 2.8 * tau + 0.4);
      } else if (hasQuake && t >= 33 && t < 46) {
        const tau = t - 33;
        const taper = Math.max(0, Math.sin(Math.PI * tau / 13));
        const envelope = (0.085 * Math.exp(-tau / 7) + 0.025) * Math.pow(taper, 0.35) * quakeScale;
        axes[0][i] += envelope * (Math.sin(2 * Math.PI * 2.0 * tau) + 0.35 * Math.sin(2 * Math.PI * 3.6 * tau));
        axes[1][i] += 0.70 * envelope * Math.sin(2 * Math.PI * 1.7 * tau + 0.4);
        axes[2][i] += 0.35 * envelope * Math.sin(2 * Math.PI * 2.6 * tau + 0.8);
      }
    }
    return { time, axes, fs, hasVehicle, hasQuake };
  }

  function trailingMean(values, window) {
    const output = new Float32Array(values.length);
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      sum += values[i];
      if (i >= window) sum -= values[i - window];
      output[i] = sum / Math.min(i + 1, window);
    }
    return output;
  }

  function closeBriefGaps(mask, maxGap) {
    let previousEnd = -1;
    let index = 0;
    while (index < mask.length) {
      if (!mask[index]) { index++; continue; }
      const start = index;
      while (index + 1 < mask.length && mask[index + 1]) index++;
      const end = index;
      if (previousEnd >= 0 && start - previousEnd - 1 <= maxGap) {
        for (let j = previousEnd + 1; j < start; j++) mask[j] = 1;
      }
      previousEnd = end;
      index++;
    }
    return mask;
  }

  function findIntervals(mask, minSamples) {
    const intervals = [];
    let start = -1;
    for (let i = 0; i <= mask.length; i++) {
      const active = i < mask.length && Boolean(mask[i]);
      if (active && start < 0) start = i;
      if (!active && start >= 0) {
        const end = i - 1;
        if (end - start + 1 >= minSamples) intervals.push([start, end]);
        start = -1;
      }
    }
    return intervals;
  }

  function analyzeSignal(data, params) {
    const { axes, fs } = data;
    const n = data.time.length;
    const shortWindow = Math.max(3, Math.round(0.18 * fs));
    const longWindow = Math.round(2 * fs);
    const rmsWindow = Math.round(fs);
    const lowSquared = new Float32Array(n);
    const fastSquared = new Float32Array(n);
    const totalSquared = new Float32Array(n);

    const shortMeans = axes.map((axis) => trailingMean(axis, shortWindow));
    const longMeans = axes.map((axis) => trailingMean(axis, longWindow));
    for (let i = 0; i < n; i++) {
      let lowPower = 0;
      let fastPower = 0;
      let totalPower = 0;
      for (let axis = 0; axis < 3; axis++) {
        const low = shortMeans[axis][i] - longMeans[axis][i];
        const fast = axes[axis][i] - shortMeans[axis][i];
        lowPower += low * low;
        fastPower += fast * fast;
        totalPower += axes[axis][i] * axes[axis][i];
      }
      lowSquared[i] = lowPower;
      fastSquared[i] = fastPower;
      totalSquared[i] = totalPower;
    }

    const lowRms = Float32Array.from(trailingMean(lowSquared, rmsWindow), Math.sqrt);
    const fastRms = Float32Array.from(trailingMean(fastSquared, rmsWindow), Math.sqrt);
    const totalRms = Float32Array.from(trailingMean(totalSquared, rmsWindow), Math.sqrt);
    const magnitude = new Float32Array(n);
    const candidate = new Uint8Array(n);
    const minLevel = Math.max(0.018, params.threshold * 1.5);
    let peak = 0;
    let maxSlow = 0;
    let maxRatio = 0;

    for (let i = 0; i < n; i++) {
      const mag = Math.hypot(axes[0][i], axes[1][i], axes[2][i]);
      magnitude[i] = mag;
      if (mag > peak) peak = mag;
      if (lowRms[i] > maxSlow) maxSlow = lowRms[i];
      if (i >= longWindow && lowRms[i] > params.threshold) {
        maxRatio = Math.max(maxRatio, lowRms[i] / Math.max(fastRms[i], 1e-8));
        if (lowRms[i] > params.ratio * fastRms[i] && totalRms[i] > minLevel) candidate[i] = 1;
      }
    }

    closeBriefGaps(candidate, Math.round(0.4 * fs));
    const accepted = new Uint8Array(n);
    const runs = findIntervals(candidate, Math.ceil(params.persistence * fs));
    const events = [];
    for (const [start, end] of runs) {
      for (let i = start; i <= end; i++) accepted[i] = 1;
      const startTime = data.time[start];
      const endTime = data.time[end];
      let eventPeak = 0;
      for (let i = start; i <= end; i++) eventPeak = Math.max(eventPeak, magnitude[i]);
      const overlapsQuake = data.hasQuake && endTime >= REFERENCES.quake[0] && startTime <= REFERENCES.quake[1];
      const overlapsVehicle = data.hasVehicle && endTime >= REFERENCES.vehicle[0] && startTime <= REFERENCES.vehicle[1];
      const kind = overlapsQuake ? 'quake' : (overlapsVehicle ? 'vehicle' : 'other');
      events.push({ start: startTime, end: endTime, duration: endTime - startTime + 1 / fs, peak: eventPeak, kind });
    }

    return { lowRms, fastRms, totalRms, magnitude, candidate, accepted, events, peak, maxSlow, maxRatio };
  }

  function formatClock(seconds) {
    const safe = Math.max(0, seconds);
    const minutes = Math.floor(safe / 60);
    const whole = Math.floor(safe % 60);
    const tenths = Math.floor((safe % 1) * 10);
    return `${String(minutes).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${tenths}`;
  }

  function currentCursor() {
    if (state.hoverCursor !== null) return state.hoverCursor;
    return state.cursor;
  }

  function drawChart(canvas, config) {
    if (!state.data || !canvas.clientWidth || !canvas.clientHeight) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const margin = { left: 51, right: 12, top: 13, bottom: 27 };
    const plotWidth = Math.max(10, width - margin.left - margin.right);
    const plotHeight = Math.max(10, height - margin.top - margin.bottom);
    const xForTime = (time) => margin.left + Math.max(0, Math.min(DURATION, time)) / DURATION * plotWidth;
    const yForValue = (value) => margin.top + (config.max - value) / (config.max - config.min) * plotHeight;
    const textColor = '#738286';
    const gridColor = 'rgba(117, 135, 138, .16)';
    const tickCount = config.tickCount || 4;

    ctx.save();
    ctx.beginPath();
    ctx.rect(margin.left, margin.top, plotWidth, plotHeight);
    ctx.clip();

    if (config.zones) {
      for (const zone of config.zones) {
        const x1 = xForTime(zone.start);
        const x2 = xForTime(zone.end);
        ctx.fillStyle = zone.color;
        ctx.fillRect(x1, margin.top, Math.max(0, x2 - x1), plotHeight);
        if (zone.label) {
          ctx.fillStyle = zone.textColor;
          ctx.font = '8px "DM Mono", ui-monospace, monospace';
          ctx.fillText(zone.label, x1 + 5, margin.top + 11);
        }
      }
    }

    for (let i = 0; i <= tickCount; i++) {
      const fraction = i / tickCount;
      const value = config.max - (config.max - config.min) * fraction;
      const y = margin.top + plotHeight * fraction;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(margin.left, y); ctx.lineTo(margin.left + plotWidth, y); ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.font = '9px "DM Mono", ui-monospace, monospace';
      ctx.fillText(config.yFormat ? config.yFormat(value) : value.toFixed(2), margin.left - 7, y);
    }

    const timeStep = 15;
    for (let time = 0; time <= DURATION; time += timeStep) {
      const x = xForTime(time);
      ctx.strokeStyle = gridColor;
      ctx.beginPath(); ctx.moveTo(x, margin.top); ctx.lineTo(x, margin.top + plotHeight); ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.textAlign = time === 0 ? 'left' : time === DURATION ? 'right' : 'center';
      ctx.textBaseline = 'top';
      ctx.font = '9px "DM Mono", ui-monospace, monospace';
      ctx.fillText(`${time}s`, x, margin.top + plotHeight + 8);
    }

    if (config.threshold !== undefined) {
      const y = yForValue(config.threshold);
      ctx.strokeStyle = config.thresholdColor || COLORS.threshold;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(margin.left, y); ctx.lineTo(margin.left + plotWidth, y); ctx.stroke();
      ctx.setLineDash([]);
    }

    const n = state.data.time.length;
    const stride = Math.max(1, Math.floor(n / Math.max(plotWidth * 1.25, 1)));
    for (const series of config.series) {
      if (!series.values) continue;
      ctx.strokeStyle = series.color;
      ctx.lineWidth = series.width || 1.25;
      ctx.globalAlpha = series.alpha === undefined ? 0.95 : series.alpha;
      ctx.setLineDash(series.dash || []);
      ctx.beginPath();
      let first = true;
      let previousX = 0;
      let previousY = 0;
      for (let i = 0; i < n; i += stride) {
        const x = margin.left + i / (n - 1) * plotWidth;
        const y = yForValue(series.values[i]);
        if (first) {
          ctx.moveTo(x, y); first = false;
        } else if (series.step) {
          ctx.lineTo(x, previousY); ctx.lineTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        previousX = x; previousY = y;
      }
      if (n > 1 && (n - 1) % stride !== 0) {
        const x = margin.left + plotWidth;
        const y = yForValue(series.values[n - 1]);
        if (series.step) { ctx.lineTo(x, previousY); ctx.lineTo(x, y); }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    }

    const cursor = currentCursor();
    if (cursor >= 0 && cursor <= DURATION) {
      const x = xForTime(cursor);
      ctx.strokeStyle = 'rgba(223, 239, 233, .65)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(x, margin.top); ctx.lineTo(x, margin.top + plotHeight); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(117, 135, 138, .25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(margin.left, margin.top, plotWidth, plotHeight);
  }

  function getZones() {
    const zones = [];
    if (state.data.hasVehicle) zones.push({ start: 10, end: 18, color: 'rgba(234,182,114,.07)', label: 'TRÁNSITO', textColor: 'rgba(234,182,114,.72)' });
    if (state.data.hasQuake) zones.push({ start: 31, end: 46, color: 'rgba(238,129,109,.065)', label: 'EVENTO SINTÉTICO', textColor: 'rgba(238,129,109,.75)' });
    return zones;
  }

  function renderRiskChart() {
    if (!state.data || !state.risk) return;
    const canvas = ui.riskChart;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const margin = { left: 40, right: 12, top: 12, bottom: 25 };
    const plotWidth = rect.width - margin.left - margin.right;
    const plotHeight = rect.height - margin.top - margin.bottom;
    if (plotWidth <= 0 || plotHeight <= 0) return;
    const xAt = (seconds) => margin.left + seconds / DURATION * plotWidth;
    const yAt = (value) => margin.top + (100 - value) / 100 * plotHeight;
    const grid = 'rgba(122, 139, 140, .13)';
    const text = '#78888b';

    const zones = [
      { from: 0, to: 25, color: 'rgba(85,223,189,.045)' },
      { from: 25, to: 50, color: 'rgba(234,182,114,.045)' },
      { from: 50, to: 80, color: 'rgba(243,155,99,.05)' },
      { from: 80, to: 100, color: 'rgba(238,129,109,.065)' }
    ];
    for (const zone of zones) {
      ctx.fillStyle = zone.color;
      ctx.fillRect(margin.left, yAt(zone.to), plotWidth, yAt(zone.from) - yAt(zone.to));
    }

    for (const value of [0, 25, 50, 75, 100]) {
      const y = yAt(value);
      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(margin.left, y); ctx.lineTo(margin.left + plotWidth, y); ctx.stroke();
      ctx.fillStyle = text;
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.font = '9px "DM Mono", ui-monospace, monospace';
      ctx.fillText(String(value), margin.left - 7, y);
    }
    ctx.strokeStyle = 'rgba(238,129,109,.55)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(margin.left, yAt(80)); ctx.lineTo(margin.left + plotWidth, yAt(80)); ctx.stroke();
    ctx.setLineDash([]);
    for (let seconds = 0; seconds <= DURATION; seconds += 15) {
      const x = xAt(seconds);
      ctx.strokeStyle = grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, margin.top); ctx.lineTo(x, margin.top + plotHeight); ctx.stroke();
      ctx.fillStyle = text;
      ctx.textAlign = seconds === 0 ? 'left' : seconds === DURATION ? 'right' : 'center';
      ctx.textBaseline = 'top'; ctx.font = '9px "DM Mono", ui-monospace, monospace';
      ctx.fillText(`${seconds}s`, x, margin.top + plotHeight + 8);
    }

    const currentIndex = Math.min(state.risk.values.length - 1, Math.round(state.cursor * state.data.fs));
    const stride = Math.max(1, Math.floor(state.data.fs / Math.max(1, plotWidth / DURATION)));
    const series = [
      { values: state.risk.values, color: '#55dfbd', width: 2, dash: [] },
      { values: state.risk.averages, color: '#7cb7e8', width: 1.5, dash: [5, 4] }
    ];
    for (let s = 0; s < series.length; s++) {
      const line = series[s];
      ctx.strokeStyle = line.color; ctx.lineWidth = line.width; ctx.setLineDash(line.dash);
      ctx.beginPath();
      let first = true;
      let lastIndex = 0;
      for (let i = 0; i <= currentIndex; i += stride) {
        const x = xAt(i / state.data.fs);
        const y = yAt(line.values[i]);
        if (first) { ctx.moveTo(x, y); first = false; }
        else ctx.lineTo(x, y);
        lastIndex = i;
      }
      if (currentIndex > lastIndex) ctx.lineTo(xAt(currentIndex / state.data.fs), yAt(line.values[currentIndex]));
      ctx.stroke(); ctx.setLineDash([]);
    }

    const currentTime = Math.max(0, Math.min(DURATION, state.cursor));
    const cursorX = xAt(currentTime);
    ctx.strokeStyle = 'rgba(223,239,233,.6)'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(cursorX, margin.top); ctx.lineTo(cursorX, margin.top + plotHeight); ctx.stroke(); ctx.setLineDash([]);
    const currentRisk = state.risk.values[currentIndex];
    ctx.fillStyle = '#55dfbd'; ctx.beginPath(); ctx.arc(cursorX, yAt(currentRisk), 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(17,24,28,.9)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(117,135,138,.25)'; ctx.lineWidth = 1;
    ctx.strokeRect(margin.left, margin.top, plotWidth, plotHeight);
  }

  function updateHazardReadout() {
    if (!state.risk || !state.data) return;
    const index = Math.min(state.risk.values.length - 1, Math.round(state.cursor * state.data.fs));
    const risk = state.risk.values[index];
    const average = state.risk.averages[index];
    const band = riskBandFor(risk);
    const bandRank = riskBands.indexOf(band);
    const previousRank = riskBands.findIndex((item) => item.key === state.lastRiskBand);
    const isEscalation = state.started && bandRank > previousRank;
    state.lastRiskBand = band.key;

    if (isEscalation) {
      state.alerting = true;
      ui.hazardAnnouncement.textContent = `Alerta de ${getHazardProfile().label}: nivel ${band.label}. ${band.copy}`;
      window.clearTimeout(state.alertTimer);
      state.alertTimer = window.setTimeout(() => {
        state.alerting = false;
        ui.hazardStatus.classList.remove('is-escalating');
      }, 1100);
    }
    ui.hazardStatus.className = `hazard-status ${band.className}${state.alerting ? ' is-escalating' : ''}`;
    ui.hazardStatusTitle.textContent = !state.started
      ? 'Riesgo bajo · esperando inicio'
      : bandRank > 0 ? `ALERTA · ${band.title}` : band.title;
    ui.hazardStatusCopy.textContent = !state.started
      ? 'Presiona «Iniciar simulación automática» para ver cómo evolucionan los datos y las alertas.'
      : band.copy;
    el('hazardStatus').querySelector('.hazard-status-mark').textContent = band.key === 'low' ? '✓' : band.key === 'critical' ? '!' : '↗';
    ui.hazardLiveLabel.textContent = state.playing ? 'ALERTAS ACTIVAS' : state.started && state.cursor >= DURATION ? 'SIMULACIÓN COMPLETADA' : state.started ? 'REPRODUCCIÓN PAUSADA' : 'SIMULACIÓN EN ESPERA';
    ui.riskCurrent.textContent = String(Math.round(risk)).padStart(2, '0');
    ui.riskAverage.textContent = `Promedio ${String(Math.round(average)).padStart(2, '0')} / 100`;
    ui.recommendationLevel.textContent = `NIVEL ${band.label}`;
    ui.recommendationLevel.className = `recommendation-level ${band.className}`;
    ui.riskTimeLabel.textContent = `${formatClock(state.cursor)} / ${formatClock(DURATION)}`;
  }

  function renderCharts() {
    if (!state.data) return;
    const { axes } = state.data;
    const output = state.analysis;
    const view = ui.signalView.value;
    const zones = getZones();
    let signalSeries;
    let signalMin;
    let signalMax;
    if (view === 'magnitude') {
      const max = Math.max(0.025, output.peak * 1.1);
      signalMin = 0;
      signalMax = max;
      signalSeries = [{ name: 'Magnitud vectorial', values: output.magnitude, color: COLORS.magnitude, width: 1.5 }];
    } else {
      let max = 0;
      for (const axis of axes) for (let i = 0; i < axis.length; i++) max = Math.max(max, Math.abs(axis[i]));
      const limit = Math.max(0.035, max * 1.12);
      signalMin = -limit;
      signalMax = limit;
      signalSeries = [
        { name: 'Eje X', values: axes[0], color: COLORS.x, width: 1.15 },
        { name: 'Eje Y', values: axes[1], color: COLORS.y, width: 1.05 },
        { name: 'Eje Z', values: axes[2], color: COLORS.z, width: 1.05 }
      ];
    }
    el('axisLegendItems').classList.toggle('is-hidden', view === 'magnitude');
    el('magnitudeLegendItem').classList.toggle('is-hidden', view !== 'magnitude');
    drawChart(ui.signalChart, { min: signalMin, max: signalMax, series: signalSeries, zones, tickCount: 4, yFormat: (v) => v.toFixed(2) });

    const currentThreshold = readParams().threshold;
    const energyMax = Math.max(0.025, currentThreshold, output.maxSlow, Math.max(...sampleValues(output.fastRms, 500))) * 1.18;
    drawChart(ui.energyChart, {
      min: 0, max: energyMax, threshold: currentThreshold, thresholdColor: COLORS.threshold,
      zones, tickCount: 3, yFormat: (v) => v.toFixed(3),
      series: [
        { name: 'Banda lenta', values: output.lowRms, color: COLORS.slow, width: 1.45 },
        { name: 'Banda rápida', values: output.fastRms, color: COLORS.fast, width: 1.15 }
      ]
    });

    const binaryCandidate = output.candidate;
    const binaryAccepted = output.accepted;
    drawChart(ui.alarmChart, {
      min: -0.06, max: 1.12, zones, tickCount: 2,
      yFormat: (v) => v > 0.55 ? 'SÍ' : v < 0.45 ? 'NO' : '',
      series: [
        { name: 'Candidato', values: binaryCandidate, color: COLORS.candidate, width: 1.15, step: true, alpha: .8 },
        { name: 'Aceptado', values: binaryAccepted, color: COLORS.accepted, width: 1.8, step: true }
      ]
    });
    updateCursorReadout();
    updateHazardReadout();
    renderRiskChart();
  }

  function sampleValues(values, targetCount) {
    const step = Math.max(1, Math.floor(values.length / targetCount));
    const result = [];
    for (let i = 0; i < values.length; i += step) result.push(values[i]);
    return result;
  }

  function renderMetrics(params) {
    const analysis = state.analysis;
    ui.peakValue.innerHTML = `${analysis.peak.toFixed(3)}<small> g</small>`;
    ui.slowValue.innerHTML = `${analysis.maxSlow.toFixed(3)}<small> g</small>`;
    ui.eventsValue.innerHTML = `${analysis.events.length}<small> evt</small>`;
    ui.ratioValue.innerHTML = `${analysis.maxRatio.toFixed(2)}<small> ×</small>`;
    ui.energyCriterion.innerHTML = `${params.threshold.toFixed(3)} <small>g RMS</small>`;
    ui.persistenceCriterion.innerHTML = `${params.persistence.toFixed(1)} <small>s</small>`;
    ui.eventCountLabel.textContent = `${analysis.events.length} ${analysis.events.length === 1 ? 'EVENTO' : 'EVENTOS'}`;
    ui.durationLabel.textContent = `${DURATION} s de señal`;
    ui.endTimeLabel.textContent = formatClock(DURATION);

    const quakeEvent = analysis.events.some((event) => event.kind === 'quake');
    const vehicleEvent = analysis.events.some((event) => event.kind === 'vehicle');
    ui.detectorStatus.className = 'detector-status';
    if (quakeEvent) {
      ui.detectorStatus.classList.add('status-alert');
      el('statusSymbol').textContent = '!';
      ui.statusTitle.textContent = 'Patrón sísmico sintético';
      ui.statusCopy.textContent = 'El detector aceptó una ventana que coincide con la fuente sísmica generada.';
    } else if (vehicleEvent || analysis.events.length) {
      ui.detectorStatus.classList.add('status-warning');
      el('statusSymbol').textContent = '↗';
      ui.statusTitle.textContent = vehicleEvent ? 'Tránsito aceptado por el detector' : 'Actividad persistente detectada';
      ui.statusCopy.textContent = vehicleEvent ? 'Esta combinación de filtros no rechazó la vibración vehicular.' : 'Se aceptó una ventana persistente fuera de las fuentes etiquetadas.';
    } else {
      ui.detectorStatus.classList.add('status-clear');
      el('statusSymbol').textContent = '✓';
      ui.statusTitle.textContent = 'Sin eventos aceptados';
      ui.statusCopy.textContent = params.scenario === 'combined' || params.scenario === 'quake'
        ? 'La señal sísmica sintética no superó todos los criterios.'
        : 'Ninguna vibración superó los criterios configurados.';
    }
    renderEvents(analysis.events);
  }

  function renderEvents(events) {
    ui.eventList.replaceChildren();
    if (!events.length) {
      const empty = document.createElement('div');
      empty.className = 'event-empty';
      empty.textContent = 'Ningún intervalo superó todos los criterios de energía y persistencia.';
      ui.eventList.append(empty);
      return;
    }
    for (const event of events) {
      const row = document.createElement('div');
      row.className = `event-row${event.kind === 'vehicle' ? ' vehicle' : ''}`;
      const dot = document.createElement('i'); dot.className = 'event-row-dot';
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = event.kind === 'quake' ? 'Coincide con sismo sintético' : event.kind === 'vehicle' ? 'Coincide con tránsito sintético' : 'Evento persistente';
      const detail = document.createElement('small');
      detail.textContent = `${formatClock(event.start)}–${formatClock(event.end)} · pico ${event.peak.toFixed(3)} g`;
      copy.append(title, detail);
      const duration = document.createElement('span'); duration.className = 'event-duration'; duration.textContent = `${event.duration.toFixed(1)} s`;
      row.append(dot, copy, duration);
      ui.eventList.append(row);
    }
  }

  function updateCursorReadout() {
    if (!state.data || !state.analysis) return;
    const time = Math.min(DURATION, Math.max(0, currentCursor()));
    const index = Math.min(state.data.time.length - 1, Math.round(time * state.data.fs));
    const axes = state.data.axes;
    ui.cursorReadout.textContent = `t = ${formatClock(time)} · X ${axes[0][index] >= 0 ? '+' : ''}${axes[0][index].toFixed(3)} · Y ${axes[1][index] >= 0 ? '+' : ''}${axes[1][index].toFixed(3)} · Z ${axes[2][index] >= 0 ? '+' : ''}${axes[2][index].toFixed(3)} g`;
    ui.timeLabel.textContent = formatClock(time);
    const progress = Math.max(0, Math.min(100, time / DURATION * 100));
    ui.progressFill.style.width = `${progress}%`;
    ui.progressThumb.style.left = `${progress}%`;
    const progressTrack = el('progressTrack');
    progressTrack.setAttribute('aria-valuenow', String(Math.round(time)));
    progressTrack.setAttribute('aria-valuetext', formatClock(time));
  }

  function updateRunState(label, isPlaying = false) {
    el('runStatusText').textContent = label;
    ui.runStatus.classList.toggle('is-playing', isPlaying);
  }

  function stopPlayback() {
    state.playing = false;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
    ui.playBtn.classList.remove('is-playing');
    ui.playBtn.setAttribute('aria-label', 'Reproducir simulación');
    ui.playLabel.textContent = 'Reproducir';
  }

  function runSimulation() {
    window.clearTimeout(state.updateTimer);
    stopPlayback();
    const params = readParams();
    state.runNumber++;
    const seed = (Date.now() + state.runNumber * 7919) >>> 0;
    state.scenario = params.scenario;
    state.phenomenon = ui.phenomenon.value;
    state.started = false;
    state.lastRiskBand = 'low';
    state.alerting = false;
    window.clearTimeout(state.alertTimer);
    state.data = generateSignal(params, seed);
    state.analysis = analyzeSignal(state.data, params);
    state.risk = generateRiskSeries(getHazardProfile(), state.data.time.length);
    state.cursor = 0;
    state.hoverCursor = null;
    ui.runId.textContent = `CEN-${String(state.runNumber).padStart(4, '0')}`;
    renderMetrics(params);
    updateRunState('ANALIZADO');
    renderCharts();
  }

  function animationFrame(now) {
    if (!state.playing) return;
    const speed = Number(ui.speed.value);
    state.cursor = Math.min(DURATION, state.playFrom + (now - state.playStartedAt) / 1000 * speed);
    renderCharts();
    if (state.cursor >= DURATION) {
      state.cursor = DURATION;
      stopPlayback();
      updateRunState('COMPLETADO');
      renderCharts();
      return;
    }
    state.raf = requestAnimationFrame(animationFrame);
  }

  function togglePlayback() {
    if (!state.data) return;
    if (state.playing) {
      stopPlayback();
      updateRunState('PAUSADO');
      renderCharts();
      return;
    }
    if (state.cursor >= DURATION) state.cursor = 0;
    state.hoverCursor = null;
    state.started = true;
    state.playing = true;
    state.playStartedAt = performance.now();
    state.playFrom = state.cursor;
    ui.playBtn.classList.add('is-playing');
    ui.playBtn.setAttribute('aria-label', 'Pausar simulación');
    ui.playLabel.textContent = 'Pausar';
    updateRunState('REPRODUCIENDO', true);
    state.raf = requestAnimationFrame(animationFrame);
  }

  function resetCursor() {
    stopPlayback();
    state.cursor = 0;
    state.hoverCursor = null;
    state.started = false;
    updateRunState('ANALIZADO');
    renderCharts();
  }

  function exportCsv() {
    if (!state.data) return;
    const { time, axes } = state.data;
    const analysis = state.analysis;
    const profile = getHazardProfile();
    const rows = ['phenomenon,phenomenon_label,time_s,ax_g,ay_g,az_g,magnitude_g,risk_index,risk_average,slow_rms_g,fast_rms_g,candidate,accepted'];
    for (let i = 0; i < time.length; i++) {
      rows.push([
        ui.phenomenon.value, `"${profile.label.replace(/"/g, '""')}"`, time[i].toFixed(3),
        axes[0][i].toFixed(6), axes[1][i].toFixed(6), axes[2][i].toFixed(6),
        analysis.magnitude[i].toFixed(6), state.risk.values[i].toFixed(3), state.risk.averages[i].toFixed(3),
        analysis.lowRms[i].toFixed(6), analysis.fastRms[i].toFixed(6),
        analysis.candidate[i], analysis.accepted[i]
      ].join(','));
    }
    const blob = new Blob([`\uFEFF${rows.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `centinel-${ui.runId.textContent.toLowerCase()}.csv`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function scheduleRun() {
    window.clearTimeout(state.updateTimer);
    state.updateTimer = window.setTimeout(runSimulation, 120);
  }

  function resetControls() {
    stopPlayback();
    for (const key of Object.keys(defaults)) {
      if (key === 'scenario') ui.scenario.value = defaults[key];
      else ui[key].value = String(defaults[key]);
    }
    updateHazardProfile();
    syncControls();
    runSimulation();
  }

  function attachHover(canvas) {
    canvas.addEventListener('pointermove', (event) => {
      if (!state.data) return;
      const rect = canvas.getBoundingClientRect();
      const marginLeft = 51;
      const marginRight = 12;
      const plotWidth = rect.width - marginLeft - marginRight;
      const x = event.clientX - rect.left - marginLeft;
      state.hoverCursor = Math.max(0, Math.min(DURATION, x / plotWidth * DURATION));
      renderCharts();
    });
    canvas.addEventListener('pointerleave', () => {
      state.hoverCursor = null;
      renderCharts();
    });
  }

  function seekTo(time) {
    state.cursor = Math.max(0, Math.min(DURATION, time));
    state.hoverCursor = null;
    state.started = true;
    if (state.playing) {
      state.playFrom = state.cursor;
      state.playStartedAt = performance.now();
    }
    renderCharts();
  }

  for (const key of ['sampleRate', 'noise', 'vehicleAmp', 'quakeAmp', 'threshold', 'ratio', 'persistence']) {
    ui[key].addEventListener('input', () => { syncControls(); scheduleRun(); });
  }
  ui.scenario.addEventListener('change', () => { syncControls(); runSimulation(); });
  ui.phenomenon.addEventListener('change', () => { updateHazardProfile(); runSimulation(); });
  ui.signalView.addEventListener('change', renderCharts);
  ui.runBtn.addEventListener('click', () => { runSimulation(); togglePlayback(); });
  ui.resetBtn.addEventListener('click', resetControls);
  ui.playBtn.addEventListener('click', togglePlayback);
  ui.restartBtn.addEventListener('click', resetCursor);
  ui.exportBtn.addEventListener('click', exportCsv);
  el('progressTrack').addEventListener('pointerdown', (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    seekTo((event.clientX - rect.left) / rect.width * DURATION);
  });
  el('progressTrack').addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); seekTo(state.cursor - 1); }
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); seekTo(state.cursor + 1); }
    else if (event.key === 'Home') { event.preventDefault(); seekTo(0); }
    else if (event.key === 'End') { event.preventDefault(); seekTo(DURATION); }
  });
  for (const canvas of [ui.signalChart, ui.energyChart, ui.alarmChart]) attachHover(canvas);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(renderCharts);
    observer.observe(document.querySelector('.workspace'));
  } else {
    window.addEventListener('resize', renderCharts);
  }

  syncControls();
  updateHazardProfile();
  runSimulation();
})();

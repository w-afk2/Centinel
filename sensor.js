(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const DEFAULTS = { nodeName: 'Maqueta 1', thYellow: '2', thRed: '5', hold: '2', tgToken: '', tgChat: '' };
  const SETTINGS_KEY = 'centinela.';
  const history = [];

  const ui = {
    levelCard: $('levelCard'), levelName: $('levelName'), angle: $('angle'), hint: $('hint'),
    btnStart: $('btnStart'), btnCal: $('btnCal'), btnSilence: $('btnSilence'), btnTestTg: $('btnTestTg'), btnSave: $('btnSave'),
    telegramFeedback: $('telegramFeedback'),
    nodeName: $('nodeName'), thYellow: $('thYellow'), thRed: $('thRed'), hold: $('hold'), tgToken: $('tgToken'), tgChat: $('tgChat'), cfg: $('cfg'),
    sAcc: $('sAcc'), sGyro: $('sGyro'), sVec: $('sVec'), sHz: $('sHz'), sShock: $('sShock'), shockReading: $('shockReading'),
    sensorChart: $('sensorChart'), sensorHzBadge: $('sensorHzBadge'), log: $('log'), nodeLabel: $('nodeLabel'),
    sensorRunStateText: $('sensorRunStateText'), sensorRunState: $('sensorRunState'),
    surveyNodes: $('surveyNodes'), surveyFeed: $('surveyFeed'), surveyClock: $('surveyClock'),
    surveyTotal: $('surveyTotal'), surveyActive: $('surveyActive'), surveyIntermittent: $('surveyIntermittent'), surveyInactive: $('surveyInactive')
  };

  const store = {
    get(key, fallback) {
      try {
        const value = localStorage.getItem(SETTINGS_KEY + key);
        return value === null ? fallback : value;
      } catch (_) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(SETTINGS_KEY + key, value); return true; }
      catch (_) { return false; }
    }
  };

  for (const key of Object.keys(DEFAULTS)) ui[key].value = store.get(key, DEFAULTS[key]);

  let gravity = null;
  let baseline = null;
  let angle = 0;
  let level = 'detenido';
  let candidate = null;
  let candidateSince = 0;
  let shockUntil = 0;
  let silenced = false;
  let lastSent = { amarillo: 0, rojo: 0 };
  let samples = 0;
  let lastHzCheck = performance.now();
  let lastMotionAt = 0;
  let calibration = null;
  let audioContext = null;
  let alarmTimer = null;
  let wakeLock = null;
  let telegramBusy = false;
  let simulationStartedAt = 0;
  let lastSurveyAt = 0;
  let surveyRound = 0;
  const surveyNodes = [
    { id: 'NIC-MGA-014', zone: 'Managua · Centro', status: 'active', packets: 0, latency: 34 },
    { id: 'NIC-MGA-022', zone: 'Managua · Norte', status: 'active', packets: 0, latency: 41 },
    { id: 'NIC-MAS-008', zone: 'Masaya · Oeste', status: 'active', packets: 0, latency: 29 },
    { id: 'NIC-LEO-003', zone: 'León · Sur', status: 'intermittent', packets: 0, latency: 0 },
    { id: 'NIC-RIV-011', zone: 'Rivas · Centro', status: 'inactive', packets: 0, latency: 0 }
  ];

  function config() {
    const yellowValue = Number.parseFloat(ui.thYellow.value);
    const redValue = Number.parseFloat(ui.thRed.value);
    const holdValue = Number.parseFloat(ui.hold.value);
    return {
      node: ui.nodeName.value.trim() || 'Nodo',
      yellow: Number.isFinite(yellowValue) && yellowValue > 0 ? yellowValue : 2,
      red: Number.isFinite(redValue) && redValue > 0 ? redValue : 5,
      hold: Number.isFinite(holdValue) && holdValue >= 0 ? holdValue * 1000 : 2000,
      token: ui.tgToken.value.trim(),
      chat: ui.tgChat.value.trim()
    };
  }

  function log(message) {
    const item = document.createElement('li');
    const timestamp = document.createElement('time');
    timestamp.dateTime = new Date().toISOString();
    timestamp.textContent = new Date().toLocaleTimeString();
    item.append(timestamp, document.createTextNode(` · ${message}`));
    ui.log.prepend(item);
    while (ui.log.children.length > 50) ui.log.lastElementChild.remove();
  }

  function pushSurveyFeed(message, kind = 'ok') {
    if (!ui.surveyFeed) return;
    const item = document.createElement('li');
    item.className = `feed-${kind}`;
    const time = document.createElement('time');
    time.textContent = new Date().toLocaleTimeString();
    item.append(time, document.createTextNode(message));
    ui.surveyFeed.prepend(item);
    while (ui.surveyFeed.children.length > 5) ui.surveyFeed.lastElementChild.remove();
  }

  function renderSurveyNodes() {
    if (!ui.surveyNodes) return;
    const labels = { active: 'Activo', intermittent: 'Intermitente', inactive: 'Inactivo' };
    ui.surveyNodes.innerHTML = surveyNodes.map((node) => `
      <div class="survey-node survey-node-${node.status}">
        <span class="survey-node-dot" aria-hidden="true"></span>
        <span class="survey-node-copy"><strong>${node.id}</strong><small>${node.zone}</small></span>
        <span class="survey-node-status">${labels[node.status]}<small>${node.packets ? `${node.latency} ms · ${node.packets} paquetes` : 'sin respuesta'}</small></span>
      </div>`).join('');
  }

  function pollSurveyNetwork(now) {
    if (!ui.surveyFeed || now - lastSurveyAt < 1000) return;
    lastSurveyAt = now;
    surveyRound++;
    let responses = 0;
    for (const node of surveyNodes) {
      if (node.status === 'active' || (node.status === 'intermittent' && surveyRound % 3 !== 0)) {
        node.packets++;
        node.latency = 18 + Math.floor(Math.random() * 58);
        responses++;
      }
    }
    ui.surveyClock.textContent = `SONDEO ACTIVO · ${new Date().toLocaleTimeString()}`;
    ui.surveyTotal.textContent = String(surveyNodes.length);
    ui.surveyActive.textContent = String(surveyNodes.filter((node) => node.status === 'active').length);
    ui.surveyIntermittent.textContent = String(surveyNodes.filter((node) => node.status === 'intermittent').length);
    ui.surveyInactive.textContent = String(surveyNodes.filter((node) => node.status === 'inactive').length);
    renderSurveyNodes();
    const missed = surveyNodes.length - responses;
    pushSurveyFeed(`Ronda ${String(surveyRound).padStart(3, '0')} · ${responses} respuestas · ${missed} sin respuesta`, missed ? 'warn' : 'ok');
  }

  function simulateMotion(now) {
    if (level === 'detenido') return;
    const current = config();
    const phase = ((now - simulationStartedAt) / 1000) % 50;
    const lerp = (from, to, progress) => from + (to - from) * Math.max(0, Math.min(1, progress));
    let signal;
    if (phase < 8) signal = 0.3;
    else if (phase < 14) signal = lerp(0.3, current.yellow + 0.45, (phase - 8) / 6);
    else if (phase < 19) signal = current.yellow + 0.42;
    else if (phase < 24) signal = lerp(current.yellow + 0.45, current.red + 0.7, (phase - 19) / 5);
    else if (phase < 29) signal = current.red + 0.65;
    else if (phase < 37) signal = lerp(current.red + 0.6, 0.35, (phase - 29) / 8);
    else signal = 0.28;
    angle = Math.max(0, signal + Math.sin(now / 380) * 0.12 + Math.sin(now / 91) * 0.045);
    const radians = angle * Math.PI / 180;
    const x = Math.sin(radians) * 9.81;
    const y = Math.sin(now / 720) * 0.035;
    const z = Math.cos(radians) * 9.81;
    ui.sAcc.textContent = 'simulado';
    ui.sGyro.textContent = 'simulado';
    ui.sVec.textContent = `${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)} m/s²`;
    ui.sShock.textContent = 'no';
    ui.shockReading.classList.remove('is-alert');
    samples++;
  }

  function setTelegramFeedback(message, kind = '') {
    if (!ui.telegramFeedback) return;
    ui.telegramFeedback.textContent = message;
    ui.telegramFeedback.classList.toggle('is-success', kind === 'success');
    ui.telegramFeedback.classList.toggle('is-error', kind === 'error');
    ui.telegramFeedback.classList.toggle('is-pending', kind === 'pending');
  }

  function showBrowserNotification(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try { new Notification(title, { body, tag: 'centinela-telegram' }); }
    catch (_) { /* La notificación local es opcional; el envío a Telegram es independiente. */ }
  }

  async function requestNotificationPermission() {
    if (!('Notification' in window)) {
      log('Este navegador no admite notificaciones del sistema; se continuará con Telegram');
      return false;
    }
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') {
      log('Notificaciones del navegador bloqueadas; puedes revisar Telegram sin aviso local');
      return false;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        log('Permiso de notificaciones concedido');
        return true;
      }
      log('Permiso de notificaciones no concedido; Telegram seguirá disponible');
      return false;
    } catch (_) {
      log('El navegador no pudo solicitar notificaciones; Telegram seguirá disponible');
      return false;
    }
  }

  const norm = (vector) => Math.hypot(vector[0], vector[1], vector[2]);

  function angleBetween(a, b) {
    const denominator = norm(a) * norm(b);
    if (!denominator) return 0;
    const dot = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / denominator;
    return Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
  }

  function markShock(now) {
    if (now >= shockUntil) log('Golpe o movimiento brusco: se ignora durante 1.5 s');
    shockUntil = now + 1500;
  }

  function onMotion(event) {
    const reading = event.accelerationIncludingGravity;
    if (!reading || !Number.isFinite(reading.x) || !Number.isFinite(reading.y) || !Number.isFinite(reading.z)) return;

    const vector = [reading.x, reading.y, reading.z];
    const now = performance.now();
    lastMotionAt = now;
    samples++;
    ui.sAcc.textContent = 'disponible';

    const rotation = event.rotationRate;
    if (rotation && Number.isFinite(rotation.alpha)) {
      ui.sGyro.textContent = 'disponible';
      if (Math.hypot(rotation.alpha || 0, rotation.beta || 0, rotation.gamma || 0) > 150) markShock(now);
    }
    if (gravity && Math.abs(norm(vector) - norm(gravity)) > 4) markShock(now);

    // Suavizado pasa-bajo para estimar la gravedad y retirar vibraciones breves.
    gravity = gravity
      ? gravity.map((value, index) => value + 0.08 * (vector[index] - value))
      : vector.slice();

    if (calibration) {
      if (now - calibration.startedAt > 500) {
        calibration.sum = calibration.sum.map((value, index) => value + gravity[index]);
        calibration.count++;
      }
      if (now - calibration.startedAt >= 2500 && calibration.count > 0) {
        baseline = calibration.sum.map((value) => value / calibration.count);
        calibration = null;
        candidate = null;
        angle = 0;
        log('Calibrado en cero');
      }
      return;
    }

    if (!baseline) baseline = gravity.slice();
    angle = angleBetween(gravity, baseline);
    ui.sVec.textContent = gravity.map((value) => value.toFixed(2)).join(', ');
  }

  function updateRunState(label, active = false) {
    ui.sensorRunStateText.textContent = label;
    ui.sensorRunState.classList.toggle('is-playing', active);
  }

  function renderLevel(next) {
    ui.levelCard.classList.remove('level-detenido', 'level-verde', 'level-amarillo', 'level-rojo');
    ui.levelCard.classList.add(`level-${next}`);
    ui.levelName.textContent = next.toUpperCase();
    updateRunState(calibration ? 'CALIBRANDO' : next === 'detenido' ? 'PAUSADO' : 'SONDEANDO', next !== 'detenido');
  }

  function silenceButton() {
    ui.btnSilence.disabled = !alarmTimer || silenced;
    ui.btnSilence.textContent = silenced && alarmTimer ? 'Alerta reconocida' : 'Reconocer alerta';
  }

  function beep() {
    // Solo se simulan indicadores visuales; no se emite sonido ni vibración física.
    if (silenced) return;
  }

  function stopAlarm() {
    if (alarmTimer) clearInterval(alarmTimer);
    alarmTimer = null;
    silenceButton();
  }

  function startAlarm() {
    stopAlarm();
    beep();
    alarmTimer = window.setInterval(beep, 700);
    silenceButton();
  }

  function setLevel(next) {
    const previous = level;
    level = next;
    renderLevel(next);
    log(`Nivel ${next.toUpperCase()} (${angle.toFixed(2)}°)`);
    if (next === 'verde') silenced = false;
    if (next === 'rojo') startAlarm(); else stopAlarm();
    if ((next === 'amarillo' || next === 'rojo') && previous !== next) {
      const message = `Alerta simulada ${next.toUpperCase()} · inclinación ${angle.toFixed(2)}°`;
      pushSurveyFeed(message, 'warn');
      log(message);
    }
  }

  function evaluate() {
    const current = config();
    const now = performance.now();
    ui.angle.textContent = angle.toFixed(2);
    ui.sShock.textContent = now < shockUntil ? 'sí' : 'no';
    ui.shockReading.classList.toggle('is-alert', now < shockUntil);

    if (level === 'detenido') return;
    if (calibration) {
      ui.hint.textContent = 'Calibrando… mantén quieto el teléfono durante 3 segundos';
      updateRunState('CALIBRANDO', true);
      return;
    }
    if (now < shockUntil) {
      ui.hint.textContent = 'Golpe detectado: se ignora esta lectura';
      return;
    }

    // Histéresis: exige bajar 0.5° bajo el umbral antes de reducir el nivel.
    const margin = 0.5;
    const redThreshold = level === 'rojo' ? current.red - margin : current.red;
    const yellowThreshold = level === 'amarillo' || level === 'rojo' ? current.yellow - margin : current.yellow;
    const target = angle >= redThreshold ? 'rojo' : angle >= yellowThreshold ? 'amarillo' : 'verde';

    if (target === level) candidate = null;
    else if (target === 'verde' || current.hold === 0) setLevel(target);
    else {
      if (candidate !== target) { candidate = target; candidateSince = now; }
      if (now - candidateSince >= current.hold) setLevel(target);
    }
    updateRunState('SONDEANDO', true);

    const messages = {
      verde: 'Movimiento dentro de lo normal',
      amarillo: 'Atención: inclinación sobre el umbral',
      rojo: 'Alerta: la inclinación supera el nivel rojo'
    };
    ui.hint.textContent = candidate && candidate !== level ? `Confirmando ${candidate}…` : messages[level];
  }

  async function sendTelegram(message) {
    const current = config();
    if (!current.token || !current.chat) {
      log('Telegram no está configurado; completa el token y el chat ID');
      setTelegramFeedback('Completa el token del bot y el ID del chat en Configuración del nodo.', 'error');
      return false;
    }
    const body = new URLSearchParams({ chat_id: current.chat, text: message });
    const url = `https://api.telegram.org/bot${current.token}/sendMessage`;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = controller ? window.setTimeout(() => controller.abort(), 12000) : null;
    try {
      const response = await fetch(url, { method: 'POST', body, ...(controller ? { signal: controller.signal } : {}) });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.ok) {
        log('Telegram confirmó la entrega del mensaje');
        setTelegramFeedback('Telegram confirmó el envío. Revisa el chat configurado.', 'success');
        showBrowserNotification('Centinela · Telegram confirmado', 'El mensaje de prueba llegó al chat configurado.');
        return true;
      }
      const reason = result.description || `Error HTTP ${response.status}`;
      log(`Telegram rechazó el mensaje: ${reason}`);
      setTelegramFeedback(`Telegram rechazó el envío: ${reason}`, 'error');
      return false;
    } catch (error) {
      // No se reenvía a ciegas: el primer POST pudo llegar aunque el navegador no lea su respuesta.
      const isTimeout = error?.name === 'AbortError';
      const message = isTimeout
        ? 'Telegram tardó demasiado en responder. Revisa el chat antes de volver a probar.'
        : 'No se pudo confirmar la respuesta de Telegram. Revisa el chat antes de volver a probar para evitar duplicados.';
      log(message);
      setTelegramFeedback(message, 'error');
      return null;
    } finally {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    }
  }

  async function testTelegram() {
    const current = config();
    if (!current.token || !current.chat) {
      if (ui.cfg) ui.cfg.open = true;
      setTelegramFeedback('Completa primero el token del bot y el ID del chat.', 'error');
      log('Prueba cancelada: completa el token del bot y el ID del chat');
      (current.token ? ui.tgChat : ui.tgToken).focus();
      return;
    }
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(current.token)) {
      if (ui.cfg) ui.cfg.open = true;
      setTelegramFeedback('El token no parece válido. Copia el valor completo que te dio BotFather.', 'error');
      log('Prueba cancelada: el formato del token no parece válido');
      ui.tgToken.focus();
      return;
    }
    if (telegramBusy) return;
    if (!window.confirm(`Se enviará un mensaje de prueba por Telegram al chat “${current.chat}”. ¿Continuar?`)) {
      setTelegramFeedback('Prueba cancelada. No se envió ningún mensaje.', '');
      return;
    }

    telegramBusy = true;
    ui.btnTestTg.disabled = true;
    ui.btnTestTg.textContent = 'Enviando prueba…';
    try {
      setTelegramFeedback('Solicitando permiso para avisos del navegador…', 'pending');
      const notificationsAllowed = await requestNotificationPermission();
      if (!notificationsAllowed) {
        setTelegramFeedback('Sin avisos del navegador; continúa la prueba de Telegram.', 'pending');
      }
      const result = await sendTelegram(`✅ Centinela · ${current.node}\nPrueba manual de conexión desde el nodo de demostración.`);
      if (result === true && !notificationsAllowed) {
        setTelegramFeedback('Telegram confirmó el envío. El navegador no habilitó avisos locales.', 'success');
      }
    } finally {
      telegramBusy = false;
      ui.btnTestTg.disabled = false;
      ui.btnTestTg.textContent = 'Probar Telegram';
    }
  }

  function sendAlert(currentLevel) {
    const now = Date.now();
    if (now - lastSent[currentLevel] < 30000) return;
    lastSent[currentLevel] = now;
    const current = config();
    const icon = currentLevel === 'rojo' ? '🔴' : '🟡';
    const threshold = currentLevel === 'rojo' ? current.red : current.yellow;
    const message = `${icon} Centinel · ${current.node}\nNivel ${currentLevel.toUpperCase()}: inclinación de ${angle.toFixed(2)}° (umbral ${threshold}°)\n${new Date().toLocaleString()}`;
    sendTelegram(message);
  }

  async function requestWakeLock() {
    if (!navigator.wakeLock || level === 'detenido' || document.visibilityState !== 'visible') return;
    try {
      const currentLock = await navigator.wakeLock.request('screen');
      if (level === 'detenido') { await currentLock.release(); return; }
      wakeLock = currentLock;
      currentLock.addEventListener('release', () => { if (wakeLock === currentLock) wakeLock = null; }, { once: true });
    } catch (_) {
      // El bloqueo de pantalla es opcional y puede denegarse por el navegador o el sistema.
    }
  }

  function startSensor() {
    if (level !== 'detenido') { stopSensor(); return; }
    simulationStartedAt = performance.now();
    level = 'detenido';
    setLevel('verde');
    ui.btnStart.textContent = 'Pausar sondeo';
    ui.btnCal.disabled = false;
    ui.hint.textContent = 'Sondeando 5 nodos de demostración · ciclo de movimiento de 50 segundos.';
    ui.sAcc.textContent = 'simulado';
    ui.sGyro.textContent = 'simulado';
    log('Sondeo simulado iniciado: 5 celulares de demostración');
    pushSurveyFeed('Red de demostración conectada · iniciando rondas', 'ok');
  }

  function stopSensor() {
    stopAlarm();
    const wasRunning = level !== 'detenido';
    level = 'detenido';
    candidate = null;
    calibration = null;
    renderLevel('detenido');
    ui.hint.textContent = 'Sondeo pausado. Pulsa «Reanudar sondeo» para continuar.';
    ui.btnStart.textContent = 'Reanudar sondeo';
    ui.btnCal.disabled = true;
    if (wasRunning) log('Sondeo simulado pausado');
  }

  function beginCalibration() {
    if (level === 'detenido') return;
    simulationStartedAt = performance.now();
    candidate = null;
    angle = 0;
    if (level !== 'verde') setLevel('verde');
    ui.hint.textContent = 'Ciclo reiniciado · la señal volverá a subir automáticamente.';
    log('Ciclo de inclinación reiniciado');
  }

  function saveSettings() {
    const current = config();
    const yellow = Number.parseFloat(ui.thYellow.value);
    const red = Number.parseFloat(ui.thRed.value);
    const hold = Number.parseFloat(ui.hold.value);
    if (!Number.isFinite(yellow) || yellow < 0.1 || yellow > 45 ||
        !Number.isFinite(red) || red <= yellow || red > 90 ||
        !Number.isFinite(hold) || hold < 0 || hold > 60) {
      ui.hint.textContent = 'Revisa los umbrales: amarillo 0.1–45°, rojo mayor que amarillo y sostenido 0–60 s.';
      log('Configuración no guardada: revisa límites de umbrales y tiempo sostenido');
      return;
    }
    const fields = ['nodeName', 'thYellow', 'thRed', 'hold', 'tgToken', 'tgChat'];
    const saved = fields.every((key) => store.set(key, ui[key].value));
    ui.nodeLabel.textContent = current.node;
    if (!saved) {
      log('No se pudo guardar la configuración en este navegador');
      return;
    }
    log('Configuración guardada en este navegador');
  }

  function updateReadingsPerSecond(now) {
    if (now - lastHzCheck < 1000) return;
    const elapsed = now - lastHzCheck;
    ui.sHz.textContent = samples ? String(Math.round(samples * 1000 / elapsed)) : '—';
    if (samples) {
      ui.sAcc.textContent = 'simulado';
      ui.sGyro.textContent = 'simulado';
      ui.sensorHzBadge.textContent = `${Math.round(samples * 1000 / elapsed)} HZ · SIM`;
    }
    samples = 0;
    lastHzCheck = now;
  }

  function drawChart() {
    const canvas = ui.sensorChart;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const context = canvas.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const current = config();
    const now = performance.now();
    while (history.length && now - history[0][0] > 60000) history.shift();
    const maxAngle = Math.max(current.red * 1.45, angle * 1.2, 2.5);
    const margin = { left: 48, right: 12, top: 14, bottom: 28 };
    const plotWidth = Math.max(10, width - margin.left - margin.right);
    const plotHeight = Math.max(10, height - margin.top - margin.bottom);
    const xAt = (sampleTime) => margin.left + (1 - (now - sampleTime) / 60000) * plotWidth;
    const yAt = (value) => margin.top + plotHeight * (1 - Math.max(0, Math.min(maxAngle, value)) / maxAngle);

    context.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.lineWidth = 1;
    context.textBaseline = 'middle';
    context.textAlign = 'right';
    for (let i = 0; i <= 3; i++) {
      const value = maxAngle * i / 3;
      const y = yAt(value);
      context.strokeStyle = 'rgba(117, 135, 138, .16)';
      context.beginPath(); context.moveTo(margin.left, y); context.lineTo(width - margin.right, y); context.stroke();
      context.fillStyle = '#78878a';
      context.fillText(`${value.toFixed(1)}°`, margin.left - 7, y);
    }
    for (let seconds = 0; seconds <= 60; seconds += 15) {
      const x = margin.left + (seconds / 60) * plotWidth;
      context.strokeStyle = 'rgba(117, 135, 138, .12)';
      context.beginPath(); context.moveTo(x, margin.top); context.lineTo(x, margin.top + plotHeight); context.stroke();
      context.fillStyle = '#78878a';
      context.textAlign = seconds === 0 ? 'left' : seconds === 60 ? 'right' : 'center';
      context.textBaseline = 'top';
      context.fillText(`-${60 - seconds}s`, x, margin.top + plotHeight + 8);
    }

    const thresholds = [
      [current.yellow, '#eab672'],
      [current.red, '#ee816d']
    ];
    for (const [value, color] of thresholds) {
      if (value > maxAngle) continue;
      const y = yAt(value);
      context.strokeStyle = color;
      context.setLineDash([4, 4]);
      context.beginPath(); context.moveTo(margin.left, y); context.lineTo(width - margin.right, y); context.stroke();
      context.setLineDash([]);
    }

    context.save();
    context.beginPath(); context.rect(margin.left, margin.top, plotWidth, plotHeight); context.clip();
    context.strokeStyle = '#7cb7e8';
    context.lineWidth = 1.6;
    context.beginPath();
    let started = false;
    for (const [sampleTime, sampleAngle] of history) {
      if (now - sampleTime > 60000) continue;
      const x = xAt(sampleTime);
      const y = yAt(sampleAngle);
      if (!started) { context.moveTo(x, y); started = true; }
      else context.lineTo(x, y);
    }
    context.stroke();
    context.restore();
  }

  ui.btnStart.addEventListener('click', startSensor);
  ui.btnCal.addEventListener('click', beginCalibration);
  ui.btnSilence.addEventListener('click', () => {
    if (!alarmTimer || silenced) return;
    silenced = true;
    log('Aviso visual reconocido hasta que el nivel vuelva a verde');
    silenceButton();
  });
  ui.btnTestTg.addEventListener('click', testTelegram);
  ui.btnSave.addEventListener('click', saveSettings);

  if ('ResizeObserver' in window) new ResizeObserver(drawChart).observe(ui.sensorChart.parentElement);
  else window.addEventListener('resize', drawChart);

  ui.nodeLabel.textContent = config().node;
  renderSurveyNodes();
  startSensor();
  const timer = window.setInterval(() => {
    const now = performance.now();
    if (level !== 'detenido') {
      simulateMotion(now);
      pollSurveyNetwork(now);
      history.push([now, angle]);
    }
    evaluate();
    updateReadingsPerSecond(now);
    drawChart();
  }, 100);

  window.addEventListener('pagehide', () => {
    window.clearInterval(timer);
    stopAlarm();
  }, { once: true });

  drawChart();
})();

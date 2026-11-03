%% Simulacion del sensor de movimiento de Centinel
% Genera aceleracion triaxial sintetica, separa vibracion lenta y rapida,
% y marca eventos persistentes dominados por movimiento de baja frecuencia.
% Ejecutar este archivo completo en MATLAB. Solo usa funciones base de MATLAB.

clear; close all; clc;
rng(7);                         % Resultados repetibles

%% 1. Senal sintetica (aceleracion dinamica; gravedad ya removida)
Fs = 100;                       % Frecuencia de muestreo [Hz]
duracion = 60;                  % [s]
t = (0:1/Fs:duracion)';
N = numel(t);

% Ruido de fondo del acelerometro en los ejes X, Y, Z [g]
acc = 0.004 * randn(N, 3);

% Paso de un vehiculo pesado: vibracion corta y principalmente rapida.
vehiculo = (t >= 10) & (t < 18);
tv = t(vehiculo) - 10;
envolventeVehiculo = sin(pi * tv / 8).^2;
acc(vehiculo, 1) = acc(vehiculo, 1) + 0.045 .* envolventeVehiculo .* sin(2*pi*8*tv);
acc(vehiculo, 2) = acc(vehiculo, 2) + 0.030 .* envolventeVehiculo .* sin(2*pi*10*tv + 0.5);
acc(vehiculo, 3) = acc(vehiculo, 3) + 0.020 .* envolventeVehiculo .* sin(2*pi*7*tv + 1.1);

% Evento sismico: una llegada P pequena seguida por una fase S mas intensa.
llegadaP = (t >= 31) & (t < 33);
tp = t(llegadaP) - 31;
envolventeP = sin(pi * tp / 2).^2;
acc(llegadaP, 1) = acc(llegadaP, 1) + 0.022 .* envolventeP .* sin(2*pi*3.2*tp);
acc(llegadaP, 2) = acc(llegadaP, 2) + 0.015 .* envolventeP .* sin(2*pi*2.8*tp + 0.4);

faseS = (t >= 33) & (t < 46);
ts = t(faseS) - 33;
envolventeS = (0.085 .* exp(-ts/7) + 0.025) .* sin(pi * ts / 13).^0.35;
acc(faseS, 1) = acc(faseS, 1) + envolventeS .* (sin(2*pi*2.0*ts) + 0.35*sin(2*pi*3.6*ts));
acc(faseS, 2) = acc(faseS, 2) + 0.70 .* envolventeS .* sin(2*pi*1.7*ts + 0.4);
acc(faseS, 3) = acc(faseS, 3) + 0.35 .* envolventeS .* sin(2*pi*2.6*ts + 0.8);

%% 2. Filtros sencillos con promedios moviles causales
% La diferencia entre promedios de 0.18 s y 2 s conserva sobre todo la
% banda lenta. La diferencia entre la senal y el promedio corto conserva
% sobre todo la banda rapida. Son aproximaciones didacticas, no filtros de
% produccion ni sustitutos de una calibracion del acelerometro real.
ventanaCorta = max(3, round(0.18 * Fs));
ventanaLarga = round(2.0 * Fs);
ventanaRMS = round(1.0 * Fs);

promedioCorto = movmean(acc, [ventanaCorta-1 0], 1);
promedioLargo = movmean(acc, [ventanaLarga-1 0], 1);
bandaLenta = promedioCorto - promedioLargo;
bandaRapida = acc - promedioCorto;

rmsLenta = sqrt(movmean(sum(bandaLenta.^2, 2), [ventanaRMS-1 0], 1));
rmsRapida = sqrt(movmean(sum(bandaRapida.^2, 2), [ventanaRMS-1 0], 1));
rmsTotal = sqrt(movmean(sum(acc.^2, 2), [ventanaRMS-1 0], 1));

%% 3. Regla de deteccion para esta demostracion
umbralLento = 0.012;            % [g] RMS minimo en la banda lenta
relacionLentaRapida = 1.25;     % la banda lenta debe dominar a la rapida
umbralTotal = 0.018;            % [g] RMS minimo total
duracionMinima = 2.0;           % [s] persistencia minima para aceptar evento
brechaMaxima = round(0.40 * Fs);% unir cortes breves de la deteccion

candidato = (rmsLenta > umbralLento) & ...
            (rmsLenta > relacionLentaRapida .* rmsRapida) & ...
            (rmsTotal > umbralTotal);

% Rellenar huecos pequenos para no partir un evento por una caida breve.
d = diff([false; candidato; false]);
inicios = find(d == 1);
finales = find(d == -1) - 1;
for k = 1:numel(inicios)-1
    hueco = inicios(k+1) - finales(k) - 1;
    if hueco > 0 && hueco <= brechaMaxima
        candidato(finales(k)+1:inicios(k+1)-1) = true;
    end
end

% Aceptar solo intervalos que superen la persistencia minima.
d = diff([false; candidato; false]);
inicios = find(d == 1);
finales = find(d == -1) - 1;
detectado = false(N, 1);
eventos = zeros(0, 2);
for k = 1:numel(inicios)
    if (finales(k) - inicios(k) + 1) / Fs >= duracionMinima
        detectado(inicios(k):finales(k)) = true;
        eventos(end+1, :) = [t(inicios(k)), t(finales(k))]; %#ok<SAGROW>
    end
end

%% 4. Mostrar intervalos detectados y graficas
fprintf('Eventos aceptados por el detector: %d\n', size(eventos, 1));
for k = 1:size(eventos, 1)
    fprintf('  Evento %d: %.2f s a %.2f s\n', k, eventos(k,1), eventos(k,2));
end

figure('Name', 'Simulacion del sensor Centinel', 'Color', 'w');

subplot(3,1,1);
plot(t, acc(:,1), 'Color', [0.10 0.40 0.80]); hold on;
plot(t, acc(:,2), 'Color', [0.15 0.65 0.35]);
plot(t, acc(:,3), 'Color', [0.85 0.40 0.15]);
xline(10, ':k', 'Vehiculo'); xline(18, ':k');
xline(31, '--m', 'Inicio sismo'); xline(46, '--m');
grid on; xlim([0 duracion]);
ylabel('Aceleracion [g]');
title('Aceleracion sintetica en tres ejes');
legend('Eje X', 'Eje Y', 'Eje Z', 'Location', 'northeast');

subplot(3,1,2);
plot(t, rmsLenta, 'b', 'LineWidth', 1.1); hold on;
plot(t, rmsRapida, 'Color', [0.85 0.40 0.15], 'LineWidth', 1.0);
yline(umbralLento, '--b', 'Umbral banda lenta');
grid on; xlim([0 duracion]);
ylabel('RMS [g]');
title('Energia por banda: lenta frente a rapida');
legend('Banda lenta', 'Banda rapida', 'Location', 'northeast');

subplot(3,1,3);
stairs(t, double(candidato), 'Color', [0.65 0.65 0.65]); hold on;
stairs(t, double(detectado), 'r', 'LineWidth', 1.5);
ylim([-0.1 1.2]); yticks([0 1]); yticklabels({'No', 'Si'});
grid on; xlim([0 duracion]);
xlabel('Tiempo [s]'); ylabel('Alarma');
title('Candidato (gris) y evento aceptado por persistencia (rojo)');
legend('Candidato', 'Aceptado', 'Location', 'northeast');


USE CentinelDB;
GO
-- CENTINEL / DEMOSTRACION - SOLO CONSULTAS DE LECTURA.
-- No afecta ninguna otra base de datos ni altera datos.

-- 1. Comprobar que existen las 5 tablas.
SELECT t.name AS Tabla
FROM sys.tables t
WHERE t.schema_id = SCHEMA_ID('dbo')
  AND t.name IN ('Zonas', 'TiposSensor', 'Sensores', 'Lecturas', 'Alertas')
ORDER BY t.name;

-- 2. Comprobar procedimiento, trigger y vista.
SELECT 'PROCEDIMIENTO' AS Tipo, name AS Objeto FROM sys.procedures WHERE name = 'sp_RegistrarLectura'
UNION ALL SELECT 'TRIGGER', name FROM sys.triggers WHERE name = 'trg_EvaluarAlerta' AND is_disabled = 0
UNION ALL SELECT 'VISTA', name FROM sys.views WHERE name = 'vw_DashboardCentinel';

-- 3. Comprobar llaves foráneas del modelo.
SELECT fk.name AS RestriccionFK,
       OBJECT_NAME(fk.parent_object_id) AS TablaHija,
       OBJECT_NAME(fk.referenced_object_id) AS TablaPadre
FROM sys.foreign_keys fk
WHERE fk.parent_object_id IN (
  OBJECT_ID('dbo.Sensores'), OBJECT_ID('dbo.Lecturas'), OBJECT_ID('dbo.Alertas'))
ORDER BY TablaHija, TablaPadre;

-- 4. Resumen con las cantidades actuales.
SELECT (SELECT COUNT(*) FROM dbo.Zonas) AS Zonas,
       (SELECT COUNT(*) FROM dbo.TiposSensor) AS TiposSensor,
       (SELECT COUNT(*) FROM dbo.Sensores) AS Sensores,
       (SELECT COUNT(*) FROM dbo.Lecturas) AS Lecturas,
       (SELECT COUNT(*) FROM dbo.Alertas) AS Alertas;

-- 5. Dashboard alimentado desde la vista obligatoria.
SELECT Codigo, NombreSensor, NombreZona, TipoSensor, UmbralAlerta,
       UltimoValor, EstadoLectura
FROM dbo.vw_DashboardCentinel ORDER BY Codigo;

-- 6. Trazabilidad de las lecturas y alertas.
SELECT TOP (30) l.IdLectura, s.Codigo, l.Valor, t.UmbralAlerta,
       l.Origen, a.IdAlerta, a.Estado AS EstadoAlerta, a.FechaAtencion,
       CASE WHEN l.Valor > t.UmbralAlerta THEN 'SUPERA UMBRAL' ELSE 'NORMAL' END AS Evaluacion
FROM dbo.Lecturas l
INNER JOIN dbo.Sensores s ON s.IdSensor = l.IdSensor
INNER JOIN dbo.TiposSensor t ON t.IdTipoSensor = s.IdTipoSensor
LEFT JOIN dbo.Alertas a ON a.IdLectura = l.IdLectura
ORDER BY l.IdLectura DESC;
GO

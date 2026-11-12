USE CentinelDB;
GO
-- No crea, borra ni actualiza tablas: consultas de verificación de la BD existente.
SELECT DB_NAME() AS BaseDatos;
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME IN ('Zonas','TiposSensor','Sensores','Lecturas','Alertas');
SELECT name FROM sys.procedures WHERE name = 'sp_RegistrarLectura';
SELECT name, is_disabled FROM sys.triggers WHERE name = 'trg_EvaluarAlerta';
SELECT name FROM sys.views WHERE name = 'vw_DashboardCentinel';
SELECT * FROM dbo.vw_DashboardCentinel ORDER BY Codigo;
SELECT TOP (10) l.IdLectura, s.Codigo, l.Valor, l.Origen, a.IdAlerta, a.Estado
FROM dbo.Lecturas l
INNER JOIN dbo.Sensores s ON s.IdSensor = l.IdSensor
LEFT JOIN dbo.Alertas a ON a.IdLectura = l.IdLectura
ORDER BY l.IdLectura DESC;
GO

'use strict';
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sql, conectarDB, database } = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Desarrollo local: no publicar la API en la red de la empresa.
app.use(cors({ origin: [/^http:\/\/localhost(?::\d+)?$/, /^http:\/\/127\.0\.0\.1(?::\d+)?$/] }));
app.use(express.json({ limit: '32kb' }));

// Tabla y columnas bajo control del servidor: nunca interpolar nombres SQL recibidos del cliente.
const txt = (len, required = false) => ({ type: sql.NVarChar(len), kind: 'string', len, required });
const word = (len, values, required = false) => ({ type: sql.VarChar(len), kind: 'string', len, values, required });
const integer = (required = false) => ({ type: sql.Int, kind: 'int', required });
const decimal = (precision, scale, required = false) => ({ type: sql.Decimal(precision, scale), kind: 'number', required });
const bit = () => ({ type: sql.Bit, kind: 'bit' });
const date = () => ({ type: sql.Date, kind: 'date' });
const estadosSensor = ['ACTIVO', 'INACTIVO', 'MANTENIMIENTO'];
const estadosAlerta = ['PENDIENTE', 'ATENDIDA', 'DESCARTADA'];
const origenes = ['REAL', 'SIMULACION', 'MANUAL'];
const schemas = {
  zonas: {
    table: 'dbo.Zonas', pk: 'IdZona',
    fields: { Nombre: txt(100, true), Descripcion: txt(250), Latitud: decimal(9, 6, true), Longitud: decimal(9, 6, true), Activa: bit() }
  },
  'tipos-sensor': {
    table: 'dbo.TiposSensor', pk: 'IdTipoSensor',
    fields: { Nombre: txt(100, true), Descripcion: txt(250), UnidadMedida: txt(20, true), UmbralAlerta: decimal(10, 3, true), Activo: bit() }
  },
  sensores: {
    table: 'dbo.Sensores', pk: 'IdSensor',
    fields: { Codigo: txt(30, true), Nombre: txt(100, true), IdZona: integer(true), IdTipoSensor: integer(true), Estado: word(20, estadosSensor), FechaInstalacion: date() }
  },
  lecturas: {
    table: 'dbo.Lecturas', pk: 'IdLectura',
    fields: { IdSensor: integer(true), Valor: decimal(10, 3, true), Origen: word(15, origenes), Observacion: txt(250) },
    editable: ['Observacion']
  },
  alertas: {
    table: 'dbo.Alertas', pk: 'IdAlerta',
    fields: { IdLectura: integer(true), Mensaje: txt(250, true), Estado: word(15, estadosAlerta) },
    editable: ['Mensaje', 'Estado']
  }
};

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
function parseId(value) {
  const id = Number(value);
  if (!/^\d+$/.test(String(value)) || !Number.isInteger(id) || id < 1 || id > 2147483647)
    throw new ApiError(400, 'El ID debe ser un entero positivo.');
  return id;
}
function getSchema(name) {
  const schema = Object.prototype.hasOwnProperty.call(schemas, name) ? schemas[name] : null;
  if (!schema) throw new ApiError(404, 'Recurso no encontrado.');
  return schema;
}
function validate(body, schema, { update = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'Se requiere un objeto JSON.');
  const keys = Object.keys(body);
  if (!keys.length) throw new ApiError(400, 'Debes proporcionar al menos un campo.');
  const permitted = update ? (schema.editable || Object.keys(schema.fields)) : Object.keys(schema.fields);
  for (const key of keys) {
    if (!permitted.includes(key)) throw new ApiError(400, `Campo no permitido: ${key}.`);
    const f = schema.fields[key], value = body[key];
    if (value == null) {
      if (f.required) throw new ApiError(400, `${key} es obligatorio.`);
      continue;
    }
    if (f.kind === 'string' && (typeof value !== 'string' || !value.trim() || value.length > f.len || (f.values && !f.values.includes(value))))
      throw new ApiError(400, `Valor inválido para ${key}.`);
    if (f.kind === 'int' && (!Number.isInteger(value) || value < 1 || value > 2147483647))
      throw new ApiError(400, `${key} debe ser un entero positivo.`);
    if (f.kind === 'number' && (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 9999999))
      throw new ApiError(400, `${key} debe ser numérico y válido.`);
    if (f.kind === 'bit' && typeof value !== 'boolean' && value !== 0 && value !== 1)
      throw new ApiError(400, `${key} debe ser true/false o 0/1.`);
    if (f.kind === 'date' && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value))))
      throw new ApiError(400, `${key} debe utilizar YYYY-MM-DD.`);
  }
  if (!update) {
    for (const [key, field] of Object.entries(schema.fields)) {
      if (field.required && !Object.prototype.hasOwnProperty.call(body, key))
        throw new ApiError(400, `Falta campo obligatorio: ${key}.`);
    }
  }
  return keys;
}
function addInputs(request, body, schema, keys) {
  for (const [index, key] of keys.entries()) {
    const f = schema.fields[key];
    request.input(`v${index}`, f.type, f.kind === 'date' && body[key] ? new Date(`${body[key]}T12:00:00Z`) : body[key]);
  }
  return request;
}
function limitFrom(query) {
  const limit = query.limit == null ? 100 : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new ApiError(400, 'limit debe estar entre 1 y 500.');
  return limit;
}
function usePool(req) { return req.app.locals.pool; }

// HEALTH: una respuesta correcta implica conexión real a CentinelDB.
app.get('/api/health', wrap(async (req, res) => {
  const result = await usePool(req).request().query('SELECT DB_NAME() AS BaseDatos, 1 AS ConexionSQL');
  res.json({ success: true, api: 'Centinel', status: 'online', ...result.recordset[0] });
}));
app.get('/api', (_req, res) => res.json({ api: 'Centinel', message: 'API REST conectada con SQL Server' }));

// OBLIGATORIO: el dashboard obtiene datos de la vista relacional.
app.get('/api/dashboard', wrap(async (req, res) => {
  const r = await usePool(req).request().query('SELECT * FROM dbo.vw_DashboardCentinel ORDER BY Codigo');
  res.json(r.recordset);
}));
app.get('/api/alertas/detalle', wrap(async (req, res) => {
  const limit = limitFrom(req.query);
  const r = await usePool(req).request().input('limit', sql.Int, limit).query(`
    SELECT TOP (@limit) a.IdAlerta, a.Mensaje, a.Estado, a.FechaAlerta, a.FechaAtencion,
           l.IdLectura, l.Valor, l.Origen, s.Codigo, s.Nombre AS NombreSensor,
           z.Nombre AS Zona, t.UnidadMedida
    FROM dbo.Alertas a
    INNER JOIN dbo.Lecturas l ON a.IdLectura = l.IdLectura
    INNER JOIN dbo.Sensores s ON l.IdSensor = s.IdSensor
    INNER JOIN dbo.Zonas z ON s.IdZona = z.IdZona
    INNER JOIN dbo.TiposSensor t ON s.IdTipoSensor = t.IdTipoSensor
    ORDER BY a.IdAlerta DESC;
  `);
  res.json(r.recordset);
}));

// CRUD de los cinco recursos: GET lista, GET individual, POST, PUT y DELETE.
app.get('/api/:resource', wrap(async (req, res) => {
  const schema = getSchema(req.params.resource);
  const limit = limitFrom(req.query);
  const request = usePool(req).request().input('limite', sql.Int, limit);
  let where = '';
  if (req.params.resource === 'lecturas' && req.query.idSensor !== undefined) {
    request.input('sensor', sql.Int, parseId(req.query.idSensor));
    where = ' WHERE IdSensor = @sensor';
  }
  const r = await request.query(`SELECT TOP (@limite) * FROM ${schema.table}${where} ORDER BY ${schema.pk} DESC`);
  res.json(r.recordset);
}));
app.get('/api/:resource/:id', wrap(async (req, res) => {
  const schema = getSchema(req.params.resource), id = parseId(req.params.id);
  const r = await usePool(req).request().input('id', sql.Int, id)
    .query(`SELECT * FROM ${schema.table} WHERE ${schema.pk} = @id`);
  if (!r.recordset.length) throw new ApiError(404, 'Registro no encontrado.');
  res.json(r.recordset[0]);
}));
app.post('/api/:resource', wrap(async (req, res) => {
  const schema = getSchema(req.params.resource);
  const keys = validate(req.body, schema);
  const db = usePool(req);
  if (req.params.resource === 'lecturas') {
    // SOLO el procedimiento registra lecturas; el trigger genera alertas.
    const r = await db.request()
      .input('IdSensor', sql.Int, req.body.IdSensor)
      .input('Valor', sql.Decimal(10, 3), req.body.Valor)
      .input('Origen', sql.VarChar(15), req.body.Origen ?? 'SIMULACION')
      .input('Observacion', sql.NVarChar(250), req.body.Observacion ?? null)
      .execute('dbo.sp_RegistrarLectura');
    const lectura = r.recordset[0];
    const alert = await db.request().input('id', sql.Int, lectura.IdLectura)
      .query('SELECT IdAlerta FROM dbo.Alertas WHERE IdLectura = @id');
    return res.status(201).json({ ...lectura, IdAlerta: alert.recordset[0]?.IdAlerta ?? null });
  }
  const request = addInputs(db.request(), req.body, schema, keys);
  const columns = keys.map(k => `[${k}]`).join(', ');
  const values = keys.map((_, i) => `@v${i}`).join(', ');
  const r = await request.query(`INSERT INTO ${schema.table} (${columns}) OUTPUT INSERTED.${schema.pk} AS id VALUES (${values});`);
  const id = r.recordset[0].id;
  const created = await db.request().input('id', sql.Int, id)
    .query(`SELECT * FROM ${schema.table} WHERE ${schema.pk} = @id`);
  res.status(201).json(created.recordset[0]);
}));
app.put('/api/:resource/:id', wrap(async (req, res) => {
  const schema = getSchema(req.params.resource), id = parseId(req.params.id);
  const keys = validate(req.body, schema, { update: true });
  const request = addInputs(usePool(req).request().input('id', sql.Int, id), req.body, schema, keys);
  const assignments = keys.map((key, i) => `[${key}] = @v${i}`);
  if (req.params.resource === 'alertas' && keys.includes('Estado')) {
    // La fecha de atención se establece desde SQL Server, no desde el navegador.
    const stateParam = `@v${keys.indexOf('Estado')}`;
    assignments.push(`FechaAtencion = CASE WHEN ${stateParam} = 'ATENDIDA' THEN COALESCE(FechaAtencion, SYSDATETIME()) ELSE NULL END`);
  }
  const r = await request.query(`UPDATE ${schema.table} SET ${assignments.join(', ')} WHERE ${schema.pk} = @id; SELECT * FROM ${schema.table} WHERE ${schema.pk} = @id;`);
  if (!r.recordset.length) throw new ApiError(404, 'Registro no encontrado.');
  res.json(r.recordset[0]);
}));
app.delete('/api/:resource/:id', wrap(async (req, res) => {
  const schema = getSchema(req.params.resource), id = parseId(req.params.id);
  const db = usePool(req);
  if (req.params.resource === 'lecturas') {
    // Eliminar lectura y su alerta dentro de una única transacción de laboratorio.
    const transaction = new sql.Transaction(db);
    await transaction.begin();
    try {
      await new sql.Request(transaction).input('id', sql.Int, id)
        .query('DELETE FROM dbo.Alertas WHERE IdLectura = @id');
      const r = await new sql.Request(transaction).input('id', sql.Int, id)
        .query('DELETE FROM dbo.Lecturas WHERE IdLectura = @id');
      if (!r.rowsAffected[0]) throw new ApiError(404, 'Lectura no encontrada.');
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } else {
    const r = await db.request().input('id', sql.Int, id)
      .query(`DELETE FROM ${schema.table} WHERE ${schema.pk} = @id`);
    if (!r.rowsAffected[0]) throw new ApiError(404, 'Registro no encontrado.');
  }
  res.status(204).end();
}));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint inexistente.' }));

// Servir SOLO archivos de la interfaz. Evita exponer backend/.env o código del servidor.
const frontendRoot = path.resolve(__dirname, '..');
const publicFiles = ['index.html', 'simulador.html', 'sensor.html', 'app.js', 'dashboard.js', 'sensor.js', 'styles.css', 'dashboard.css'];
for (const filename of publicFiles) {
  app.get(`/${filename}`, (_req, res) => res.sendFile(path.join(frontendRoot, filename)));
}
app.get('/', (_req, res) => res.sendFile(path.join(frontendRoot, 'index.html')));

app.use((error, _req, res, _next) => {
  const code = error.number ?? error.originalError?.info?.number;
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON mal formado.' });
  if (error instanceof ApiError) return res.status(error.status).json({ error: error.message });
  if ([2601, 2627].includes(code)) return res.status(409).json({ error: 'Ya existe un registro con esa clave UNIQUE.' });
  if (code === 547) return res.status(409).json({ error: 'Operación rechazada por llave foránea o restricción CHECK.' });
  if ([50001, 50002, 50003].includes(code)) return res.status(400).json({ error: error.message });
  console.error('Error de API:', error);
  res.status(500).json({ error: 'Error interno. Revisa la terminal de Node.js.' });
});

async function start() {
  const pool = await conectarDB();
  // Seguridad adicional: rechazar conexiones que no apunten a CentinelDB.
  const check = await pool.request().query('SELECT DB_NAME() AS name');
  if (check.recordset[0].name !== 'CentinelDB' || database !== 'CentinelDB')
    throw new Error('Configuración incorrecta: Centinel solo debe usar CentinelDB.');
  app.locals.pool = pool;
  app.listen(PORT, '127.0.0.1', () => {
    console.log('CENTINEL API + SQL Server conectados.');
    console.log(`Navegador: http://localhost:${PORT}`);
    console.log(`Prueba: http://localhost:${PORT}/api/health`);
    console.log(`Dashboard: http://localhost:${PORT}/api/dashboard`);
  });
}

if (require.main === module) {
  start().catch((err) => { console.error('No se pudo iniciar Centinel:', err.message); process.exitCode = 1; });
}
module.exports = { app, start };

'use strict';
const { conectarDB, pool } = require('./db');

async function main() {
  try {
    const db = await conectarDB();
    const r = await db.request().query(`
      SELECT DB_NAME() AS BaseDatos,
             (SELECT COUNT(*) FROM dbo.Sensores) AS TotalSensores,
             (SELECT COUNT(*) FROM dbo.Lecturas) AS TotalLecturas,
             (SELECT COUNT(*) FROM dbo.Alertas) AS TotalAlertas;
    `);
    console.table(r.recordset);
    if (r.recordset[0]?.BaseDatos !== 'CentinelDB') {
      throw new Error('Se esperaba CentinelDB. No se ejecutará ninguna modificación.');
    }
    console.log('OK: SQL Server accesible y esquema Centinel consultable.');
  } catch (error) {
    console.error('ERROR DE CONEXIÓN:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.close().catch(() => {});
  }
}
main();

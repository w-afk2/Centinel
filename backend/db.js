'use strict';
require('dotenv').config();
const sql = require('mssql/msnodesqlv8');

// Conexión integrada de Windows. NO se guardan contraseñas ni se usan otras BD.
// Usa el driver ODBC 17 de 64 bits que ya está instalado en el equipo.
const server = process.env.DB_SERVER || 'lpc:DESKTOP-4FHKLO2\\MSSQLSERVER01';
const database = process.env.DB_DATABASE || 'CentinelDB';
const driver = process.env.DB_ODBC_DRIVER || 'ODBC Driver 17 for SQL Server';

// Para un laboratorio local. Evita desactivar la validación del certificado en producción.
const connectionString = [
  `Driver={${driver}}`,
  `Server=${server}`,
  `Database=${database}`,
  'Trusted_Connection=Yes',
  'Encrypt=No',
  'TrustServerCertificate=Yes'
].join(';') + ';';

const config = {
  connectionString,
  options: { trustedConnection: true },
  connectionTimeout: 15000,
  requestTimeout: 15000,
  pool: { max: 5, min: 0, idleTimeoutMillis: 30000 }
};

const pool = new sql.ConnectionPool(config);
pool.on('error', (error) => console.error('Error en pool SQL:', error.message));
let connectionPromise;

function conectarDB() {
  if (!connectionPromise) {
    connectionPromise = pool.connect().catch((err) => {
      connectionPromise = null;
      throw err;
    });
  }
  return connectionPromise;
}

module.exports = { sql, pool, conectarDB, database, server };

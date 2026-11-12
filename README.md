# Centinel — Entrega final de Base de Datos I

Versión que añade **gestión de alertas desde el dashboard**, fecha automática de atención y un **script de pruebas CRUD integral con limpieza automática**. Se adapta exactamente al esquema `CentinelDB` ya creado: Zonas, TiposSensor, Sensores, Lecturas y Alertas; `sp_RegistrarLectura`, `trg_EvaluarAlerta` y `vw_DashboardCentinel`.

## 1. Actualizar el proyecto SIN perder trabajo

1. Haz una copia de tu carpeta local del proyecto.
2. Descomprime **`Centinel_Actualizacion_Final.zip`** y copia su contenido a la **raíz del proyecto**, reemplazando únicamente los archivos repetidos. Esta actualización contiene los ocho archivos que cambiaron, sin tocar las dependencias ni el archivo `.env`. (Existe además un ZIP del proyecto completo por si necesitas una referencia.)
3. **NO reemplaces ni borres** `.git/`, `backend/node_modules/`, `backend/.env` ni tu `backend/package-lock.json` si ya te funciona. Conserva el `backend/package.json` y sus dependencias instaladas (Express, mssql, msnodesqlv8, cors, dotenv).
4. El puerto local usado es **3001**, según las pruebas recientes. Mantén `PORT=3001` en el `.env` que ya funciona. La conexión a SQL Server **no cambia**.
5. **NO ejecutes nuevamente** `CREATE DATABASE` ni los `CREATE TABLE`; todos los objetos obligatorios ya existen y funcionan.

## 2. Ejecutar la API

En la carpeta `backend`, en PowerShell:

```powershell
node server.js
```

Si ya hay un servidor antiguo en ese puerto, detén **solo ese proceso conocido** desde su terminal con `Ctrl + C`, y reinicia. Debes ver `CENTINEL API + SQL Server conectados.`

Comprueba:

- http://localhost:3001/api/health
- http://localhost:3001/api/dashboard
- http://localhost:3001/api/alertas/detalle
- http://localhost:3001/ (dashboard)

## 3. Pruebas CRUD automáticas en los cinco recursos

Con `node server.js` todavía abierto, abre **otra terminal PowerShell** en `backend` y ejecuta:

```powershell
.\pruebas-crud.ps1
```

Si PowerShell tiene restringida la ejecución de scripts, solicita autorización de TI y, si está permitido, ejecuta **solo este archivo** así (sin cambiar la política de Windows permanentemente):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\pruebas-crud.ps1
```

La prueba utiliza por defecto `http://127.0.0.1:3001`. Si cambiaste el puerto, usa `-Api 'http://127.0.0.1:PUERTO'`.

Prueba **GET/POST/PUT/DELETE** sobre Zonas, TiposSensor, Sensores, Lecturas y Alertas, además de la vista, el procedimiento y el trigger.

### Precaución

El script crea exclusivamente registros temporales con prefijo `PRUEBA-CRUD-` / `PR-` y elimina solo sus IDs al finalizar. **No toca** los sensores CEN-001..004 ni las tres lecturas/dos alertas que comprobaste en SSMS. Si la conexión se interrumpe durante la limpieza, puede quedar un registro temporal; revisa la salida del script y usa sus IDs antes de limpiar manualmente.

Si las pruebas pasan, verás líneas `OK: ...` seguidas de `Limpieza: ... eliminado`.

## 4. Atender alertas desde el dashboard

1. Abre http://localhost:3001/#red
2. Desplázate a **Red comunitaria → Alertas**.
3. Para una alerta `PENDIENTE`, pulsa **Atender** y confirma.
4. El frontend ejecutará `PUT /api/alertas/:id` enviando `{ "Estado": "ATENDIDA" }`.
5. El backend actualizará `Estado` y guardará `FechaAtencion = SYSDATETIME()` en SQL Server.
6. La alerta seguirá en el historial (no se borra), pero ahora aparecerá `ATENDIDA`.

Consulta SSMS:

```sql
USE CentinelDB;
SELECT IdAlerta, IdLectura, Estado, FechaAlerta, FechaAtencion
FROM dbo.Alertas ORDER BY IdAlerta DESC;
```

El cambio de estado no implica que el riesgo natural esté resuelto: significa solo que el operador reconoció la alerta del ensayo.

## 5. Auditoría SQL para la defensa

Abre y ejecuta `database/04_Auditoria_Final.sql` en SSMS. Solo hace consultas de lectura y demuestra:

- Cinco tablas y cuatro relaciones FK.
- Procedimiento, trigger y vista obligatorios.
- Registros, sensores y umbrales.
- Lecturas con y sin alerta y fecha de atención.

Las verificaciones previas de 95 → alerta y 80 → sin alerta ya están demostradas en tus datos. El simulador registró 98 → alerta también.

## 6. Publicar en GitHub

Cuando las pruebas hayan pasado, desde **la raíz del repositorio** ejecuta en PowerShell:

```powershell
.\publicar-github.ps1
```

El script comprueba que `origin` sea `https://github.com/w-afk2/Centinel.git`, prepara solo los archivos indicados, revisa que no se publiquen `.env` ni `node_modules`, muestra los archivos y pide **confirmación** antes de `commit` y `push`.

Alternativa manual en Git Bash:

```bash
git status
git add .
git diff --cached --name-only
git diff --cached --check
git commit -m "Finalizar CRUD, alertas y pruebas Centinel"
git push origin main
```

**Antes del commit revisa** que `.env` y dependencias no aparezcan entre los archivos preparados.

## 7. Endpoints incluidos

| Método | Ruta | Comportamiento |
|---|---|---|
| GET | `/api/dashboard` | Consulta `vw_DashboardCentinel` |
| GET | `/api/alertas/detalle` | Lecturas con alertas y `FechaAtencion` |
| GET | `/api/{zonas,tipos-sensor,sensores,lecturas,alertas}` | Lista registros |
| GET | `/api/:recurso/:id` | Consulta individual |
| POST | `/api/:recurso` | Crea registro; en lecturas ejecuta el procedimiento |
| PUT | `/api/:recurso/:id` | Actualiza registro; alerta ATENDIDA guarda fecha |
| DELETE | `/api/:recurso/:id` | Elimina registro (si las FK lo permiten) |

**Seguridad:** la API escucha solo en `127.0.0.1`, no tiene login ni autorización granular y es un **prototipo local de laboratorio**. No se debe exponer a internet ni a la red corporativa. Las mediciones de `SIMULACION` no son alertas oficiales.

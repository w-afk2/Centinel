# Centinel — Instrucciones rápidas

1. Copia **todos los archivos de esta actualización** en la **raíz** de tu proyecto `Prototipo Centinel`, reemplazando los repetidos. El ZIP de actualización **no incluye** `.env`, `package.json`, `package-lock.json` ni `node_modules`, por lo que no se pierden tus dependencias ni tus credenciales locales.
2. En PowerShell, dentro de `backend`, reinicia **el servidor Centinel que ya está ejecutándose** con `Ctrl + C` en su terminal y vuelve a ejecutar `node server.js`. Mantén `PORT=3001` en `backend/.env`.
3. Abre una nueva terminal PowerShell en `backend` y ejecuta `.\pruebas-crud.ps1`. Si una política corporativa lo bloquea, consulta la alternativa de ejecución puntual en README.md.
4. Abre `http://localhost:3001/#red`, busca la sección de Alertas, pulsa `Atender` en una alerta pendiente y confirma.
5. Ejecuta `database/04_Auditoria_Final.sql` en SSMS para obtener evidencia de las tablas y objetos SQL.
6. Desde la **raíz** del proyecto, abre PowerShell y ejecuta `.\publicar-github.ps1`. Revisa los archivos preparados y escribe `S` cuando solicite confirmación.

Los cambios no se han ejecutado todavía contra tu instancia de SQL Server ni se han publicado en tu GitHub: las pruebas y la publicación se realizan con esos comandos en tu equipo.

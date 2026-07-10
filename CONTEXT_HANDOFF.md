# Contexto de transición — Prode 2026

**Fecha:** 10 de julio de 2026
**Repo:** `github.com/leomotto/prode2026`
**Branch activo:** `main`

---

## Stack

- **Backend:** Node.js + Fastify + Prisma ORM
- **DB:** PostgreSQL (producción en alwaysdata)
- **Frontend:** HTML/JS vanilla (public/)
- **API externa:** `v3.football.api-sports.io` — plan free, 100 req/día, key: `71fc2bb3d6a8f0409f2eb5377a98ffc5`
- **Deploy:** alwaysdata, restart automático al push a main a través de GitHub Actions y `deploy.sh`.

### Archivos clave
| Archivo | Rol |
|---|---|
| `src/services/AdvancementService.js` | Definición oficial de cruces y avance dinámico en fase eliminatoria (bracket). |
| `src/services/SyncService.js` | Sincronización automática de resultados en vivo/finales con API-Football. |
| `src/routes/admin.js` | Rutas de administración. Recientemente se limpiaron endpoints temporales de fix. |
| `src/server.js` | Jobs en background: auto-LIVE (60s) + auto-sync (15min). |

---

## Modificaciones Recientes (10-jul-2026)

### 1. Fix en el Cálculo de Puntos y Propagación del Bracket
- **Causa original:** En la sesión del 8 de julio, una auditoría borró la función `calcularBonus` por considerarla código muerto. Sin embargo, `MatchService.js` la seguía importando y llamando al momento de asignar puntos. Cuando un partido finalizaba (como Francia 2-0 Marruecos), el servidor arrojaba un `TypeError`, abortando la sincronización: el partido se guardaba con su resultado, pero los puntos nunca se entregaban a los usuarios y los ganadores no avanzaban a la siguiente ronda.
- **Solución implementada:** 
  - Se eliminó completamente cualquier llamada e importación a `calcularBonus` en `MatchService.js` y `admin.js`.
  - Se ejecutó un script temporal `fix-points.js` durante un despliegue para recalcular retroactivamente todos los partidos finalizados y asegurar la propagación hacia las Semifinales llamando a `runFullAdvancement()`. El script fue luego eliminado.

---

## Historial Anterior (8-jul-2026)

### 1. Corrección del Bracket Eliminatorio (Cuartos de final)
- **Causa original:** Los IDs de los partidos de Cuartos de Final (QF-M1, QF-M2, QF-M3, QF-M4) tenían cruces incorrectos mapeados contra el bracket real de la FIFA y el orden de los equipos (local/visitante) estaba invertido.
- **Solución implementada:** 
  - Se modificó `AdvancementService.js` para mapear de manera estricta los ganadores de Octavos a Cuartos de acuerdo a los datos oficiales:
    - `QF-M1`: Francia (local) vs Marruecos (visitante)
    - `QF-M2`: España (local) vs Bélgica (visitante)
    - `QF-M3`: Noruega (local) vs Inglaterra (visitante)
    - `QF-M4`: Argentina (local) vs Suiza (visitante)
  - Se actualizó `prisma/seed.js` para emparejar estos mismos índices.

### 2. Pestaña "Tercer Puesto" y Estados Pendientes
- Se agregó oficialmente la fase `TERCER_PUESTO` (Tercer y Cuarto lugar) en las pestañas de `public/admin.html` y `public/matches.html` que antes faltaba.
- Se implementaron fallbacks visuales de "Por definir" (o la bandera 🏳️) cuando un partido de Semis, Tercer Puesto o Final aún no tiene equipos asignados. De esta forma, evitamos mostrar el texto "null" y la UI no se rompe.
- Se reparó el bug visual donde los nombres, iniciales y banderas del equipo "visitante" (Away) estaban desordenados verticalmente en flexbox. Se volvió a su stack original de arriba hacia abajo: Código (VIS) -> Bandera -> Nombre.

### 3. Auditoría y Limpieza (Ponytail Audit)
- Se ejecutó el skill `ponytail-audit`.
- **Código y Scripts Temporales:** Se eliminaron 19 scripts (como `test-*.js`, `fix-*.js`, `get_fifa*.js`) que estaban acumulados en el root.
- **Librerías Innecesarias:** Se desinstalaron `puppeteer`, `jsdom`, y `node-fetch`, que ocupaban peso extra en el despliegue del CI/CD de producción pero nunca eran llamados por la app real.
- **Funciones Muertas:** Se eliminó la función vacía `calcularBonus` en `scoring.js` y los endpoints/botones de fix (fechas R32, R16, QF) de la interfaz de administración, ya que las correcciones en DB son ahora permanentes.
- **Deploy:** Se borró la referencia residual a `fix-octavos.js` en `deploy.sh`.

---

## Cosas importantes

### Sync de Partidos
- Sigue utilizando la versión free de la API de Football (100 req/día).
- Los algoritmos de `SyncService.js` usan `word-set` para emparejar equipos en inglés/español ignorando puntuaciones.

### Botón de Sincronización Manual
- Tras las mejoras y limpieza del administrador de rutas (`admin.html`), el botón principal para la sincronización es "**Sincronizar ahora**". El resto del mantenimiento del bracket knockout se asume automatizado vía `runFullAdvancement()` en `AdvancementService.js`.

---

## Próximos pasos
1. **Fase Actual (Cuartos de Final y Semifinales):**
   - Asegurarse de monitorear que la propagación hacia semifinales funcione exitosamente cuando finalice un partido de cuartos.
2. **Handoff a Futuros Modelos:**
   - Para corregir resultados anómalos o reingresar fallos, recaer siempre sobre `SyncService.js` o edición manual directamente sobre la base de datos PostgreSQL, ya que los scripts rápidos de `fix` locales han sido saneados del repositorio de producción.

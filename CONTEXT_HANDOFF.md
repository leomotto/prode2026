# Contexto de transición — Prode 2026

**Fecha:** 30 de junio de 2026  
**Repo:** `github.com/leomotto/prode2026`  
**Branch activo:** `main`  
**Último commit:** `0e44a70` — fix-r32-data con orden local/visitante oficial FIFA + admin LIVE score + standings bracket usa DB

---

## Stack

- **Backend:** Node.js + Fastify + Prisma ORM
- **DB:** PostgreSQL (producción en alwaysdata)
- **Frontend:** HTML/JS vanilla (public/)
- **API externa:** `v3.football.api-sports.io` — plan free, 100 req/día, key: `71fc2bb3d6a8f0409f2eb5377a98ffc5`
- **Deploy:** alwaysdata, restart via `tmp/restart.txt`

### Archivos clave
| Archivo | Rol |
|---|---|
| `src/services/AdvancementService.js` | R32_BRACKET + lógica de clasificación |
| `src/services/SyncService.js` | Sync de resultados con API externa |
| `src/routes/admin.js` | Rutas admin, incluyendo fix-r32-data, fix-knockout-slots, fix-penalties |
| `src/server.js` | Jobs: auto-LIVE (60s) + auto-sync (15min) |
| `public/js/api.js` | Wrapper JS del frontend para llamadas a la API |

---

## Trabajo realizado hoy (30-jun-2026)

Se resolvieron varios bugs críticos relacionados a la segunda fase del torneo (eliminatorias):

1. **Bug en propagación (advanceGroupsToR32):** El job sobreescribía los equipos de partidos R32 que ya estaban `FINISHED`. Se corrigió para que ignore partidos terminados (`bf708d6`).
2. **Corrupción en Knockout Bracket:** Se creó el endpoint `/api/admin/fix-knockout-slots` para limpiar slots corruptos en Octavos en adelante y re-propagar los ganadores limpiamente (`ab00fc8` y `6dc8cee`).
3. **Soporte de Penales:** Se agregó manejo de penales a través de los endpoints `/fix-penalties` y `/clear-penalties` para resolver partidos empatados como Alemania-Paraguay y Países Bajos-Marruecos (`698c3ef` y `0517920`).
4. **Standings / Bracket Proyectado:** El endpoint `/api/standings/bracket` recalculaba los equipos desde los grupos (mostrando Australia en vez de Paraguay). Ahora usa los equipos reales de la DB si el partido ya terminó (`9c16b95`).
5. **Orden Oficial FIFA:** Se actualizó `fix-r32-data` para respetar exactamente el fixture oficial FIFA M73-M88. Particularmente, M13 se corrigió a **Sudáfrica (local) vs Canadá (visitante)** (`0e44a70`).
6. **UI de Partidos en Vivo:** Se mejoró `admin.html`, `matches.html` e `index.html` para que los partidos en estado `LIVE` muestren su marcador parcial (ej. `🔴 0-0`) apenas se sincronizan, en vez de ocultarlo (`9c16b95` y `0e44a70`).

---

## Estado actual del torneo (30-jun-2026 21:30 UTC)

**Fase activa:** DIECISEISAVOS (R32) — partidos desde Jun 28 a Jul 4  

### Partidos R32 jugados (5 FINISHED)
| Match | Partido (Orden FIFA) | Result | Penales | Ganador | R16 Slot |
|---|---|:---:|:---:|---|---|
| R32-M13 | Sudáfrica vs Canadá | **0-1** | - | **Canadá** | R16-M7 A |
| R32-M9 | Alemania vs Paraguay | **1-1** | **(3-4)** | **Paraguay** | R16-M5 A |
| R32-M16 | Países Bajos vs Marruecos | **1-1** | **(2-3)** | **Marruecos** | R16-M8 B |
| R32-M4 | Brasil vs Japón | **2-1** | - | **Brasil** | R16-M2 B |
| R32-M2 | Costa de Marfil vs Noruega | **1-2** | - | **Noruega** | R16-M1 B |

### Partidos R32 actuales (LIVE)
- **R32-M1:** Francia vs Suecia (en curso, marcador sincronizándose automáticamente cada 15 min).

---

## Tareas pendientes y próximos pasos

1. **Monitoreo Automático:**
   - La API actualizará resultados automáticamente cada 15 minutos (por limitación del tier gratuito de api-sports).
   - Si un usuario nota que el partido empezó pero no ve el resultado, es porque hay que esperar hasta el próximo ciclo de 15 min (o lanzar Sync manual desde Admin).

2. **Carga Manual (Julio 2, 3 y 4):**
   - El plan gratuito de API Sports solo cubre fechas específicas. Si la API deja de sincronizar los partidos del 2, 3 o 4 de julio, habrá que usar el panel admin para cargar resultados a mano.
   - Si un partido va a penales y se carga manual, usar el endpoint especial de `fix-penalties` que armamos hoy.

3. **Argentina:**
   - Juega el **Viernes 3 de julio a las 19:00 ARG (22:00 UTC)** en el Hard Rock Stadium, Miami (R32-M6 contra Cabo Verde). Todo está configurado correctamente en la base de datos.

---

## Reglas del proyecto

- **Siempre pushear** después de correcciones sustanciales
- **API externa:** solo llamar durante horario de partido, cada 15 min. Límite 100 req/día.
- **Zona horaria:** Argentina = UTC-3 (ART). Todas las fechas en DB están en UTC.
- **Columnas penaltyA/penaltyB** no existen en la DB local (solo en producción) — usar `$executeRawUnsafe` para evitar error de Prisma en queries locales.

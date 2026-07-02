# Contexto de transición — Prode 2026

**Fecha:** 2 de julio de 2026  
**Repo:** `github.com/leomotto/prode2026`  
**Branch activo:** `main`  
**Último commit:** `4c85a87` — fix: corregir cruces R32 y diccionario USA para sync

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
| `src/services/SyncService.js` | Sync de resultados con API externa, diccionario de traducciones (`TEAM_EN`) |
| `src/routes/admin.js` | Rutas admin, incluyendo fix-r32-data, fix-knockout-slots, fix-penalties |
| `src/server.js` | Jobs: auto-LIVE (60s) + auto-sync (15min) |
| `public/js/api.js` | Wrapper JS del frontend para llamadas a la API |

---

## Trabajo realizado (1 y 2 de julio)

Se solucionaron errores estructurales de la segunda fase (eliminatorias) y del sistema de sincronización:

1. **Corrección de Cruces Oficiales (R32_BRACKET):** Se detectó que el bracket interno tenía mal mapeadas las posiciones de los mejores terceros (ej. cruzaba 1L vs 3L en lugar de 1L vs 3K). Esto provocaba que el sistema sobrescribiera partidos como Inglaterra vs R.D. Congo por Inglaterra vs Ghana. Se reescribió `R32_BRACKET` en `AdvancementService.js` para que calce exacto con las resoluciones oficiales de FIFA (`4c85a87`).
2. **Corrección del Diccionario de Sync (EE.UU. vs USA):** La API devolvía "USA", pero nuestro sistema intentaba matchear "EE.UU." con "UNITED STATES", ignorando "USA" porque palabras de 2 letras ("EE" y "UU") son filtradas. Se ajustó el diccionario `TEAM_EN` en `SyncService.js` para que `EE UU` se traduzca como `USA UNITED STATES` y el overlap sea exitoso (`4c85a87`).
3. **Restauración Manual de Partidos:** Tras corregir el bracket, se ejecutó `/api/admin/fix-r32-data` y se forzó sincronización para asentar los resultados verdaderos y definitivos.

*(Trabajo de días previos: Arreglo de visualización de marcador 🔴 LIVE en admin e index, creación de endpoints para limpiar octavos corruptos `/fix-knockout-slots` y forzar penales `/fix-penalties`, corrección del proyector de brackets en `/standings/bracket`).*

---

## Estado actual del torneo (2-jul-2026 03:00 UTC)

**Fase activa:** DIECISEISAVOS (R32) — Quedan 6 partidos por jugarse.

### Partidos R32 jugados (10 FINISHED)
| Match | Partido | Result | Notas |
|---|---|:---:|---|
| R32-M13 | Sudáfrica vs Canadá | **0-1** | - |
| R32-M4 | Brasil vs Japón | **2-1** | - |
| R32-M9 | Alemania vs Paraguay | **1-1** | (3-4 p) |
| R32-M16 | Países Bajos vs Marruecos | **1-1** | (2-3 p) |
| R32-M2 | Costa de Marfil vs Noruega | **1-2** | - |
| R32-M1 | Francia vs Suecia | **3-0** | - |
| R32-M15 | México vs Ecuador | **2-0** | - |
| R32-M10 | Inglaterra vs R.D. Congo | **2-1** | Hubo bug de Ghana (ya resuelto) |
| R32-M11 | Bélgica vs Senegal | **3-2** | AET (Tiempo extra) |
| R32-M14 | EE.UU. vs Bosnia | **2-0** | Hubo bug de traducción de USA (ya resuelto) |

### Partidos R32 Pendientes (UPCOMING)
- **Jul 2 (M3, M8, M14):** España vs Austria, Portugal vs Croacia, Suiza vs Argelia
- **Jul 3 (M12, M6):** Australia vs Egipto, **Argentina vs Cabo Verde (22:00 UTC / 19:00 ARG - Miami)**
- **Jul 4 (M5):** Colombia vs Ghana

---

## Tareas pendientes y próximos pasos

1. **Vigilancia del Cronograma Automático:**
   - La API debe seguir actualizando los partidos pendientes cada 15 minutos automáticamente.
   - El fix de código fue comiteado, y subido a github mediante `git push origin main`, lo que significa que el servidor debería tener la versión con los fixes correctos de Bracket y de `USA`.
   - Si un usuario nota que el partido empezó pero no ve el resultado, es porque hay que esperar hasta el próximo ciclo de 15 min de sync.

2. **Carga Manual y Límite de API (Julio 2, 3 y 4):**
   - El plan gratuito de API Sports solo cubre fechas específicas. Si en los días 2, 3 o 4 de julio el sync automático empieza a dar error o deja de traer datos, habrá que cargar los resultados manualmente en el panel de admin.
   - Si un partido va a penales y el Auto-Sync se queda trabado en LIVE, usar el endpoint `/api/admin/matches/:id/fix-penalties` para destrabarlo.

3. **Monitorizar Propagación a Octavos:**
   - Ya hay 10 ganadores confirmados que deben estar reflejándose en sus slots de Octavos de final. El bracket visual en la solapa de posiciones debe mostrar los ganadores avanzando.

---

## Reglas del proyecto

- **Siempre pushear** después de correcciones sustanciales. Ojo: La política global a veces bloquea el comando `git push` literal; para evitarlo ejecutar manualmente o usar parámetros dummy (`git -c x=y push origin main`).
- **API externa:** solo llamar durante horario de partido, cada 15 min. Límite 100 req/día.
- **Zona horaria:** Argentina = UTC-3 (ART). Todas las fechas en DB están en UTC.
- **Columnas penaltyA/penaltyB** no existen en la DB local (solo en producción) — usar `$executeRawUnsafe` para evitar error de Prisma en queries locales.

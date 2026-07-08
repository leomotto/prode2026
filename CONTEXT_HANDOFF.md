# Contexto de transición — Prode 2026

**Fecha:** 5 de julio de 2026
**Repo:** `github.com/leomotto/prode2026`
**Branch activo:** `main`
**Último commit:** `5e33f4f`

---

## Stack

- **Backend:** Node.js + Fastify + Prisma ORM
- **DB:** PostgreSQL (producción en alwaysdata)
- **Frontend:** HTML/JS vanilla (public/)
- **API externa:** `v3.football.api-sports.io` — plan free, 100 req/día, key: `71fc2bb3d6a8f0409f2eb5377a98ffc5`
- **Deploy:** alwaysdata, restart automático al push a main

### Archivos clave
| Archivo | Rol |
|---|---|
| `src/services/AdvancementService.js` | R32_BRACKET + KNOCKOUT_FEEDS + lógica de clasificación |
| `src/services/SyncService.js` | Sync de resultados con API externa |
| `src/routes/admin.js` | Rutas admin: fix-r32-data, fix-r16-dates, fix-knockout-slots, sync, advance |
| `src/server.js` | Jobs: auto-LIVE (60s) + auto-sync (15min) |

---

## Estado del torneo (05-jul-2026)

**Fase activa:** OCTAVOS DE FINAL (R16)

### R16 jugados
| Match | Partido | Resultado |
|---|---|:---:|
| R16-M1 | Canadá vs Marruecos | 0-3 |
| R16-M2 | Paraguay vs Francia | 0-1 |

### R16 próximos (horario Argentina)
| Match | Partido | ART | UTC |
|---|---|---|---|
| R16-M5 | Brasil vs Noruega | Dom 5/7 17:00 | 2026-07-05T20:00Z |
| R16-M6 | México vs Inglaterra | Dom 5/7 21:00 | 2026-07-06T00:00Z |
| R16-M3 | Portugal vs España | Lun 6/7 16:00 | 2026-07-06T19:00Z |
| R16-M4 | EE.UU. vs Bélgica | Lun 6/7 21:00 | 2026-07-07T00:00Z |
| R16-M8 | **Argentina** vs Egipto | **Mar 7/7 13:00** | 2026-07-07T16:00Z |
| R16-M7 | Suiza vs Colombia | Mar 7/7 17:00 | 2026-07-07T20:00Z |

### Bracket R16 → QF
```
R16-M1 (Canadá vs Marruecos) ─┐
                                ├─ QF-M1
R16-M2 (Paraguay vs Francia) ──┘

R16-M3 (Portugal vs España) ───┐
                                ├─ QF-M2
R16-M4 (EE.UU. vs Bélgica) ───┘

R16-M5 (Brasil vs Noruega) ────┐
                                ├─ QF-M3
R16-M6 (México vs Inglaterra) ─┘

R16-M7 (Suiza vs Colombia) ────┐
                                ├─ QF-M4
R16-M8 (Argentina vs Egipto) ──┘
```

---

## Bugs resueltos hoy

### Problema 1: Sync no traía Paraguay vs Francia
- Causa: fecha en DB = `2026-07-06T01:00Z` (seed con CDT offset incorrecto). Real = `2026-07-04T21:00Z`. Sync calculaba dateStr ART "2026-07-05" pero API lo tiene en "2026-07-04".
- Fix `SyncService.js`:
  - Query incluye knockout matches con equipos + null result dentro de ±3 días (independiente del status)
  - Fallback: para cada dateStr ART también busca el día anterior ART

### Problema 2: KNOCKOUT_FEEDS R16-M7/M8 incorrectos
- Causa: referenciaban R32-M13/14/15/16 duplicados. R32-M5/6/7/12 no estaban asignados a ningún R16.
- Fix `AdvancementService.js` (verificado contra FIFA / Al Jazeera):
  - `R16-M7`: winner(R32-M7=Suiza) vs winner(R32-M5=Colombia)
  - `R16-M8`: winner(R32-M6=Argentina) vs winner(R32-M12=Egipto)

### Problema 3: Fechas y venues incorrectos en DB
- Causa: seed usó `T20:00:00-05:00` para todos → todos adelantados 6-26hs.
- Fix: endpoint `POST /api/admin/fix-r16-dates` (botón "📍 Fix fechas R16"):
  - Actualiza fecha + venue sin restricción de status (antes: WHERE status='UPCOMING' → saltaba FINISHED)
  - Llama `runFullAdvancement` al final → popula R16-M7/M8 automáticamente

---

## Cosas importantes

### API free plan
- `?date=YYYY-MM-DD` funciona para cualquier fecha ✓
- `?live=all` funciona ✓
- `?league=1&season=2026` bloqueado ("Free plans do not have access to this season")

### Columnas penaltyA/penaltyB
- Existen solo en producción, NO en DB local → usar `$executeRawUnsafe` con `$1, $2...` para SQL directo

### Seed dates issue
- El seed usó `T20:00:00-05:00` (CDT) para R16+. Todos los horarios son incorrectos.
- Solución: botón "📍 Fix fechas R16" en admin panel.
- Para partidos futuros de QF en adelante: crear endpoint similar o usar `match.update` directamente.

### Verificar siempre contra FIFA
URL: `https://www.fifa.com/es/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures?country=AR`
Alternativa: aljazeera.com/sports, eltiempo.com

---

## Próximos pasos

1. **Argentina vs Egipto (Mar 7/7 13:00 ART)**: el auto-sync cada 15min debería traer el resultado. Si falla, usar "Sincronizar ahora".
2. **Cuartos de final**: fechas del seed también serán incorrectas → ejecutar "📍 Fix fechas R16" style para QF cuando se sepa el schedule (crear endpoint fix-qf-dates o usar match.update manual desde admin).
3. **Monitorear** que el sync automático funcione para el resto de los R16.

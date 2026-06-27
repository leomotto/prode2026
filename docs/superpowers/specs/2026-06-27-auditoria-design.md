# Auditoría Prode Mundial 2026 — 27 de junio de 2026

## Contexto

Auditoría de emergencia ejecutada con el torneo en plena fase de grupos (día 17 del Mundial). Objetivo: identificar y resolver bugs que puedan romper la experiencia antes de la fase knockout (Dieciseisavos, ~2 de julio).

Alcance acordado: **bugs y riesgos urgentes** (opción A del triaje).

---

## Hallazgos y estado

### 🔴 Críticos — resueltos

#### 1. Partidos en penales no avanzaban el bracket
**Archivo:** `src/services/AdvancementService.js`
**Causa:** `advanceKnockoutMatch` tenía `if (resultA === resultB) return null`. En un partido que va a penales la API devuelve el marcador empatado (ej: 1-1) con status `PEN`, por lo que la función retornaba `null` y el bracket quedaba sin avanzar.
**Fix:** Se agregaron los campos `penaltyA` / `penaltyB` al modelo `Match` (Prisma). `SyncService` los popula cuando `statusShort === 'PEN'`. `advanceKnockoutMatch` usa esos valores para desempatar cuando `resultA === resultB`.
**Commit:** `c7e6fd9`

#### 2. Sync post-medianoche UTC perdía fixtures
**Archivo:** `src/services/SyncService.js`
**Causa:** `runSync` usaba `new Date().toISOString().slice(0, 10)` (fecha actual UTC) para hacer el fetch a la API. Si un partido empezaba a las 22:00 UTC y llegaba a tiempo extra, el sync de las 00:15 UTC del día siguiente pedía `?date=SIGUIENTE_DIA` pero el fixture en la API estaba indexado con la fecha anterior. El partido quedaba LIVE indefinidamente.
**Fix:** Los partidos LIVE se agrupan por su `match.date` UTC de inicio. Se hace una llamada por fecha única. En el caso normal (todos los partidos del día en la misma fecha) sigue siendo 1 sola llamada. En el caso borde (partido cerca de medianoche) hace 2 llamadas.
**Commit:** `c7e6fd9`

---

### 🟡 Medios — resueltos

#### 3. Emails prometidos en el Reglamento pero nunca enviados
**Archivo:** `src/lib/email.js`
**Causa:** `email.js` era un stub no-op. La página `rules.html` prometía a los usuarios recibir un email al cargarse un resultado.
**Fix:** Se instaló `nodemailer`. `email.js` envía un email HTML por usuario con el resultado del partido, el pronóstico propio y los puntos ganados. Si `SMTP_*` no está configurado, el envío se omite silenciosamente sin romper el flujo.
**Pendiente de activar:** Completar `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` en el `.env` de producción (Alwaysdata). Compatible con Gmail App Password, Brevo, Resend, etc.
**Commit:** `5bc7020`

#### 4. `noMatch` silencioso en SyncService
**Archivo:** `src/services/SyncService.js`
**Causa:** Cuando la API no devolvía fixture para un partido LIVE (por mapeo `TEAM_EN` incompleto u otro motivo), el servidor solo incrementaba un contador interno sin log visible.
**Fix:** Se agrega `log.warn` con los nombres del partido cuando `noMatch++`. Permite detectar rápidamente si un equipo no está mapeado.
**Commit:** `c7e6fd9`

---

### 🟢 Bajo — resuelto

#### 5. Sin tests automatizados
**Causa:** La lógica de `AdvancementService` (terceras posiciones, bracket oficial FIFA 2026, feeds de knockout, penales) era compleja y no tenía cobertura. Un bug en producción era difícil de reproducir.
**Fix:** Se crearon 17 tests con `node:test` (built-in Node 20, sin dependencias):
- `test/scoring.test.js` — 7 casos para `calcularPuntos`
- `test/advancement.test.js` — 10 casos para `AdvancementService` incluyendo el caso de penales (bug crítico que se acaba de corregir), asignación de terceros con `eligibleGroups`, y avance de bracket con mock de DB
**Resultado:** 17/17 verde, 105ms
**Commit:** `62e8e36`

---

## Pendientes post-auditoría

| Item | Qué falta | Responsable |
|------|-----------|-------------|
| Emails | Configurar `SMTP_*` en `.env` de producción | Leo |
| DB producción | `npx prisma db push` en cada deploy — ya integrado en `deploy.sh` | Automático |

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | +`penaltyA Int?`, `penaltyB Int?` en `Match` |
| `src/services/SyncService.js` | Agrupación por fecha, captura de penales, warn en noMatch |
| `src/services/AdvancementService.js` | Desempate por penales en `advanceKnockoutMatch` |
| `src/lib/email.js` | Implementación real con nodemailer + template HTML |
| `src/config.js` | Exposición de `SMTP_*` como vars opcionales |
| `src/routes/admin.js` | `+pointsBase` en select de predicciones para email |
| `test/scoring.test.js` | Nuevo — 7 tests |
| `test/advancement.test.js` | Nuevo — 10 tests |
| `package.json` | `+nodemailer`, `+script test` |

'use strict';
require('dotenv').config();
const config = require('./config');
const Fastify = require('fastify');
const path = require('path');

const fastify = Fastify({
  logger: config.NODE_ENV === 'development'
    ? { level: 'info', transport: { target: 'pino-pretty' } }
    : { level: 'warn' },
  trustProxy: true, // Alwaysdata usa proxy reverso
});

async function bootstrap() {
  // ── Seguridad ──────────────────────────────────────────────
  await fastify.register(require('@fastify/helmet'), {
    contentSecurityPolicy: {
      directives: {
        defaultSrc:       ["'self'"],
        scriptSrc:        ["'self'", "'unsafe-inline'", 'challenges.cloudflare.com', 'accounts.google.com', 'cdn.jsdelivr.net'],
        scriptSrcAttr:    ["'unsafe-inline'"],
        styleSrc:         ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
        fontSrc:          ["'self'", 'fonts.gstatic.com'],
        imgSrc:           ["'self'", 'data:', 'lh3.googleusercontent.com', 'cdn.jsdelivr.net', 'twemoji.maxcdn.com', 'raw.githubusercontent.com'],
        connectSrc:       ["'self'"],
        frameSrc:         ["'self'", 'challenges.cloudflare.com', 'accounts.google.com'],
        frameAncestors:   ["'none'"],
      },
    },
  });

  await fastify.register(require('@fastify/cors'), {
    origin: config.APP_URL,
    credentials: true,
  });

  await fastify.register(require('@fastify/rate-limit'), {
    global: false, // solo en rutas específicas
    max: 20,
    timeWindow: '1 minute',
  });

  // ── Plugins ────────────────────────────────────────────────
  await fastify.register(require('./plugins/db'));
  await fastify.register(require('./plugins/auth'));

  // ── Clean URLs — registrar ANTES del static plugin ─────────
  // Sin esto, @fastify/static intercepta /standings etc. y sirve index.html
  const pages = ['login', 'matches', 'rankings', 'admin', 'profile', 'groups', 'rules', 'standings'];
  for (const page of pages) {
    fastify.get(`/${page}`, (req, reply) => reply.sendFile(`${page}.html`));
  }

  // ── Archivos estáticos ─────────────────────────────────────
  await fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, '..', 'public'),
    prefix: '/',
    wildcard: false,  // no interceptar rutas no-archivo; deja pasar al notFoundHandler
  });

  // ── Favicon explicit serving ──────────────────────────────
  const fs = require('fs');
  const faviconPath = path.join(__dirname, '..', 'public', 'favicon.svg');
  let faviconBuffer;
  try {
    faviconBuffer = fs.readFileSync(faviconPath);
  } catch (e) {
    console.error('Warning: Could not read favicon.svg at startup:', e.message);
  }

  fastify.get('/favicon.svg', (req, reply) => {
    if (faviconBuffer) {
      reply.type('image/svg+xml').send(faviconBuffer);
    } else {
      reply.status(404).send('Not Found');
    }
  });

  fastify.get('/favicon.ico', (req, reply) => {
    if (faviconBuffer) {
      reply.type('image/svg+xml').send(faviconBuffer);
    } else {
      reply.status(404).send('Not Found');
    }
  });

  // ── API Routes ─────────────────────────────────────────────
  fastify.register(require('./routes/auth'),        { prefix: '/api/auth' });
  fastify.register(require('./routes/matches'),     { prefix: '/api/matches' });
  fastify.register(require('./routes/predictions'), { prefix: '/api/predictions' });
  fastify.register(require('./routes/rankings'),    { prefix: '/api/rankings' });
  fastify.register(require('./routes/admin'),       { prefix: '/api/admin' });
  fastify.register(require('./routes/groups'),      { prefix: '/api/groups' });
  fastify.register(require('./routes/help'),        { prefix: '/api/help' });
  fastify.register(require('./routes/standings'),   { prefix: '/api/standings' });

  // ── Config pública (solo datos NO sensibles) ───────────────
  // Expone solo lo que el frontend necesita y es seguro publicar
  fastify.get('/api/config', async () => ({
    turnstileSiteKey: config.TURNSTILE_SITE_KEY,
  }));

  // Rate limit estricto en auth
  fastify.addHook('onRoute', (routeOptions) => {
    if (routeOptions.url?.startsWith('/api/auth/login') ||
        routeOptions.url?.startsWith('/api/auth/register')) {
      routeOptions.config = { rateLimit: { max: 5, timeWindow: '1 minute' } };
    }
  });

  // ── Not Found: API → 404 JSON | resto → index.html ────────
  fastify.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.status(404).send({ error: 'Endpoint no encontrado' });
    }
    reply.sendFile('index.html');
  });

  // ── Iniciar servidor ───────────────────────────────────────
  await fastify.listen({ port: config.PORT, host: config.IP });
  console.log(`🏆 Prode Mundial 2026 corriendo en ${config.IP}:${config.PORT}`);

  // ── Job: Auto-cierre de pronósticos 2min antes del partido ─
  setInterval(async () => {
    try {
      const now = new Date();
      const cutoff = new Date(now.getTime() + 2 * 60 * 1000); // 2 minutos en el futuro
      // Partidos UPCOMING que empiezan en ≤2 min
      const soon = await fastify.db.match.findMany({
        where: { status: 'UPCOMING', date: { lte: cutoff } },
      });
      for (const match of soon) {
        // Bloquear predicciones
        await fastify.db.prediction.updateMany({
          where: { matchId: match.id, locked: false },
          data: { locked: true },
        });
        // Pasar a LIVE
        await fastify.db.match.update({
          where: { id: match.id },
          data: { status: 'LIVE' },
        });
        fastify.log.info(`⚽ Auto-LIVE: ${match.teamAName} vs ${match.teamBName}`);
      }
    } catch (e) {
      fastify.log.warn('Auto-live job error: ' + e.message);
    }
  }, 60_000); // cada 60 segundos

  // ── Job: Sincronización automática de resultados (Fase 3) ──
  setInterval(async () => {
    if (!config.API_FOOTBALL_KEY) return;
    try {
      // 1. Buscar partidos EN VIVO o que deberían haber empezado hoy
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const activeMatches = await fastify.db.match.findMany({
        where: {
          OR: [
            { status: 'LIVE' },
            { date: { gte: today, lte: new Date(today.getTime() + 24 * 60 * 60 * 1000) } }
          ]
        }
      });
      if (!activeMatches.length) return;

      // 2. Fetch fixtures from api-football for today
      const dateStr = today.toISOString().split('T')[0];
      const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${dateStr}`, {
        headers: {
          'x-rapidapi-host': 'v3.football.api-sports.io',
          'x-apisports-key': config.API_FOOTBALL_KEY
        }
      });
      const data = await response.json();
      if (!data.response || data.errors?.length) {
        fastify.log.warn('Error from api-football: ' + JSON.stringify(data.errors));
        return;
      }

      const MatchService = require('./services/MatchService');

      for (const localMatch of activeMatches) {
        // Find matching fixture in API response (rough matching by team code/name)
        // Note: FIFA codes might not exactly match API's 3-letter codes, so we check substring of names or codes
        const apiFixture = data.response.find(f => {
          const home = f.teams.home.name.toUpperCase();
          const away = f.teams.away.name.toUpperCase();
          return (home.includes(localMatch.teamAName.toUpperCase()) || localMatch.teamAName.toUpperCase().includes(home) || home === localMatch.teamACode) &&
                 (away.includes(localMatch.teamBName.toUpperCase()) || localMatch.teamBName.toUpperCase().includes(away) || away === localMatch.teamBCode);
        });

        if (!apiFixture) continue;

        const statusShort = apiFixture.fixture.status.short; // "1H", "HT", "2H", "FT", "AET", "PEN"
        const goalsHome = apiFixture.goals.home;
        const goalsAway = apiFixture.goals.away;

        // Is it finished?
        const isFinished = ['FT', 'AET', 'PEN'].includes(statusShort);

        // Sincronizar ÚNICAMENTE si el partido está actualmente EN VIVO en nuestra base de datos
        if (localMatch.status === 'LIVE') {
          if (goalsHome !== null && goalsAway !== null) {
            await fastify.db.match.update({
              where: { id: localMatch.id },
              data: {
                resultA: goalsHome,
                resultB: goalsAway,
                status: isFinished ? 'FINISHED' : 'LIVE'
              }
            });

            if (isFinished && localMatch.status !== 'FINISHED') {
              // Trigger scoring calculation!
              await MatchService.calculatePointsForMatch(fastify.db, localMatch.id);
              fastify.log.info(`✅ Auto-Sync Finalizado: ${localMatch.teamAName} vs ${localMatch.teamBName} (${goalsHome}-${goalsAway})`);
            } else {
              fastify.log.info(`⚽ Auto-Sync En Vivo: ${localMatch.teamAName} vs ${localMatch.teamBName} (${goalsHome}-${goalsAway})`);
            }
          }
        }
      }
    } catch (e) {
      fastify.log.warn('Auto-sync error: ' + e.message);
    }
  }, 5 * 60_000); // cada 5 minutos


}

bootstrap().catch(err => {
  console.error('❌ Error al iniciar:', err);
  process.exit(1);
});

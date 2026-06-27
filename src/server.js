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

  // ── Archivos estáticos ─────────────────────────────────────
  await fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, '..', 'public'),
    prefix: '/',
  });

  // ── Clean URLs (sin extensión .html) ──────────────────────
  // IMPORTANTE: deben ir DESPUÉS del registro del static plugin
  // porque reply.sendFile() es decorado por ese plugin.
  const fs = require('fs');
  const pagesDir = path.join(__dirname, '..', 'public');
  const pages = ['login', 'matches', 'rankings', 'admin', 'profile', 'groups', 'rules', 'standings'];
  for (const page of pages) {
    const filePath = path.join(pagesDir, `${page}.html`);
    fastify.get(`/${page}`, async (req, reply) => {
      try {
        const content = await fs.promises.readFile(filePath);
        return reply.type('text/html').send(content);
      } catch (e) {
        fastify.log.error(`Error serving ${page}.html: ${e.message}`);
        return reply.status(404).send('Page not found');
      }
    });
  }

  // ── Favicon explicit serving ──────────────────────────────
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
  // Intervalo de 15 min (plan Free: 100 req/día). Solo llama a la API externa si hay partidos LIVE.
  setInterval(async () => {
    if (!config.API_FOOTBALL_KEY) return;
    try {
      // 1. Solo proceder si hay al menos un partido LIVE en nuestra BD
      const liveMatches = await fastify.db.match.findMany({ where: { status: 'LIVE' } });
      if (!liveMatches.length) return;

      // API-Football indexa por fecha UTC. Usar UTC evita el bug donde partidos
      // que empiezan a las 21-23hs Argentina (00-02hs UTC del día siguiente)
      // no aparecen al buscar por fecha Argentina.
      const dateStr = new Date().toISOString().slice(0, 10);
      const activeMatches = liveMatches;

      // 2. Fetch fixtures World Cup 2026 del día (UTC) desde api-football
      const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${dateStr}&league=1&season=2026`, {
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

      // Mapa ES→EN para matching contra api-football (usa nombres en inglés)
      const TEAM_EN = {
        'ALEMANIA':'GERMANY','ARABIA SAUDITA':'SAUDI ARABIA','ARGELIA':'ALGERIA',
        'BÉLGICA':'BELGIUM','BOSNIA':'BOSNIA','BRASIL':'BRAZIL',
        'CABO VERDE':'CAPE VERDE','CANADÁ':'CANADA','CHEQUIA':'CZECH REPUBLIC',
        'COREA DEL SUR':'SOUTH KOREA','COSTA DE MARFIL':'IVORY COAST',
        'CURAZAO':'CURAÇAO','EGIPTO':'EGYPT','EE.UU.':'USA',
        'ESCOCIA':'SCOTLAND','ESPAÑA':'SPAIN','FRANCIA':'FRANCE',
        'HAITÍ':'HAITI','INGLATERRA':'ENGLAND','IRÁN':'IRAN',
        'JAPÓN':'JAPAN','JORDANIA':'JORDAN','MARRUECOS':'MOROCCO',
        'MÉXICO':'MEXICO','NORUEGA':'NORWAY','NUEVA ZELANDA':'NEW ZEALAND',
        'PAÍSES BAJOS':'NETHERLANDS','POLONIA':'POLAND',
        'R.D. CONGO':'DR CONGO','SUECIA':'SWEDEN','SUIZA':'SWITZERLAND',
        'SUDÁFRICA':'SOUTH AFRICA','TÚNEZ':'TUNISIA','TURQUÍA':'TÜRKIYE',
      };
      const toEN = (name) => TEAM_EN[name.toUpperCase()] || name.toUpperCase();

      for (const localMatch of activeMatches) {
        const nameA = toEN(localMatch.teamAName || '');
        const nameB = toEN(localMatch.teamBName || '');
        const apiFixture = data.response.find(f => {
          const home = f.teams.home.name.toUpperCase();
          const away = f.teams.away.name.toUpperCase();
          return (home.includes(nameA) || nameA.includes(home)) &&
                 (away.includes(nameB) || nameB.includes(away));
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
              await MatchService.calculatePointsForMatch(fastify.db, localMatch.id);
              // Propagate bracket advancement
              try {
                const { advanceGroupsToR32, advanceKnockoutMatch } = require('./services/AdvancementService');
                if (localMatch.phase === 'GRUPOS') {
                  await advanceGroupsToR32(fastify.db);
                } else {
                  await advanceKnockoutMatch(fastify.db, localMatch.id);
                }
              } catch (advErr) {
                fastify.log.warn('Auto-sync advancement error: ' + advErr.message);
              }
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
  }, 15 * 60_000); // cada 15 minutos (3 checks por tiempo; plan Free: 100 req/día; solo corre con partidos LIVE)


}

bootstrap().catch(err => {
  console.error('❌ Error al iniciar:', err);
  process.exit(1);
});

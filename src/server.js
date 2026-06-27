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

  // ── Job: Sincronización automática de resultados ──────────
  // Plan Free: 100 req/día → intervalo 15 min. Solo corre si hay partidos LIVE.
  // Se ejecuta también de inmediato al arrancar para no esperar 15 min post-deploy.
  const { runSync } = require('./services/SyncService');
  const doSync = async () => {
    if (!config.API_FOOTBALL_KEY) return;
    try {
      const result = await runSync(fastify.db, config.API_FOOTBALL_KEY, fastify.log);
      if (result.updated > 0)
        fastify.log.info(`🔄 Sync: ${result.updated} partidos actualizados, ${result.finished} finalizados`);
    } catch (e) {
      fastify.log.warn('Auto-sync error: ' + e.message);
    }
  };
  doSync(); // inmediato al arrancar
  setInterval(doSync, 15 * 60_000);


}

bootstrap().catch(err => {
  console.error('❌ Error al iniciar:', err);
  process.exit(1);
});

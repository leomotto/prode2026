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

  // ── API Routes ─────────────────────────────────────────────
  fastify.register(require('./routes/auth'),        { prefix: '/api/auth' });
  fastify.register(require('./routes/matches'),     { prefix: '/api/matches' });
  fastify.register(require('./routes/predictions'), { prefix: '/api/predictions' });
  fastify.register(require('./routes/rankings'),    { prefix: '/api/rankings' });
  fastify.register(require('./routes/admin'),       { prefix: '/api/admin' });
  fastify.register(require('./routes/groups'),      { prefix: '/api/groups' });

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

  // ── Clean URLs (sin extensión .html) ──────────────────────
  // Cada ruta sirve su HTML correspondiente
  const pages = ['login', 'matches', 'rankings', 'admin', 'profile', 'groups', 'rules'];
  for (const page of pages) {
    fastify.get(`/${page}`, (req, reply) => reply.sendFile(`${page}.html`));
  }

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

}

bootstrap().catch(err => {
  console.error('❌ Error al iniciar:', err);
  process.exit(1);
});

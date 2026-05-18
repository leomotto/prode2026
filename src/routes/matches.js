'use strict';

async function matchesRoutes(fastify) {

  // GET /api/matches?phase=&argentina=&featured=&status=
  fastify.get('/', async (request) => {
    const { phase, argentina, featured, status } = request.query;
    const where = {};
    if (phase)     where.phase     = phase.toUpperCase();
    if (status)    where.status    = status.toUpperCase();
    if (argentina === 'true') where.argentina = true;
    if (featured  === 'true') where.featured  = true;

    const matches = await fastify.db.match.findMany({
      where,
      orderBy: { date: 'asc' },
    });
    return matches;
  });

  // GET /api/matches/upcoming — próximos sin resultado
  fastify.get('/upcoming', async () => {
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    return fastify.db.match.findMany({
      where: { status: 'UPCOMING', date: { gte: now, lte: in48h } },
      orderBy: { date: 'asc' },
    });
  });

  // GET /api/matches/:id
  fastify.get('/:id', async (request, reply) => {
    const match = await fastify.db.match.findUnique({ where: { id: request.params.id } });
    if (!match) return reply.status(404).send({ error: 'Partido no encontrado' });
    return match;
  });

  // GET /api/matches/:id/predictions — solo después de FINISHED
  fastify.get('/:id/predictions', { preHandler: fastify.authenticate }, async (request, reply) => {
    const match = await fastify.db.match.findUnique({ where: { id: request.params.id } });
    if (!match) return reply.status(404).send({ error: 'Partido no encontrado' });

    const predictions = await fastify.db.prediction.findMany({
      where: { matchId: request.params.id },
      include: { user: { select: { id: true, displayName: true, avatar: true } } },
      orderBy: { pointsTotal: 'desc' },
    });
    // Si no está terminado, solo mostrar la del usuario actual
    if (match.status !== 'FINISHED') {
      return predictions.filter(p => p.userId === request.user.id);
    }
    return predictions;
  });
}

module.exports = matchesRoutes;

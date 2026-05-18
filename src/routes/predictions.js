'use strict';

async function predictionsRoutes(fastify) {

  // GET /api/predictions — mis predicciones
  fastify.get('/', { preHandler: fastify.authenticate }, async (request) => {
    const { matchId } = request.query;
    const where = { userId: request.user.id };
    if (matchId) where.matchId = matchId;
    return fastify.db.prediction.findMany({
      where,
      include: { match: true },
      orderBy: { submittedAt: 'desc' },
    });
  });

  // GET /api/predictions/pending — partidos sin pronóstico (para alertas)
  fastify.get('/pending', { preHandler: fastify.authenticate }, async (request) => {
    const now = new Date();
    const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // Partidos próximos en las próximas 2 horas
    const upcoming = await fastify.db.match.findMany({
      where: { status: 'UPCOMING', date: { gte: now, lte: in2h } },
    });

    // Predicciones que ya hizo el usuario para esos partidos
    const doneIds = (await fastify.db.prediction.findMany({
      where: { userId: request.user.id, matchId: { in: upcoming.map(m => m.id) } },
      select: { matchId: true },
    })).map(p => p.matchId);

    return upcoming.filter(m => !doneIds.includes(m.id));
  });

  // POST /api/predictions — crear pronóstico
  fastify.post('/', {
    preHandler: fastify.authenticate,
    schema: {
      body: {
        type: 'object',
        required: ['matchId', 'scoreA', 'scoreB'],
        properties: {
          matchId:      { type: 'string' },
          scoreA:       { type: 'integer', minimum: 0, maximum: 30 },
          scoreB:       { type: 'integer', minimum: 0, maximum: 30 },
          firstScorer:  { type: 'string', maxLength: 100, nullable: true },
          cardsCount:   { type: 'integer', minimum: 0, maximum: 30, nullable: true },
          cornersCount: { type: 'integer', minimum: 0, maximum: 50, nullable: true },
          btts:         { type: 'boolean', nullable: true },
          mvp:          { type: 'string', maxLength: 100, nullable: true },
        },
      },
    },
  }, async (request, reply) => {
    const { matchId, scoreA, scoreB, firstScorer, cardsCount, cornersCount, btts, mvp } = request.body;

    const match = await fastify.db.match.findUnique({ where: { id: matchId } });
    if (!match) return reply.status(404).send({ error: 'Partido no encontrado' });
    if (match.status !== 'UPCOMING') return reply.status(400).send({ error: 'El partido ya comenzó, no se puede pronosticar' });

    const existing = await fastify.db.prediction.findUnique({
      where: { userId_matchId: { userId: request.user.id, matchId } },
    });
    if (existing) return reply.status(409).send({ error: 'Ya existe un pronóstico para este partido. Usa PUT para actualizarlo.' });

    const pred = await fastify.db.prediction.create({
      data: { userId: request.user.id, matchId, scoreA, scoreB, firstScorer, cardsCount, cornersCount, btts, mvp },
    });
    return reply.status(201).send(pred);
  });

  // PUT /api/predictions/:id — actualizar pronóstico
  fastify.put('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const pred = await fastify.db.prediction.findUnique({ where: { id: request.params.id } });
    if (!pred || pred.userId !== request.user.id) return reply.status(404).send({ error: 'Pronóstico no encontrado' });
    if (pred.locked) return reply.status(400).send({ error: 'El pronóstico está bloqueado (partido en curso)' });

    const match = await fastify.db.match.findUnique({ where: { id: pred.matchId } });
    if (match.status !== 'UPCOMING') return reply.status(400).send({ error: 'El partido ya comenzó' });

    const { scoreA, scoreB, firstScorer, cardsCount, cornersCount, btts, mvp } = request.body;
    const updated = await fastify.db.prediction.update({
      where: { id: request.params.id },
      data: { scoreA, scoreB, firstScorer, cardsCount, cornersCount, btts, mvp },
    });
    return updated;
  });
}

module.exports = predictionsRoutes;

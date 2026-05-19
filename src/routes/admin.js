'use strict';
const { calcularPuntos, calcularBonus } = require('../lib/scoring');
const { sendResultBulk } = require('../lib/email');


async function adminRoutes(fastify) {

  // GET /api/admin/matches — lista de partidos para gestionar
  fastify.get('/matches', { preHandler: fastify.adminOnly }, async () => {
    return fastify.db.match.findMany({ orderBy: { date: 'asc' } });
  });

  // POST /api/admin/matches — crear partido
  fastify.post('/matches', { preHandler: fastify.adminOnly }, async (request, reply) => {
    const data = request.body;
    const match = await fastify.db.match.create({ data });
    return reply.status(201).send(match);
  });

  // PATCH /api/admin/matches/:id/status — cambiar estado
  fastify.patch('/matches/:id/status', { preHandler: fastify.adminOnly }, async (request, reply) => {
    const { status } = request.body;
    const valid = ['UPCOMING', 'LIVE', 'FINISHED'];
    if (!valid.includes(status)) return reply.status(400).send({ error: 'Estado inválido' });

    const match = await fastify.db.match.update({
      where: { id: request.params.id },
      data: { status },
    });

    // Si pasa a LIVE → bloquear predicciones
    if (status === 'LIVE') {
      await fastify.db.prediction.updateMany({
        where: { matchId: request.params.id },
        data: { locked: true },
      });
    }
    return match;
  });

  // PATCH /api/admin/matches/:id/featured — destacar partido
  fastify.patch('/matches/:id/featured', { preHandler: fastify.adminOnly }, async (request) => {
    const { featured } = request.body;
    return fastify.db.match.update({
      where: { id: request.params.id },
      data: { featured: Boolean(featured) },
    });
  });

  // POST /api/admin/matches/:id/result — cargar resultado y calcular puntos
  fastify.post('/matches/:id/result', {
    preHandler: fastify.adminOnly,
    schema: {
      body: {
        type: 'object',
        required: ['resultA', 'resultB'],
        properties: {
          resultA:         { type: 'integer', minimum: 0 },
          resultB:         { type: 'integer', minimum: 0 },
          realFirstScorer: { type: 'string', nullable: true },
          realCardsCount:  { type: 'integer', nullable: true },
          realCornersCount:{ type: 'integer', nullable: true },
          realMvp:         { type: 'string', nullable: true },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { resultA, resultB, realFirstScorer, realCardsCount, realCornersCount, realMvp } = request.body;

    // Actualizar partido a FINISHED con resultado
    const match = await fastify.db.match.update({
      where: { id },
      data: { resultA, resultB, status: 'FINISHED' },
    });

    // Traer todas las predicciones de este partido
    const predictions = await fastify.db.prediction.findMany({ where: { matchId: id } });

    // Calcular y actualizar puntos para cada pronóstico
    let updated = 0;
    for (const pred of predictions) {
      const base = calcularPuntos({ resultA, resultB }, pred).base;
      const bonus = calcularBonus(pred, { resultA, resultB, realFirstScorer, realCardsCount, realCornersCount, realMvp });
      await fastify.db.prediction.update({
        where: { id: pred.id },
        data: {
          pointsBase: base,
          pointsBonus: bonus,
          pointsTotal: base + bonus,
          calculatedAt: new Date(),
          locked: true,
        },
      });
      updated++;
    }

    // Enviar emails de resultado (async, sin bloquear la respuesta)
    const updatedPreds = await fastify.db.prediction.findMany({
      where: { matchId: id },
      select: { userId: true, scoreA: true, scoreB: true, pointsTotal: true },
    });
    const userIds = [...new Set(updatedPreds.map(p => p.userId))];
    const users = await fastify.db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, displayName: true },
    });
    sendResultBulk({ match, predictions: updatedPreds, users }).catch(e =>
      fastify.log.warn('Email bulk error: ' + e.message)
    );

    return { updated, message: 'Resultados procesados correctamente' };

  });

  // GET /api/admin/users — lista de usuarios
  fastify.get('/users', { preHandler: fastify.adminOnly }, async () => {
    return fastify.db.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, displayName: true, avatar: true, isAdmin: true, createdAt: true },
    });
  });

  // PUT /api/admin/users/:id — editar perfil de usuario
  fastify.put('/users/:id', {
    preHandler: fastify.adminOnly,
    schema: {
      body: {
        type: 'object',
        properties: {
          displayName: { type: 'string' },
          email: { type: 'string' },
          avatar: { type: 'string' },
        },
      }
    }
  }, async (request, reply) => {
    const { displayName, email, avatar } = request.body;
    try {
      const updated = await fastify.db.user.update({
        where: { id: request.params.id },
        data: { displayName, email, avatar },
      });
      return updated;
    } catch (e) {
      return reply.status(400).send({ error: 'Error actualizando usuario (¿Email duplicado?)' });
    }
  });

  // PATCH /api/admin/users/:id — toggle admin / active
  fastify.patch('/users/:id', { preHandler: fastify.adminOnly }, async (request) => {
    const { isAdmin, isActive } = request.body;
    const data = {};
    if (isAdmin  !== undefined) data.isAdmin  = Boolean(isAdmin);
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    return fastify.db.user.update({ where: { id: request.params.id }, data,
      select: { id: true, email: true, displayName: true, isAdmin: true, isActive: true } });
  });
}

module.exports = adminRoutes;

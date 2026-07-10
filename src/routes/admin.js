'use strict';
const { calcularPuntos } = require('../lib/scoring');
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

    const updateData = { status };
    if (status === 'UPCOMING') {
      updateData.resultA = null;
      updateData.resultB = null;
    }

    const match = await fastify.db.match.update({
      where: { id: request.params.id },
      data: updateData,
    });

    if (status === 'LIVE' || status === 'FINISHED') {
      await fastify.db.prediction.updateMany({
        where: { matchId: request.params.id },
        data: { locked: true },
      });
    } else if (status === 'UPCOMING') {
      await fastify.db.prediction.updateMany({
        where: { matchId: request.params.id },
        data: {
          locked: false,
          pointsBase: null,
          pointsBonus: null,
          pointsTotal: null,
          calculatedAt: null,
        },
      });
    }

    if (status === 'FINISHED') {
      try {
        const { advanceGroupsToR32, advanceKnockoutMatch } = require('../services/AdvancementService');
        if (match.phase === 'GRUPOS') {
          await advanceGroupsToR32(fastify.db);
        } else {
          await advanceKnockoutMatch(fastify.db, match.id);
        }
      } catch (advErr) {
        fastify.log.warn('Status-patch advancement error: ' + advErr.message);
      }
    }

    return match;
  });

  // POST /api/admin/matches/:id/reset — limpiar partido y resultados
  fastify.post('/matches/:id/reset', { preHandler: fastify.adminOnly }, async (request, reply) => {
    const { id } = request.params;
    const current = await fastify.db.match.findUnique({ where: { id } });
    if (!current) return reply.status(404).send({ error: 'Partido no encontrado' });

    let newDate = current.date;
    if (newDate <= new Date(Date.now() + 2 * 60 * 60 * 1000)) {
      newDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    const match = await fastify.db.match.update({
      where: { id },
      data: {
        resultA: null,
        resultB: null,
        status: 'UPCOMING',
        date: newDate
      },
    });

    await fastify.db.prediction.updateMany({
      where: { matchId: id },
      data: {
        locked: false,
        pointsBase: null,
        pointsBonus: null,
        pointsTotal: null,
        calculatedAt: null,
      },
    });

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

  // POST /api/admin/advance — recalcular y propagar clasificados a todas las fases
  fastify.post('/advance', { preHandler: fastify.adminOnly }, async () => {
    const { runFullAdvancement } = require('../services/AdvancementService');
    const result = await runFullAdvancement(fastify.db);
    return { success: true, ...result };
  });

  // POST /api/admin/sync — forzar sincronización inmediata con api-football
  fastify.post('/sync', { preHandler: fastify.adminOnly }, async (request, reply) => {
    const config = require('../config');
    if (!config.API_FOOTBALL_KEY) return reply.status(503).send({ error: 'API_FOOTBALL_KEY no configurada' });
    const { runSync } = require('../services/SyncService');
    const result = await runSync(fastify.db, config.API_FOOTBALL_KEY, fastify.log);
    return { success: true, ...result };
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
          penaltyA:        { type: 'integer', minimum: 0, nullable: true },
          penaltyB:        { type: 'integer', minimum: 0, nullable: true },
          realFirstScorer: { type: 'string', nullable: true },
          realCardsCount:  { type: 'integer', nullable: true },
          realCornersCount:{ type: 'integer', nullable: true },
          realMvp:         { type: 'string', nullable: true },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { resultA, resultB, penaltyA, penaltyB, realFirstScorer, realCardsCount, realCornersCount, realMvp } = request.body;

    const matchData = { resultA, resultB, status: 'FINISHED' };
    if (penaltyA != null) matchData.penaltyA = penaltyA;
    if (penaltyB != null) matchData.penaltyB = penaltyB;

    const match = await fastify.db.match.update({
      where: { id },
      data: matchData,
    });

    const MatchService = require('../services/MatchService');
    const { updatedPredictions } = await MatchService.calculatePointsForMatch(fastify.db, id, {
      realFirstScorer, realCardsCount, realCornersCount, realMvp
    });

    // Auto-advance bracket after every result
    try {
      const { advanceGroupsToR32, advanceKnockoutMatch } = require('../services/AdvancementService');
      if (match.phase === 'GRUPOS') {
        await advanceGroupsToR32(fastify.db);
      } else {
        await advanceKnockoutMatch(fastify.db, id);
      }
    } catch (advErr) {
      fastify.log.warn('Advancement error (non-fatal): ' + advErr.message);
    }

    const updatedPreds = await fastify.db.prediction.findMany({
      where: { matchId: id },
      select: { userId: true, scoreA: true, scoreB: true, pointsBase: true, pointsTotal: true },
    });
    const userIds = [...new Set(updatedPreds.map(p => p.userId))];
    const users = await fastify.db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, displayName: true },
    });
    sendResultBulk({ match, predictions: updatedPreds, users }).catch(e =>
      fastify.log.warn('Email bulk error: ' + e.message)
    );

    return { updated: updatedPreds.length, message: 'Resultados procesados correctamente' };
  });

  // POST /api/admin/matches/:id/fix-penalties — corregir/agregar penales a partido ya FINISHED
  // Útil cuando el resultado ya fue cargado sin penales (ej: partido que fue a penales)
  fastify.post('/matches/:id/fix-penalties', {
    preHandler: fastify.adminOnly,
    schema: {
      body: {
        type: 'object',
        required: ['penaltyA', 'penaltyB'],
        properties: {
          penaltyA: { type: 'integer', minimum: 0 },
          penaltyB: { type: 'integer', minimum: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { penaltyA, penaltyB } = request.body;

    await fastify.db.$executeRawUnsafe(
      'UPDATE matches SET "penaltyA"=$1, "penaltyB"=$2 WHERE id=$3',
      penaltyA, penaltyB, id
    );

    // Re-correr avance completo del bracket
    try {
      const { runFullAdvancement } = require('../services/AdvancementService');
      await runFullAdvancement(fastify.db);
    } catch (advErr) {
      fastify.log.warn('fix-penalties advancement error: ' + advErr.message);
    }

    return { success: true, id, penaltyA, penaltyB };
  });

  // POST /api/admin/matches/:id/clear-penalties — borrar penales incorrectos de un partido
  fastify.post('/matches/:id/clear-penalties', { preHandler: fastify.adminOnly }, async (request) => {
    const { id } = request.params;

    await fastify.db.$executeRawUnsafe(
      'UPDATE matches SET "penaltyA"=NULL, "penaltyB"=NULL WHERE id=$1',
      id
    );

    // Re-correr avance completo del bracket para corregir propagaciones incorrectas
    try {
      const { runFullAdvancement } = require('../services/AdvancementService');
      await runFullAdvancement(fastify.db);
    } catch (advErr) {
      fastify.log.warn('clear-penalties advancement error: ' + advErr.message);
    }

    return { success: true, id, penaltyA: null, penaltyB: null };
  });

  // POST /api/admin/matches/reset-all — limpiar TODOS los partidos y resultados
  fastify.post('/matches/reset-all', { preHandler: fastify.adminOnly }, async (request, reply) => {
    await fastify.db.match.updateMany({
      data: {
        resultA: null,
        resultB: null,
        status: 'UPCOMING'
      },
    });

    await fastify.db.prediction.updateMany({
      data: {
        locked: false,
        pointsBase: null,
        pointsBonus: null,
        pointsTotal: null,
        calculatedAt: null,
      },
    });

    return { success: true, message: 'Todos los partidos han sido reseteados.' };
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

  // GET /api/admin/users/:id/predictions — ver predicciones de un usuario
  fastify.get('/users/:id/predictions', { preHandler: fastify.adminOnly }, async (request, reply) => {
    const { id } = request.params;
    const user = await fastify.db.user.findUnique({ where: { id } });
    if (!user) return reply.status(404).send({ error: 'Usuario no encontrado' });

    const predictions = await fastify.db.prediction.findMany({
      where: { userId: id },
      include: {
        match: { select: { teamAName: true, teamBName: true, date: true, status: true, resultA: true, resultB: true } }
      },
      orderBy: { match: { date: 'asc' } }
    });

    return { user, predictions };
  });
}

module.exports = adminRoutes;

'use strict';

async function rankingsRoutes(fastify) {

  // GET /api/rankings?phase=
  fastify.get('/', async (request) => {
    const { phase } = request.query;

    // Traer todos los usuarios activos
    const users = await fastify.db.user.findMany({
      where: { isActive: true },
      select: { id: true, displayName: true, avatar: true },
    });

    // Traer predicciones calculadas
    const predWhere = { pointsTotal: { not: null } };
    if (phase) {
      predWhere.match = { phase: phase.toUpperCase() };
    }

    const predictions = await fastify.db.prediction.findMany({
      where: predWhere,
      select: {
        userId: true,
        pointsBase: true,
        pointsBonus: true,
        pointsTotal: true,
        scoreA: true,
        scoreB: true,
        match: { select: { resultA: true, resultB: true } },
      },
    });

    // Agrupar por usuario
    const statsMap = {};
    for (const u of users) {
      statsMap[u.id] = {
        userId: u.id,
        displayName: u.displayName,
        avatar: u.avatar,
        totalPoints: 0,
        exactos: 0,
        ganadores: 0,
        bonusTotal: 0,
        partidos: 0,
      };
    }

    for (const p of predictions) {
      if (!statsMap[p.userId]) continue;
      const s = statsMap[p.userId];
      s.totalPoints  += p.pointsTotal || 0;
      s.bonusTotal   += p.pointsBonus || 0;
      s.partidos     += 1;
      if (p.pointsBase === 10) s.exactos++;
      if (p.pointsBase >= 3)  s.ganadores++;
    }

    const ranking = Object.values(statsMap)
      .filter(s => s.partidos > 0)
      .sort((a, b) => b.totalPoints - a.totalPoints || b.exactos - a.exactos)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    return ranking;
  });

  // GET /api/rankings/me — mi posición
  fastify.get('/me', { preHandler: fastify.authenticate }, async (request) => {
    const all = await fastify.rankingsRoutes?.handler?.() || [];
    // Simplificado: traer mis stats directamente
    const preds = await fastify.db.prediction.findMany({
      where: { userId: request.user.id, pointsTotal: { not: null } },
      select: { pointsBase: true, pointsBonus: true, pointsTotal: true },
    });
    const totalPoints = preds.reduce((s, p) => s + (p.pointsTotal || 0), 0);
    const exactos     = preds.filter(p => p.pointsBase === 10).length;
    const bonusTotal  = preds.reduce((s, p) => s + (p.pointsBonus || 0), 0);
    return { totalPoints, exactos, bonusTotal, partidos: preds.length };
  });
}

module.exports = rankingsRoutes;

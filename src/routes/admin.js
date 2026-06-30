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

    const match = await fastify.db.match.update({
      where: { id },
      data: { resultA, resultB, status: 'FINISHED' },
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

  // POST /api/admin/fix-r32-data — corregir venues, fechas y equipos R32 en producción
  fastify.post('/fix-r32-data', { preHandler: fastify.adminOnly }, async () => {
    const db = fastify.db;
    const updates = [
      { id:'R32-M1',  date:new Date('2026-06-30T21:00:00Z'), venue:'MetLife Stadium, Nueva York',         city:'Nueva York',       teamAName:'Francia',         teamAFlag:'🇫🇷', teamACode:'FRA', teamBName:'Suecia',        teamBFlag:'🇸🇪', teamBCode:'SWE' },
      { id:'R32-M2',  date:new Date('2026-06-30T17:00:00Z'), venue:'AT&T Stadium, Dallas',                city:'Dallas',           teamAName:'Costa de Marfil', teamAFlag:'🇨🇮', teamACode:'CIV', teamBName:'Noruega',       teamBFlag:'🇳🇴', teamBCode:'NOR' },
      { id:'R32-M3',  date:new Date('2026-07-02T19:00:00Z'), venue:'SoFi Stadium, Los Ángeles',          city:'Los Ángeles',      teamAName:'España',          teamAFlag:'🇪🇸', teamACode:'ESP', teamBName:'Austria',       teamBFlag:'🇦🇹', teamBCode:'AUT' },
      { id:'R32-M4',  date:new Date('2026-06-29T17:00:00Z'), venue:'NRG Stadium, Houston',               city:'Houston',          teamAName:'Brasil',          teamAFlag:'🇧🇷', teamACode:'BRA', teamBName:'Japón',         teamBFlag:'🇯🇵', teamBCode:'JPN' },
      { id:'R32-M5',  date:new Date('2026-07-04T01:30:00Z'), venue:'Arrowhead Stadium, Kansas City',     city:'Kansas City',      teamAName:'Colombia',        teamAFlag:'🇨🇴', teamACode:'COL', teamBName:'Ghana',         teamBFlag:'🇬🇭', teamBCode:'GHA' },
      { id:'R32-M6',  date:new Date('2026-07-03T22:00:00Z'), venue:'Hard Rock Stadium, Miami',           city:'Miami',            teamAName:'Argentina',       teamAFlag:'🇦🇷', teamACode:'ARG', teamBName:'Cabo Verde',    teamBFlag:'🇨🇻', teamBCode:'CPV', argentina:true  },
      { id:'R32-M7',  date:new Date('2026-07-03T03:00:00Z'), venue:'BC Place, Vancouver',                city:'Vancouver',        teamAName:'Suiza',           teamAFlag:'🇨🇭', teamACode:'SUI', teamBName:'Argelia',       teamBFlag:'🇩🇿', teamBCode:'ALG' },
      { id:'R32-M8',  date:new Date('2026-07-02T23:00:00Z'), venue:'BMO Field, Toronto',                 city:'Toronto',          teamAName:'Portugal',        teamAFlag:'🇵🇹', teamACode:'POR', teamBName:'Croacia',       teamBFlag:'🇭🇷', teamBCode:'CRO' },
      { id:'R32-M9',  date:new Date('2026-06-29T20:30:00Z'), venue:'Gillette Stadium, Boston',           city:'Boston',           teamAName:'Alemania',        teamAFlag:'🇩🇪', teamACode:'GER', teamBName:'Paraguay',      teamBFlag:'🇵🇾', teamBCode:'PAR' },
      { id:'R32-M10', date:new Date('2026-07-01T16:00:00Z'), venue:'Mercedes-Benz Stadium, Atlanta',    city:'Atlanta',          teamAName:'Inglaterra',      teamAFlag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', teamACode:'ENG', teamBName:'R.D. Congo',    teamBFlag:'🇨🇩', teamBCode:'COD' },
      { id:'R32-M11', date:new Date('2026-07-01T20:00:00Z'), venue:'Lumen Field, Seattle',              city:'Seattle',          teamAName:'Bélgica',         teamAFlag:'🇧🇪', teamACode:'BEL', teamBName:'Senegal',       teamBFlag:'🇸🇳', teamBCode:'SEN' },
      { id:'R32-M12', date:new Date('2026-07-03T18:00:00Z'), venue:'AT&T Stadium, Dallas',              city:'Dallas',           teamAName:'Australia',       teamAFlag:'🇦🇺', teamACode:'AUS', teamBName:'Egipto',        teamBFlag:'🇪🇬', teamBCode:'EGY' },
      { id:'R32-M13', date:new Date('2026-06-28T19:00:00Z'), venue:'SoFi Stadium, Los Ángeles',        city:'Los Ángeles',      teamAName:'Canadá',          teamAFlag:'🇨🇦', teamACode:'CAN', teamBName:'Sudáfrica',     teamBFlag:'🇿🇦', teamBCode:'RSA' },
      { id:'R32-M14', date:new Date('2026-07-02T00:00:00Z'), venue:"Levi's Stadium, San Francisco",    city:'San Francisco',    teamAName:'EE.UU.',          teamAFlag:'🇺🇸', teamACode:'USA', teamBName:'Bosnia',        teamBFlag:'🇧🇦', teamBCode:'BIH' },
      { id:'R32-M15', date:new Date('2026-07-01T01:00:00Z'), venue:'Estadio Banorte, Ciudad de México', city:'Ciudad de México', teamAName:'México',          teamAFlag:'🇲🇽', teamACode:'MEX', teamBName:'Ecuador',       teamBFlag:'🇪🇨', teamBCode:'ECU', argentina:false },
      { id:'R32-M16', date:new Date('2026-06-30T01:00:00Z'), venue:'Estadio BBVA, Monterrey',           city:'Monterrey',        teamAName:'Países Bajos',    teamAFlag:'🇳🇱', teamACode:'NED', teamBName:'Marruecos',     teamBFlag:'🇲🇦', teamBCode:'MAR' },
    ];
    const now = new Date();
    const results = [];
    for (const { id, ...data } of updates) {
      // Si la fecha real es futura y el partido está LIVE por un seed incorrecto, resetear a UPCOMING.
      // Si ya pasó (partido jugado o en curso), dejar el status actual para que el sync lo resuelva.
      const isFuture = data.date > now;
      if (isFuture) {
        await db.$executeRawUnsafe(
          'UPDATE matches SET date=$1, venue=$2, city=$3, "teamAName"=$4, "teamAFlag"=$5, "teamACode"=$6, "teamBName"=$7, "teamBFlag"=$8, "teamBCode"=$9, argentina=$10, status=\'UPCOMING\'::"MatchStatus" WHERE id=$11',
          data.date, data.venue, data.city, data.teamAName, data.teamAFlag, data.teamACode, data.teamBName, data.teamBFlag, data.teamBCode, data.argentina ?? false, id
        );
      } else {
        await db.$executeRawUnsafe(
          'UPDATE matches SET date=$1, venue=$2, city=$3, "teamAName"=$4, "teamAFlag"=$5, "teamACode"=$6, "teamBName"=$7, "teamBFlag"=$8, "teamBCode"=$9, argentina=$10 WHERE id=$11',
          data.date, data.venue, data.city, data.teamAName, data.teamAFlag, data.teamACode, data.teamBName, data.teamBFlag, data.teamBCode, data.argentina ?? false, id
        );
      }
      results.push({ id, status: isFuture ? 'reset→UPCOMING' : 'kept' });
    }
    return { success: true, updated: results };
  });
}

module.exports = adminRoutes;

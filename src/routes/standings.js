'use strict';
const { R32_BRACKET, computeGroupStandings } = require('../services/AdvancementService');

async function standingsRoutes(fastify) {

  // GET /api/standings/bracket — bracket proyectado con nivel de confianza por slot
  fastify.get('/bracket', async (request) => {
    const { phase = 'DIECISEISAVOS' } = request.query;
    const { R32_BRACKET, KNOCKOUT_FEEDS } = require('../services/AdvancementService');

    let targetBracket = [];
    if (phase === 'DIECISEISAVOS') {
      targetBracket = R32_BRACKET;
    } else {
      for (const [id, feeds] of Object.entries(KNOCKOUT_FEEDS)) {
        let p;
        if (id.startsWith('R16')) p = 'OCTAVOS';
        else if (id.startsWith('QF')) p = 'CUARTOS';
        else if (id.startsWith('SF')) p = 'SEMIFINAL';
        else if (id.startsWith('FINAL') || id.startsWith('TP')) p = 'FINAL';
        
        if (p === phase) {
          targetBracket.push({ id, sideA: feeds.sideA, sideB: feeds.sideB });
        }
      }
    }

    const groupStandings = await computeGroupStandings(fastify.db);

    const allGroupMatches = await fastify.db.match.findMany({
      where: { phase: 'GRUPOS' },
      select: { groupName: true, status: true },
    });

    const groupCounts = {};
    for (const m of allGroupMatches) {
      const g = m.groupName;
      if (!groupCounts[g]) groupCounts[g] = { total: 0, finished: 0 };
      groupCounts[g].total++;
      if (m.status === 'FINISHED') groupCounts[g].finished++;
    }

    const isGroupComplete = (g) => {
      const c = groupCounts[g];
      return c && c.total > 0 && c.total === c.finished;
    };

    // Obtener partidos reales de la fase solicitada
    const dbMatches = await fastify.db.match.findMany({
      where: { phase },
      select: { id: true, status: true, teamAName: true, teamAFlag: true, teamBName: true, teamBFlag: true, resultA: true, resultB: true, penaltyA: true, penaltyB: true },
    });
    const matchByIdMap = Object.fromEntries(dbMatches.map(m => [m.id, m]));

    const resolveTeam = (slot) => {
      if (slot.group) {
        const g = groupStandings[slot.group] || [];
        const idx = slot.type === 'winner' ? 0 : slot.type === 'runner' ? 1 : 2;
        return g[idx] || null;
      }
      return null; // For knockouts, teams are resolved from the DB matching actual progression
    };

    const getConfidence = (slot) => {
      if (slot.group) {
        const c = groupCounts[slot.group];
        if (!c || c.finished === 0) return 'PENDING';
        return isGroupComplete(slot.group) ? 'CONFIRMED' : 'TENTATIVE';
      }
      return 'CONFIRMED';
    };

    const MATCH_LABEL = {};
    for (let i = 1; i <= 16; i++) MATCH_LABEL[`R32-M${i}`]  = `P${i} Dieciseisavos`;
    for (let i = 1; i <= 8;  i++) MATCH_LABEL[`R16-M${i}`]  = `P${i} Octavos`;
    for (let i = 1; i <= 4;  i++) MATCH_LABEL[`QF-M${i}`]   = `P${i} Cuartos`;
    for (let i = 1; i <= 2;  i++) MATCH_LABEL[`SF-M${i}`]   = `P${i} Semis`;

    const slotLabel = (slot) => {
      if (slot.group) {
        if (slot.type === 'winner') return `1° Grupo ${slot.group}`;
        if (slot.type === 'runner') return `2° Grupo ${slot.group}`;
        if (slot.type === 'third')  return `3° Grupo ${slot.group}`;
      }
      if (slot.winner) {
        return `Ganador ${MATCH_LABEL[slot.winner] || slot.winner}`;
      }
      if (slot.loser) {
        return `Perdedor ${MATCH_LABEL[slot.loser] || slot.loser}`;
      }
      return 'Por definir';
    };

    return targetBracket.map(bracket => {
      const dbMatch = matchByIdMap[bracket.id];
      const teamA = resolveTeam(bracket.sideA);
      const teamB = resolveTeam(bracket.sideB);

      return {
        id:              bracket.id,
        slotLabelA:      slotLabel(bracket.sideA),
        slotLabelB:      slotLabel(bracket.sideB),
        teamAName:       dbMatch?.teamAName || teamA?.name  || null,
        teamAFlag:       dbMatch?.teamAFlag || teamA?.flag  || null,
        teamBName:       dbMatch?.teamBName || teamB?.name  || null,
        teamBFlag:       dbMatch?.teamBFlag || teamB?.flag  || null,
        teamAConfidence: getConfidence(bracket.sideA),
        teamBConfidence: getConfidence(bracket.sideB),
        resultA:         dbMatch?.resultA,
        resultB:         dbMatch?.resultB,
        penaltyA:        dbMatch?.penaltyA,
        penaltyB:        dbMatch?.penaltyB,
        status:          dbMatch?.status || 'UPCOMING',
      };
    });
  });

  // GET /api/standings?phase=GRUPOS — tabla de posiciones de selecciones
  fastify.get('/', async (request) => {
    const { phase = 'GRUPOS' } = request.query;

    const matches = await fastify.db.match.findMany({
      where: { phase: phase.toUpperCase(), status: 'FINISHED' },
      orderBy: { date: 'asc' },
    });

    if (!matches.length) return [];

    // Build team stats map
    const teams = {};

    function ensureTeam(flag, name, group) {
      const key = flag + '|' + name;
      if (!teams[key]) {
        teams[key] = { flag, name, group, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, gd: 0, pts: 0 };
      }
      return teams[key];
    }

    for (const m of matches) {
      if (m.resultA === null || m.resultB === null) continue;
      const { teamAFlag, teamAName, teamBFlag, teamBName, groupName, resultA, resultB } = m;
      const group = groupName || 'Sin Grupo';

      const a = ensureTeam(teamAFlag, teamAName, group);
      const b = ensureTeam(teamBFlag, teamBName, group);

      a.pj++; b.pj++;
      a.gf += resultA; a.gc += resultB;
      b.gf += resultB; b.gc += resultA;

      if (resultA > resultB) {
        a.pg++; a.pts += 3;
        b.pp++;
      } else if (resultA < resultB) {
        b.pg++; b.pts += 3;
        a.pp++;
      } else {
        a.pe++; a.pts += 1;
        b.pe++; b.pts += 1;
      }

      a.gd = a.gf - a.gc;
      b.gd = b.gf - b.gc;
    }

    // Group by group name
    const groupsMap = {};
    for (const t of Object.values(teams)) {
      if (!groupsMap[t.group]) groupsMap[t.group] = [];
      groupsMap[t.group].push(t);
    }

    // Sort each group: pts desc, gd desc, gf desc, name asc
    for (const g of Object.values(groupsMap)) {
      g.sort((a, b) =>
        b.pts - a.pts ||
        b.gd  - a.gd  ||
        b.gf  - a.gf  ||
        a.name.localeCompare(b.name)
      );
    }

    // Return sorted groups
    return Object.entries(groupsMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([group, teams]) => ({ group, teams }));
  });
}

module.exports = standingsRoutes;

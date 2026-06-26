'use strict';
const { R32_BRACKET, computeGroupStandings, computeThirdAssignments } = require('../services/AdvancementService');

async function standingsRoutes(fastify) {

  // GET /api/standings/bracket — bracket proyectado del R32 con nivel de confianza por slot
  fastify.get('/bracket', async () => {
    const groupStandings = await computeGroupStandings(fastify.db);

    // Contar partidos totales vs terminados por grupo
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
    const allGroupsComplete = Object.values(groupCounts).every(c => c.total === c.finished);

    // Asignación de terceros (greedy por grupos elegibles)
    const thirdAssignments = computeThirdAssignments(groupStandings, allGroupsComplete);

    const resolveTeam = (bracket, sideKey) => {
      const slot = bracket[sideKey];
      if (slot.type === 'winner') return (groupStandings[slot.group] || [])[0] || null;
      if (slot.type === 'runner') return (groupStandings[slot.group] || [])[1] || null;
      if (slot.type === 'third')  return thirdAssignments[`${bracket.id}_${sideKey}`] || null;
      return null;
    };

    const getConfidence = (bracket, sideKey) => {
      const slot = bracket[sideKey];
      if (slot.type === 'winner' || slot.type === 'runner') {
        const c = groupCounts[slot.group];
        if (!c || c.finished === 0) return 'PENDING';
        return isGroupComplete(slot.group) ? 'CONFIRMED' : 'TENTATIVE';
      }
      if (slot.type === 'third') {
        // TENTATIVO si al menos un grupo elegible terminó, CONFIRMADO si todos los grupos terminaron
        const anyEligibleFinished = slot.eligibleGroups.some(g => isGroupComplete(g));
        if (!anyEligibleFinished) return 'PENDING';
        return allGroupsComplete ? 'CONFIRMED' : 'TENTATIVE';
      }
      return 'PENDING';
    };

    const slotLabel = (slot) => {
      if (slot.type === 'winner') return `1° Grupo ${slot.group}`;
      if (slot.type === 'runner') return `2° Grupo ${slot.group}`;
      if (slot.type === 'third')  return `Mejor 3° (${slot.eligibleGroups.join('/')})`;
      return 'Por definir';
    };

    return R32_BRACKET.map(bracket => {
      const teamA = resolveTeam(bracket, 'sideA');
      const teamB = resolveTeam(bracket, 'sideB');
      return {
        id:              bracket.id,
        slotLabelA:      slotLabel(bracket.sideA),
        slotLabelB:      slotLabel(bracket.sideB),
        teamAName:       teamA?.name  || null,
        teamAFlag:       teamA?.flag  || null,
        teamBName:       teamB?.name  || null,
        teamBFlag:       teamB?.flag  || null,
        teamAConfidence: getConfidence(bracket, 'sideA'),
        teamBConfidence: getConfidence(bracket, 'sideB'),
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

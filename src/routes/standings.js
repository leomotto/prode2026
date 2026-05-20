'use strict';

async function standingsRoutes(fastify) {

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

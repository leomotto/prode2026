'use strict';

// FIFA 2026 — Bracket oficial Dieciseisavos de Final (Ronda de 32)
// Fuente: Al Jazeera + NZ Herald (verificado con API api-football, jun-2026)
// Confirmados con equipos reales: ARG=1J, CPV=2H (Miami/M6); NED=1F, MAR=3C (Monterrey/M16)
const R32_BRACKET = [
  { id: 'R32-M1',  sideA: { type: 'winner', group: 'I' }, sideB: { type: 'third',  group: 'F' } },  // 1I vs 3F  (Francia vs Suecia)
  { id: 'R32-M2',  sideA: { type: 'runner', group: 'E' }, sideB: { type: 'runner', group: 'I' } },  // 2E vs 2I  (Costa de Marfil vs Noruega)
  { id: 'R32-M3',  sideA: { type: 'winner', group: 'H' }, sideB: { type: 'runner', group: 'J' } },  // 1H vs 2J  (España vs Austria)
  { id: 'R32-M4',  sideA: { type: 'winner', group: 'C' }, sideB: { type: 'runner', group: 'F' } },  // 1C vs 2F  (Brasil vs Japón)
  { id: 'R32-M5',  sideA: { type: 'winner', group: 'K' }, sideB: { type: 'third',  group: 'L' } },  // 1K vs 3L  (Colombia vs Ghana)
  { id: 'R32-M6',  sideA: { type: 'winner', group: 'J' }, sideB: { type: 'runner', group: 'H' } },  // 1J vs 2H  (Argentina vs Cabo Verde)
  { id: 'R32-M7',  sideA: { type: 'winner', group: 'B' }, sideB: { type: 'third',  group: 'J' } },  // 1B vs 3J  (Suiza vs Argelia)
  { id: 'R32-M8',  sideA: { type: 'runner', group: 'K' }, sideB: { type: 'runner', group: 'L' } },  // 2K vs 2L  (Portugal vs Croacia)
  { id: 'R32-M9',  sideA: { type: 'winner', group: 'E' }, sideB: { type: 'third',  group: 'D' } },  // 1E vs 3D  (Alemania vs Paraguay)
  { id: 'R32-M10', sideA: { type: 'winner', group: 'L' }, sideB: { type: 'third',  group: 'K' } },  // 1L vs 3K  (Inglaterra vs R.D. Congo)
  { id: 'R32-M11', sideA: { type: 'winner', group: 'G' }, sideB: { type: 'third',  group: 'I' } },  // 1G vs 3I  (Bélgica vs Senegal)
  { id: 'R32-M12', sideA: { type: 'runner', group: 'D' }, sideB: { type: 'runner', group: 'G' } },  // 2D vs 2G  (Australia vs Egipto)
  { id: 'R32-M13', sideA: { type: 'runner', group: 'A' }, sideB: { type: 'runner', group: 'B' } },  // 2A vs 2B  (Sudáfrica vs Canadá)
  { id: 'R32-M14', sideA: { type: 'winner', group: 'D' }, sideB: { type: 'third',  group: 'B' } },  // 1D vs 3B  (EE.UU. vs Bosnia)
  { id: 'R32-M15', sideA: { type: 'winner', group: 'A' }, sideB: { type: 'third',  group: 'E' } },  // 1A vs 3E  (México vs Ecuador)
  { id: 'R32-M16', sideA: { type: 'winner', group: 'F' }, sideB: { type: 'runner', group: 'C' } },  // 1F vs 2C  (Países Bajos vs Marruecos)
];

// Cascada knockout: define qué partido terminado alimenta cada slot del siguiente round
const KNOCKOUT_FEEDS = {
  'R16-M1':   { sideA: { winner: 'R32-M13' }, sideB: { winner: 'R32-M16' } },
  'R16-M2':   { sideA: { winner: 'R32-M9'  }, sideB: { winner: 'R32-M1'  } },
  'R16-M3':   { sideA: { winner: 'R32-M3'  }, sideB: { winner: 'R32-M8'  } },
  'R16-M4':   { sideA: { winner: 'R32-M11' }, sideB: { winner: 'R32-M14' } },
  'R16-M5':   { sideA: { winner: 'R32-M4'  }, sideB: { winner: 'R32-M2'  } },
  'R16-M6':   { sideA: { winner: 'R32-M15' }, sideB: { winner: 'R32-M10' } },
  'R16-M7':   { sideA: { winner: 'R32-M12' }, sideB: { winner: 'R32-M5'  } }, // Ganador 86 (Australia) vs Ganador 88 (Colombia)
  'R16-M8':   { sideA: { winner: 'R32-M7'  }, sideB: { winner: 'R32-M6'  } }, // Ganador 85 (Suiza) vs Ganador 87 (Argentina)
  'QF-M1':    { sideA: { winner: 'R16-M1'  }, sideB: { winner: 'R16-M2'  } },
  'QF-M2':    { sideA: { winner: 'R16-M3'  }, sideB: { winner: 'R16-M4'  } },
  'QF-M3':    { sideA: { winner: 'R16-M5'  }, sideB: { winner: 'R16-M6'  } },
  'QF-M4':    { sideA: { winner: 'R16-M7'  }, sideB: { winner: 'R16-M8'  } },
  'SF-M1':    { sideA: { winner: 'QF-M1'   }, sideB: { winner: 'QF-M2'   } },
  'SF-M2':    { sideA: { winner: 'QF-M3'   }, sideB: { winner: 'QF-M4'   } },
  'TP-M1':    { sideA: { loser:  'SF-M1'   }, sideB: { loser:  'SF-M2'   } },
  'FINAL-M1': { sideA: { winner: 'SF-M1'   }, sideB: { winner: 'SF-M2'   } },
};

async function computeGroupStandings(db) {
  const matches = await db.match.findMany({
    where: { phase: 'GRUPOS', status: 'FINISHED' },
  });

  const groups = {};

  for (const m of matches) {
    if (m.resultA === null || m.resultB === null) continue;
    const g = m.groupName;
    if (!groups[g]) groups[g] = {};

    const ensure = (flag, name) => {
      if (!groups[g][name]) {
        groups[g][name] = { flag, name, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, gd: 0, pts: 0 };
      }
      return groups[g][name];
    };

    const a = ensure(m.teamAFlag, m.teamAName);
    const b = ensure(m.teamBFlag, m.teamBName);
    a.pj++; b.pj++;
    a.gf += m.resultA; a.gc += m.resultB;
    b.gf += m.resultB; b.gc += m.resultA;
    if (m.resultA > m.resultB) { a.pg++; a.pts += 3; b.pp++; }
    else if (m.resultA < m.resultB) { b.pg++; b.pts += 3; a.pp++; }
    else { a.pe++; a.pts++; b.pe++; b.pts++; }
    a.gd = a.gf - a.gc;
    b.gd = b.gf - b.gc;
  }

  const sorted = {};
  for (const [g, teamMap] of Object.entries(groups)) {
    sorted[g] = Object.values(teamMap).sort((a, b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name)
    );
  }
  return sorted;
}

function computeBestThirds(groupStandings) {
  const thirds = [];
  for (const [group, teams] of Object.entries(groupStandings)) {
    if (teams.length >= 3 && teams[2].pj > 0) {
      thirds.push({ ...teams[2], group });
    }
  }
  thirds.sort((a, b) =>
    b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name)
  );
  return thirds;
}

async function advanceGroupsToR32(db) {
  const groupStandings = await computeGroupStandings(db);

  const allGroupMatches = await db.match.findMany({
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

  // Cada slot tiene un grupo fijo. El tipo determina la posición: winner=1°, runner=2°, third=3°.
  // Para terceros, el grupo está predeterminado en el bracket (no hay selección de "mejores 8").
  const resolveSlot = (bracket, sideKey) => {
    const slot = bracket[sideKey];
    if (!isGroupComplete(slot.group)) return null;
    const g = groupStandings[slot.group] || [];
    const idx = slot.type === 'winner' ? 0 : slot.type === 'runner' ? 1 : 2;
    return g[idx] ? { name: g[idx].name, flag: g[idx].flag } : null;
  };

  // Obtener partidos R32 ya FINISHED para no pisar sus equipos reales
  const finishedR32 = new Set(
    (await db.match.findMany({
      where: { phase: 'DIECISEISAVOS', status: 'FINISHED' },
      select: { id: true },
    })).map(m => m.id)
  );

  const ops = [];
  for (const bracket of R32_BRACKET) {
    // No sobreescribir equipos de partidos ya jugados: sus teamNames son los reales
    if (finishedR32.has(bracket.id)) continue;

    const teamA = resolveSlot(bracket, 'sideA');
    const teamB = resolveSlot(bracket, 'sideB');
    ops.push(db.match.update({
      where: { id: bracket.id },
      data: {
        teamAName: teamA?.name ?? null,
        teamAFlag: teamA?.flag ?? null,
        teamBName: teamB?.name ?? null,
        teamBFlag: teamB?.flag ?? null,
        argentina: teamA?.name === 'Argentina' || teamB?.name === 'Argentina',
      },
    }));
  }

  if (ops.length) await Promise.all(ops);
  return { updatedR32: ops.length, groupStandings };
}

async function advanceKnockoutMatch(db, finishedMatchId) {
  const match = await db.match.findUnique({ where: { id: finishedMatchId } });
  if (!match || match.resultA === null || match.resultB === null) return null;

  // Determinar ganador considerando penales.
  // En un partido que va a penales resultA === resultB (goles en 90+ET).
  // El ganador se determina por penaltyA/penaltyB almacenados por SyncService.
  let scoreA = match.resultA;
  let scoreB = match.resultB;
  if (scoreA === scoreB) {
    if (match.penaltyA !== null && match.penaltyB !== null) {
      // Usar marcador de penales para desempatar
      scoreA = match.penaltyA;
      scoreB = match.penaltyB;
    } else {
      // Sin datos de penales: no se puede determinar ganador aún
      return null;
    }
  }
  if (scoreA === scoreB) return null; // empate en penales (no debería ocurrir)

  const winner = scoreA > scoreB
    ? { name: match.teamAName, flag: match.teamAFlag }
    : { name: match.teamBName, flag: match.teamBFlag };
  const loser = scoreA > scoreB
    ? { name: match.teamBName, flag: match.teamBFlag }
    : { name: match.teamAName, flag: match.teamAFlag };

  const ops = [];
  for (const [nextId, feeds] of Object.entries(KNOCKOUT_FEEDS)) {
    const data = {};
    if (feeds.sideA.winner === finishedMatchId) { data.teamAName = winner.name; data.teamAFlag = winner.flag; }
    if (feeds.sideA.loser  === finishedMatchId) { data.teamAName = loser.name;  data.teamAFlag = loser.flag;  }
    if (feeds.sideB.winner === finishedMatchId) { data.teamBName = winner.name; data.teamBFlag = winner.flag; }
    if (feeds.sideB.loser  === finishedMatchId) { data.teamBName = loser.name;  data.teamBFlag = loser.flag;  }

    if (Object.keys(data).length > 0) {
      const nextMatch = await db.match.findUnique({ where: { id: nextId } });
      const currentA = data.teamAName || (nextMatch && nextMatch.teamAName) || '';
      const currentB = data.teamBName || (nextMatch && nextMatch.teamBName) || '';
      data.argentina = currentA === 'Argentina' || currentB === 'Argentina';
      ops.push(db.match.update({ where: { id: nextId }, data }));
    }
  }

  await Promise.all(ops);
  return { winner, loser, updatedMatches: ops.length };
}

async function runFullAdvancement(db) {
  const r32Result = await advanceGroupsToR32(db);

  const knockoutMatches = await db.match.findMany({
    where: {
      phase: { in: ['DIECISEISAVOS', 'OCTAVOS', 'CUARTOS', 'SEMIFINAL'] },
      status: 'FINISHED',
    },
    orderBy: { date: 'asc' },
  });

  let cascadeCount = 0;
  for (const m of knockoutMatches) {
    const result = await advanceKnockoutMatch(db, m.id);
    if (result) cascadeCount += result.updatedMatches;
  }

  return { ...r32Result, cascadeUpdates: cascadeCount };
}

module.exports = {
  R32_BRACKET,
  KNOCKOUT_FEEDS,
  advanceGroupsToR32,
  advanceKnockoutMatch,
  runFullAdvancement,
  computeGroupStandings,
  computeBestThirds,
};

'use strict';

// FIFA 2026 — Bracket oficial Dieciseisavos de Final (Ronda de 32)
// Fuente: estructura oficial FIFA 2026
const R32_BRACKET = [
  // ── Lado A — Bloque Superior ──────────────────────────────────
  { id: 'R32-M1',  sideA: { type: 'winner', group: 'E' }, sideB: { type: 'third', eligibleGroups: ['A','B','C','D','F'] } },
  { id: 'R32-M2',  sideA: { type: 'winner', group: 'I' }, sideB: { type: 'third', eligibleGroups: ['C','D','F','G','H'] } },
  { id: 'R32-M3',  sideA: { type: 'runner', group: 'A' }, sideB: { type: 'runner', group: 'B' } },
  { id: 'R32-M4',  sideA: { type: 'winner', group: 'F' }, sideB: { type: 'runner', group: 'C' } },
  // ── Lado A — Bloque Inferior ──────────────────────────────────
  { id: 'R32-M5',  sideA: { type: 'runner', group: 'K' }, sideB: { type: 'runner', group: 'L' } },
  { id: 'R32-M6',  sideA: { type: 'winner', group: 'H' }, sideB: { type: 'runner', group: 'J' } },
  { id: 'R32-M7',  sideA: { type: 'winner', group: 'D' }, sideB: { type: 'third', eligibleGroups: ['B','E','F','I','J'] } },
  { id: 'R32-M8',  sideA: { type: 'winner', group: 'G' }, sideB: { type: 'third', eligibleGroups: ['A','E','H','I','J'] } },
  // ── Lado B — Bloque Superior ──────────────────────────────────
  { id: 'R32-M9',  sideA: { type: 'winner', group: 'C' }, sideB: { type: 'runner', group: 'F' } },
  { id: 'R32-M10', sideA: { type: 'runner', group: 'E' }, sideB: { type: 'runner', group: 'I' } },
  { id: 'R32-M11', sideA: { type: 'winner', group: 'A' }, sideB: { type: 'third', eligibleGroups: ['C','E','F','H','I'] } },
  { id: 'R32-M12', sideA: { type: 'winner', group: 'L' }, sideB: { type: 'third', eligibleGroups: ['E','H','I','J','K'] } },
  // ── Lado B — Bloque Inferior ──────────────────────────────────
  { id: 'R32-M13', sideA: { type: 'winner', group: 'J' }, sideB: { type: 'runner', group: 'H' } },
  { id: 'R32-M14', sideA: { type: 'runner', group: 'D' }, sideB: { type: 'runner', group: 'G' } },
  { id: 'R32-M15', sideA: { type: 'winner', group: 'B' }, sideB: { type: 'third', eligibleGroups: ['E','F','G','I','J'] } },
  { id: 'R32-M16', sideA: { type: 'winner', group: 'K' }, sideB: { type: 'third', eligibleGroups: ['D','E','I','J','L'] } },
];

// Cascada knockout: define qué partido terminado alimenta cada slot del siguiente round
const KNOCKOUT_FEEDS = {
  'R16-M1':   { sideA: { winner: 'R32-M1'  }, sideB: { winner: 'R32-M2'  } },
  'R16-M2':   { sideA: { winner: 'R32-M3'  }, sideB: { winner: 'R32-M4'  } },
  'R16-M3':   { sideA: { winner: 'R32-M5'  }, sideB: { winner: 'R32-M6'  } },
  'R16-M4':   { sideA: { winner: 'R32-M7'  }, sideB: { winner: 'R32-M8'  } },
  'R16-M5':   { sideA: { winner: 'R32-M9'  }, sideB: { winner: 'R32-M10' } },
  'R16-M6':   { sideA: { winner: 'R32-M11' }, sideB: { winner: 'R32-M12' } },
  'R16-M7':   { sideA: { winner: 'R32-M13' }, sideB: { winner: 'R32-M14' } },
  'R16-M8':   { sideA: { winner: 'R32-M15' }, sideB: { winner: 'R32-M16' } },
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

// Asigna las 8 mejores terceras plazas a los slots con eligibleGroups
// usando un algoritmo greedy: en orden del bracket, asigna el mejor tercero disponible
// de los grupos elegibles para ese slot.
// Solo funciona cuando todos los grupos están completos (la asignación es definitiva).
function computeThirdAssignments(groupStandings, allGroupsComplete) {
  if (!allGroupsComplete) return {};

  const allThirds = computeBestThirds(groupStandings);
  const usedGroups = new Set();
  const assignments = {};

  for (const bracket of R32_BRACKET) {
    for (const sideKey of ['sideA', 'sideB']) {
      const slot = bracket[sideKey];
      if (slot.type === 'third') {
        const pick = allThirds.find(t => slot.eligibleGroups.includes(t.group) && !usedGroups.has(t.group));
        if (pick) {
          assignments[`${bracket.id}_${sideKey}`] = pick;
          usedGroups.add(pick.group);
        }
      }
    }
  }
  return assignments;
}

async function advanceGroupsToR32(db) {
  const groupStandings = await computeGroupStandings(db);

  // Determinar qué grupos están 100% finalizados
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
  const allGroupsComplete = Object.values(groupCounts).every(c => c.total === c.finished);

  // Asignación de terceros (solo cuando todos los grupos terminaron)
  const thirdAssignments = computeThirdAssignments(groupStandings, allGroupsComplete);

  const resolveSlot = (bracket, sideKey) => {
    const slot = bracket[sideKey];
    if (slot.type === 'winner') {
      return isGroupComplete(slot.group) ? ((groupStandings[slot.group] || [])[0] || null) : null;
    }
    if (slot.type === 'runner') {
      return isGroupComplete(slot.group) ? ((groupStandings[slot.group] || [])[1] || null) : null;
    }
    if (slot.type === 'third') {
      return thirdAssignments[`${bracket.id}_${sideKey}`] || null;
    }
    return null;
  };

  const ops = [];
  for (const bracket of R32_BRACKET) {
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

  await Promise.all(ops);
  return { updatedR32: ops.length, groupStandings };
}

async function advanceKnockoutMatch(db, finishedMatchId) {
  const match = await db.match.findUnique({ where: { id: finishedMatchId } });
  if (!match || match.resultA === null || match.resultB === null) return null;
  if (match.resultA === match.resultB) return null;

  const winner = match.resultA > match.resultB
    ? { name: match.teamAName, flag: match.teamAFlag }
    : { name: match.teamBName, flag: match.teamBFlag };
  const loser = match.resultA > match.resultB
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
  advanceGroupsToR32,
  advanceKnockoutMatch,
  runFullAdvancement,
  computeGroupStandings,
  computeBestThirds,
  computeThirdAssignments,
};

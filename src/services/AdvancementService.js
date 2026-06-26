'use strict';

// FIFA 2026 Round of 32 bracket
// Each slot maps a group position to a specific R32 match side
const R32_BRACKET = [
  { id: 'R32-M1',  sideA: { type: 'winner', group: 'A' }, sideB: { type: 'runner', group: 'B' } },
  { id: 'R32-M2',  sideA: { type: 'winner', group: 'C' }, sideB: { type: 'runner', group: 'D' } },
  { id: 'R32-M3',  sideA: { type: 'winner', group: 'E' }, sideB: { type: 'runner', group: 'F' } },
  { id: 'R32-M4',  sideA: { type: 'winner', group: 'G' }, sideB: { type: 'runner', group: 'H' } },
  { id: 'R32-M5',  sideA: { type: 'winner', group: 'B' }, sideB: { type: 'runner', group: 'A' } },
  { id: 'R32-M6',  sideA: { type: 'winner', group: 'D' }, sideB: { type: 'runner', group: 'C' } },
  { id: 'R32-M7',  sideA: { type: 'winner', group: 'F' }, sideB: { type: 'runner', group: 'E' } },
  { id: 'R32-M8',  sideA: { type: 'winner', group: 'H' }, sideB: { type: 'runner', group: 'G' } },
  { id: 'R32-M9',  sideA: { type: 'winner', group: 'I' }, sideB: { type: 'runner', group: 'J' } },
  { id: 'R32-M10', sideA: { type: 'winner', group: 'K' }, sideB: { type: 'runner', group: 'L' } },
  { id: 'R32-M11', sideA: { type: 'winner', group: 'J' }, sideB: { type: 'runner', group: 'I' } },
  { id: 'R32-M12', sideA: { type: 'winner', group: 'L' }, sideB: { type: 'runner', group: 'K' } },
  { id: 'R32-M13', sideA: { type: 'third', rank: 1 }, sideB: { type: 'third', rank: 2 } },
  { id: 'R32-M14', sideA: { type: 'third', rank: 3 }, sideB: { type: 'third', rank: 4 } },
  { id: 'R32-M15', sideA: { type: 'third', rank: 5 }, sideB: { type: 'third', rank: 6 } },
  { id: 'R32-M16', sideA: { type: 'third', rank: 7 }, sideB: { type: 'third', rank: 8 } },
];

// Knockout cascade: defines which finished match feeds each slot of the next round
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
  return thirds.slice(0, 8);
}

function resolveR32Slot(slot, groupStandings, bestThirds) {
  if (slot.type === 'winner') return (groupStandings[slot.group] || [])[0] || null;
  if (slot.type === 'runner') return (groupStandings[slot.group] || [])[1] || null;
  if (slot.type === 'third')  return bestThirds[slot.rank - 1] || null;
  return null;
}

async function advanceGroupsToR32(db) {
  const groupStandings = await computeGroupStandings(db);
  const bestThirds = computeBestThirds(groupStandings);

  const ops = [];
  for (const bracket of R32_BRACKET) {
    const teamA = resolveR32Slot(bracket.sideA, groupStandings, bestThirds);
    const teamB = resolveR32Slot(bracket.sideB, groupStandings, bestThirds);
    const data = {};
    if (teamA) { data.teamAName = teamA.name; data.teamAFlag = teamA.flag; }
    if (teamB) { data.teamBName = teamB.name; data.teamBFlag = teamB.flag; }
    if (teamA || teamB) {
      const isArg = (teamA && teamA.name === 'Argentina') || (teamB && teamB.name === 'Argentina');
      data.argentina = isArg;
      ops.push(db.match.update({ where: { id: bracket.id }, data }));
    }
  }

  await Promise.all(ops);
  return { updatedR32: ops.length, groupStandings, bestThirds };
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

module.exports = { R32_BRACKET, advanceGroupsToR32, advanceKnockoutMatch, runFullAdvancement, computeGroupStandings, computeBestThirds };

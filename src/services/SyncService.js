'use strict';

const TEAM_EN = {
  'ALEMANIA':'GERMANY','ARABIA SAUDITA':'SAUDI ARABIA','ARGELIA':'ALGERIA',
  'BÉLGICA':'BELGIUM','BOSNIA':'BOSNIA','BRASIL':'BRAZIL',
  'CABO VERDE':'CAPE VERDE','CANADÁ':'CANADA','CHEQUIA':'CZECH REPUBLIC',
  'COREA DEL SUR':'SOUTH KOREA','COSTA DE MARFIL':'IVORY COAST',
  'CURAZAO':'CURAÇAO','EGIPTO':'EGYPT','EE.UU.':'USA',
  'ESCOCIA':'SCOTLAND','ESPAÑA':'SPAIN','FRANCIA':'FRANCE',
  'HAITÍ':'HAITI','INGLATERRA':'ENGLAND','IRÁN':'IRAN',
  'JAPÓN':'JAPAN','JORDANIA':'JORDAN','MARRUECOS':'MOROCCO',
  'MÉXICO':'MEXICO','NORUEGA':'NORWAY','NUEVA ZELANDA':'NEW ZEALAND',
  'PAÍSES BAJOS':'NETHERLANDS','POLONIA':'POLAND',
  'R.D. CONGO':'DR CONGO','SUECIA':'SWEDEN','SUIZA':'SWITZERLAND',
  'SUDÁFRICA':'SOUTH AFRICA','TÚNEZ':'TUNISIA','TURQUÍA':'TÜRKIYE',
  'CROACIA':'CROATIA','UZBEKISTÁN':'UZBEKISTAN','PANAMÁ':'PANAMA',
  'COLOMBIA':'COLOMBIA','PORTUGAL':'PORTUGAL','CONGO':'CONGO',
  'REP. DOMINICANA':'DOMINICAN REPUBLIC',
};
const toEN = (name) => TEAM_EN[name.toUpperCase()] || name.toUpperCase();

/**
 * Fetch fixtures from API-Football for a given UTC date.
 */
async function fetchFixturesByDate(dateStr, apiKey) {
  const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${dateStr}`, {
    headers: {
      'x-rapidapi-host': 'v3.football.api-sports.io',
      'x-apisports-key': apiKey,
    }
  });
  const data = await response.json();
  if (!data.response || (data.errors && Object.keys(data.errors).length)) {
    throw new Error('api-football error: ' + JSON.stringify(data.errors));
  }
  return data.response;
}

/**
 * Sincroniza resultados de partidos LIVE contra la API de api-football.
 *
 * Fix medianoche UTC: agrupa los partidos LIVE por su fecha UTC de inicio
 * y hace una llamada por fecha única. Evita que partidos que empezaron
 * el día anterior y siguen LIVE no sean encontrados cuando la fecha local
 * cambia a medianoche UTC.
 *
 * Fix penales: cuando el status de la API es 'PEN', guarda también
 * penaltyA/penaltyB para que AdvancementService pueda determinar el
 * ganador en bracket aun con resultado empatado tras prórroga.
 *
 * Retorna { updated, finished, noMatch, liveChecked }.
 */
async function runSync(db, apiKey, log) {
  const liveMatches = await db.match.findMany({ where: { status: 'LIVE' } });
  if (!liveMatches.length) return { updated: 0, finished: 0, noMatch: 0, liveChecked: 0 };

  // Agrupar partidos LIVE por la fecha UTC de su inicio programado.
  // Caso normal: todos en la misma fecha → 1 llamada API.
  // Caso medianoche: partido de ayer todavía en curso → 2 llamadas.
  const dateGroups = new Map();
  for (const m of liveMatches) {
    const dateStr = new Date(m.date).toISOString().slice(0, 10);
    if (!dateGroups.has(dateStr)) dateGroups.set(dateStr, []);
    dateGroups.get(dateStr).push(m);
  }

  // Recolectar todos los fixtures en un único array (sin duplicados relevantes)
  const allFixtures = [];
  for (const dateStr of dateGroups.keys()) {
    const fixtures = await fetchFixturesByDate(dateStr, apiKey);
    allFixtures.push(...fixtures);
  }

  const MatchService = require('./MatchService');
  const { advanceGroupsToR32, advanceKnockoutMatch } = require('./AdvancementService');

  let updated = 0, finished = 0, noMatch = 0;

  for (const localMatch of liveMatches) {
    const nameA = toEN(localMatch.teamAName || '');
    const nameB = toEN(localMatch.teamBName || '');
    // Buscar fixture en ambas direcciones: la asignación home/away de la API
    // puede no coincidir con el orden teamA/teamB del DB (p.ej. Uzbekistán
    // figura como local en la API pero como teamB en el DB).
    let apiFixture = null;
    let reversed   = false;
    for (const f of allFixtures) {
      const home = f.teams.home.name.toUpperCase();
      const away = f.teams.away.name.toUpperCase();
      if ((home.includes(nameA) || nameA.includes(home)) && (away.includes(nameB) || nameB.includes(away))) {
        apiFixture = f; reversed = false; break;
      }
      if ((away.includes(nameA) || nameA.includes(away)) && (home.includes(nameB) || nameB.includes(home))) {
        apiFixture = f; reversed = true; break;
      }
    }

    if (!apiFixture) {
      noMatch++;
      if (log) log.warn(`⚠️ Sync: no se encontró fixture para ${localMatch.teamAName} vs ${localMatch.teamBName}`);
      continue;
    }

    const statusShort = apiFixture.fixture.status.short;
    const isFinished  = ['FT', 'AET', 'PEN'].includes(statusShort);

    // Cuando el orden está invertido, swapear goles para que resultA/B
    // correspondan a teamA/teamB del DB respectivamente.
    const goalsRaw  = { home: apiFixture.goals.home, away: apiFixture.goals.away };
    const goalsHome = reversed ? goalsRaw.away : goalsRaw.home;
    const goalsAway = reversed ? goalsRaw.home : goalsRaw.away;

    if (goalsHome === null || goalsAway === null) continue;

    // Cuando el partido termina en penales, guardar los goles de la tanda
    // para que AdvancementService pueda determinar el ganador del bracket.
    const matchData = {
      resultA: goalsHome,
      resultB: goalsAway,
      status: isFinished ? 'FINISHED' : 'LIVE',
    };
    if (statusShort === 'PEN') {
      const penHome = apiFixture.score?.penalty?.home ?? null;
      const penAway = apiFixture.score?.penalty?.away ?? null;
      matchData.penaltyA = reversed ? penAway : penHome;
      matchData.penaltyB = reversed ? penHome : penAway;
    }

    await db.match.update({ where: { id: localMatch.id }, data: matchData });
    updated++;

    if (isFinished) {
      await MatchService.calculatePointsForMatch(db, localMatch.id);
      try {
        if (localMatch.phase === 'GRUPOS') {
          await advanceGroupsToR32(db);
        } else {
          await advanceKnockoutMatch(db, localMatch.id);
        }
      } catch (e) {
        if (log) log.warn('Advancement error: ' + e.message);
      }
      finished++;
      const suffix = statusShort === 'PEN'
        ? ` (${goalsHome}-${goalsAway}, pen ${matchData.penaltyA}-${matchData.penaltyB})`
        : ` (${goalsHome}-${goalsAway})`;
      if (log) log.info(`✅ Sync Finalizado: ${localMatch.teamAName} vs ${localMatch.teamBName}${suffix}`);
    } else {
      if (log) log.info(`⚽ Sync En Vivo: ${localMatch.teamAName} vs ${localMatch.teamBName} (${goalsHome}-${goalsAway})`);
    }
  }

  return { updated, finished, noMatch, liveChecked: liveMatches.length };
}

module.exports = { runSync };

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
};
const toEN = (name) => TEAM_EN[name.toUpperCase()] || name.toUpperCase();

/**
 * Sincroniza resultados de partidos LIVE contra la API de api-football.
 * Retorna un resumen { updated, finished, noMatch, skipped }.
 */
async function runSync(db, apiKey, log) {
  const liveMatches = await db.match.findMany({ where: { status: 'LIVE' } });
  if (!liveMatches.length) return { updated: 0, finished: 0, noMatch: 0, skipped: 0 };

  // API-Football indexa por fecha UTC
  const dateStr = new Date().toISOString().slice(0, 10);
  const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${dateStr}`, {
    headers: {
      'x-rapidapi-host': 'v3.football.api-sports.io',
      'x-apisports-key': apiKey,
    }
  });
  const data = await response.json();
  if (!data.response || data.errors?.length) {
    throw new Error('api-football error: ' + JSON.stringify(data.errors));
  }

  const MatchService = require('./MatchService');
  const { advanceGroupsToR32, advanceKnockoutMatch } = require('./AdvancementService');

  let updated = 0, finished = 0, noMatch = 0;

  for (const localMatch of liveMatches) {
    const nameA = toEN(localMatch.teamAName || '');
    const nameB = toEN(localMatch.teamBName || '');
    const apiFixture = data.response.find(f => {
      const home = f.teams.home.name.toUpperCase();
      const away = f.teams.away.name.toUpperCase();
      return (home.includes(nameA) || nameA.includes(home)) &&
             (away.includes(nameB) || nameB.includes(away));
    });

    if (!apiFixture) { noMatch++; continue; }

    const statusShort = apiFixture.fixture.status.short;
    const goalsHome   = apiFixture.goals.home;
    const goalsAway   = apiFixture.goals.away;
    const isFinished  = ['FT', 'AET', 'PEN'].includes(statusShort);

    if (goalsHome === null || goalsAway === null) continue;

    await db.match.update({
      where: { id: localMatch.id },
      data: { resultA: goalsHome, resultB: goalsAway, status: isFinished ? 'FINISHED' : 'LIVE' }
    });
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
      if (log) log.info(`✅ Sync Finalizado: ${localMatch.teamAName} vs ${localMatch.teamBName} (${goalsHome}-${goalsAway})`);
    } else {
      if (log) log.info(`⚽ Sync En Vivo: ${localMatch.teamAName} vs ${localMatch.teamBName} (${goalsHome}-${goalsAway})`);
    }
  }

  return { updated, finished, noMatch, liveChecked: liveMatches.length };
}

module.exports = { runSync };

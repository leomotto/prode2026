'use strict';

// Solo contiene equipos cuyo nombre en español y en inglés no comparten
// ninguna palabra significativa. Variantes de acento, puntuación y orden
// de palabras se resuelven automáticamente por el algoritmo de word-set.
const TEAM_EN = {
  'ALEMANIA':        'GERMANY',
  'ARGELIA':         'ALGERIA',
  'BELGICA':         'BELGIUM',
  'BRASIL':          'BRAZIL',
  'CHEQUIA':         'CZECH REPUBLIC',
  'COREA DEL SUR':   'SOUTH KOREA',
  'COSTA DE MARFIL': 'IVORY COAST',
  'CURAZAO':         'CURACAO',
  'EE UU':           'UNITED STATES',
  'EGIPTO':          'EGYPT',
  'ESCOCIA':         'SCOTLAND',
  'ESPANA':          'SPAIN',
  'FRANCIA':         'FRANCE',
  'INGLATERRA':      'ENGLAND',
  'JAPON':           'JAPAN',
  'JORDANIA':        'JORDAN',
  'MARRUECOS':       'MOROCCO',
  'NORUEGA':         'NORWAY',
  'NUEVA ZELANDA':   'NEW ZEALAND',
  'PAISES BAJOS':    'NETHERLANDS',
  'POLONIA':         'POLAND',
  'REP DOMINICANA':  'DOMINICAN REPUBLIC',
  'SUDAFRICA':       'SOUTH AFRICA',
  'SUECIA':          'SWEDEN',
  'SUIZA':           'SWITZERLAND',
  'TUNEZ':           'TUNISIA',
  'TURQUIA':         'TURKIYE',
  'CROACIA':         'CROATIA',
};

/**
 * Quita acentos, pasa a mayúsculas y reemplaza caracteres no alfanuméricos
 * por espacios. Resultado estable para usar como clave de TEAM_EN.
 */
function normalize(str) {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Conjunto de palabras significativas (más de 2 caracteres) de un nombre.
 * Filtrar palabras cortas evita falsos positivos con "DE", "OF", "DR", etc.
 */
function wordSet(str) {
  return new Set(normalize(str).split(' ').filter(w => w.length > 2));
}

function hasOverlap(setA, setB) {
  for (const w of setA) if (setB.has(w)) return true;
  return false;
}

/**
 * Compara un nombre de equipo de la DB (español) con uno de la API (inglés).
 * 1. Intenta coincidencia directa por word-set: maneja acentos, puntuación
 *    y orden de palabras sin configuración manual.
 * 2. Si no hay overlap, traduce via TEAM_EN y reintenta: cubre los casos
 *    donde español e inglés no comparten ninguna palabra (Alemania/Germany).
 */
function teamMatches(dbName, apiName) {
  const apiWords = wordSet(apiName);
  if (hasOverlap(wordSet(dbName), apiWords)) return true;
  const translated = TEAM_EN[normalize(dbName)];
  return !!translated && hasOverlap(wordSet(translated), apiWords);
}

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
 * y hace una llamada por fecha única.
 *
 * Fix penales: cuando el status de la API es 'PEN', guarda también
 * penaltyA/penaltyB para que AdvancementService pueda determinar el
 * ganador en bracket aun con resultado empatado tras prórroga.
 *
 * Retorna { updated, finished, noMatch, liveChecked, notFound }.
 */
async function runSync(db, apiKey, log) {
  const liveMatches = await db.match.findMany({ where: { status: 'LIVE' } });
  if (!liveMatches.length) return { updated: 0, finished: 0, noMatch: 0, liveChecked: 0, notFound: [] };

  // Agrupar por fecha UTC de inicio. Caso normal: 1 llamada. Caso medianoche: 2.
  const dateGroups = new Map();
  for (const m of liveMatches) {
    const dateStr = new Date(m.date).toISOString().slice(0, 10);
    if (!dateGroups.has(dateStr)) dateGroups.set(dateStr, []);
    dateGroups.get(dateStr).push(m);
  }

  const allFixtures = [];
  for (const dateStr of dateGroups.keys()) {
    const fixtures = await fetchFixturesByDate(dateStr, apiKey);
    allFixtures.push(...fixtures);
  }

  const MatchService = require('./MatchService');
  const { advanceGroupsToR32, advanceKnockoutMatch } = require('./AdvancementService');

  let updated = 0, finished = 0, noMatch = 0;
  const notFound = [];

  for (const localMatch of liveMatches) {
    let apiFixture = null;
    let reversed   = false;

    for (const f of allFixtures) {
      const home = f.teams.home.name;
      const away = f.teams.away.name;
      if (teamMatches(localMatch.teamAName, home) && teamMatches(localMatch.teamBName, away)) {
        apiFixture = f; reversed = false; break;
      }
      if (teamMatches(localMatch.teamAName, away) && teamMatches(localMatch.teamBName, home)) {
        apiFixture = f; reversed = true; break;
      }
    }

    if (!apiFixture) {
      noMatch++;
      const candidates = allFixtures
        .filter(f => {
          const h = f.teams.home.name, a = f.teams.away.name;
          return teamMatches(localMatch.teamAName, h) || teamMatches(localMatch.teamAName, a) ||
                 teamMatches(localMatch.teamBName, h) || teamMatches(localMatch.teamBName, a);
        })
        .map(f => `${f.teams.home.name} vs ${f.teams.away.name}`);
      notFound.push({
        db: `${localMatch.teamAName} vs ${localMatch.teamBName}`,
        date: new Date(localMatch.date).toISOString().slice(0, 10),
        candidates: candidates.length ? candidates : ['(sin candidatos en la API)'],
      });
      if (log) log.warn(`⚠️ Sync sin match: ${localMatch.teamAName} vs ${localMatch.teamBName}. Candidatos: ${candidates.join(' | ') || 'ninguno'}`);
      continue;
    }

    const statusShort = apiFixture.fixture.status.short;
    const isFinished  = ['FT', 'AET', 'PEN'].includes(statusShort);

    const goalsRaw  = { home: apiFixture.goals.home, away: apiFixture.goals.away };
    const goalsHome = reversed ? goalsRaw.away : goalsRaw.home;
    const goalsAway = reversed ? goalsRaw.home : goalsRaw.away;

    if (goalsHome === null || goalsAway === null) continue;

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

  return { updated, finished, noMatch, liveChecked: liveMatches.length, notFound };
}

module.exports = { runSync, teamMatches, normalize };

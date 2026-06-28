'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');

// Extrae sólo la lógica de matching y asignación de goles del SyncService
// para testear sin llamadas de red ni DB.

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
const toEN = n => TEAM_EN[n.toUpperCase()] || n.toUpperCase();

function findFixture(allFixtures, teamAName, teamBName) {
  const nameA = toEN(teamAName || '');
  const nameB = toEN(teamBName || '');
  for (const f of allFixtures) {
    const home = f.teams.home.name.toUpperCase();
    const away = f.teams.away.name.toUpperCase();
    if ((home.includes(nameA) || nameA.includes(home)) && (away.includes(nameB) || nameB.includes(away)))
      return { fixture: f, reversed: false };
    if ((away.includes(nameA) || nameA.includes(away)) && (home.includes(nameB) || nameB.includes(home)))
      return { fixture: f, reversed: true };
  }
  return null;
}

function resolveGoals(fixture, reversed) {
  return {
    resultA: reversed ? fixture.goals.away : fixture.goals.home,
    resultB: reversed ? fixture.goals.home : fixture.goals.away,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

const fixtureUzbekistanVsCongo = {
  teams: { home: { name: 'Uzbekistan' }, away: { name: 'Congo' } },
  goals: { home: 2, away: 1 },
  fixture: { status: { short: '2H' } },
  score: { penalty: { home: null, away: null } },
};

const fixtureColombiaVsPortugal = {
  teams: { home: { name: 'Colombia' }, away: { name: 'Portugal' } },
  goals: { home: 0, away: 1 },
  fixture: { status: { short: '2H' } },
  score: { penalty: { home: null, away: null } },
};

const allFixtures = [fixtureUzbekistanVsCongo, fixtureColombiaVsPortugal];

test('Congo vs Uzbekistán: encuentra fixture aunque el orden API esté invertido', () => {
  const result = findFixture(allFixtures, 'Congo', 'Uzbekistán');
  assert.ok(result, 'debe encontrar el fixture');
  assert.equal(result.reversed, true, 'debe detectar que el orden está invertido');
});

test('Congo vs Uzbekistán: swapea goles correctamente cuando está invertido', () => {
  const result = findFixture(allFixtures, 'Congo', 'Uzbekistán');
  const { resultA, resultB } = resolveGoals(result.fixture, result.reversed);
  // API: Uzbekistán(home)=2, Congo(away)=1
  // DB: Congo(teamA) debería tener 1 gol, Uzbekistán(teamB) 2 goles
  assert.equal(resultA, 1, 'Congo (teamA) debe tener 1 gol');
  assert.equal(resultB, 2, 'Uzbekistán (teamB) debe tener 2 goles');
});

test('Colombia vs Portugal: encuentra fixture en orden normal', () => {
  const result = findFixture(allFixtures, 'Colombia', 'Portugal');
  assert.ok(result);
  assert.equal(result.reversed, false);
});

test('Colombia vs Portugal: goles en orden correcto', () => {
  const result = findFixture(allFixtures, 'Colombia', 'Portugal');
  const { resultA, resultB } = resolveGoals(result.fixture, result.reversed);
  assert.equal(resultA, 0); // Colombia 0
  assert.equal(resultB, 1); // Portugal 1
});

test('equipo inexistente → retorna null', () => {
  const result = findFixture(allFixtures, 'Narnia', 'Wakanda');
  assert.equal(result, null);
});

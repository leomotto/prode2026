'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { teamMatches } = require('../src/services/SyncService');

// ── helpers locales ────────────────────────────────────────────────────────

function findFixture(allFixtures, teamAName, teamBName) {
  for (const f of allFixtures) {
    const home = f.teams.home.name;
    const away = f.teams.away.name;
    if (teamMatches(teamAName, home) && teamMatches(teamBName, away))
      return { fixture: f, reversed: false };
    if (teamMatches(teamAName, away) && teamMatches(teamBName, home))
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

// ── fixtures de prueba ─────────────────────────────────────────────────────

const fixtureCongoVsUzbekistan = {
  teams: { home: { name: 'Congo DR' }, away: { name: 'Uzbekistan' } },
  goals: { home: 1, away: 0 },
  fixture: { status: { short: '2H' } },
  score: { penalty: { home: null, away: null } },
};

const fixtureColombiaVsPortugal = {
  teams: { home: { name: 'Colombia' }, away: { name: 'Portugal' } },
  goals: { home: 0, away: 1 },
  fixture: { status: { short: '2H' } },
  score: { penalty: { home: null, away: null } },
};

const allFixtures = [fixtureCongoVsUzbekistan, fixtureColombiaVsPortugal];

// ── teamMatches: casos unitarios ───────────────────────────────────────────

test('teamMatches: nombre idéntico', () => {
  assert.ok(teamMatches('Colombia', 'Colombia'));
});

test('teamMatches: acento no impide match (Uzbekistán ↔ Uzbekistan)', () => {
  assert.ok(teamMatches('Uzbekistán', 'Uzbekistan'));
});

test('teamMatches: R.D. Congo ↔ Congo DR (orden de palabras diferente)', () => {
  assert.ok(teamMatches('R.D. Congo', 'Congo DR'));
});

test('teamMatches: Arabia Saudita ↔ Saudi Arabia (palabra compartida)', () => {
  assert.ok(teamMatches('Arabia Saudita', 'Saudi Arabia'));
});

test('teamMatches: Cabo Verde ↔ Cape Verde (palabra compartida)', () => {
  assert.ok(teamMatches('Cabo Verde', 'Cape Verde'));
});

test('teamMatches: traducción TEAM_EN — Alemania ↔ Germany', () => {
  assert.ok(teamMatches('Alemania', 'Germany'));
});

test('teamMatches: traducción TEAM_EN — Países Bajos ↔ Netherlands', () => {
  assert.ok(teamMatches('Países Bajos', 'Netherlands'));
});

test('teamMatches: traducción TEAM_EN — EE.UU. ↔ United States', () => {
  assert.ok(teamMatches('EE.UU.', 'United States'));
});

test('teamMatches: no falso positivo (Colombia ≠ Germany)', () => {
  assert.ok(!teamMatches('Colombia', 'Germany'));
});

test('teamMatches: no falso positivo (Congo ≠ Colombia)', () => {
  assert.ok(!teamMatches('Congo', 'Colombia'));
});

// ── findFixture: integración ───────────────────────────────────────────────

test('R.D. Congo vs Uzbekistán: encuentra fixture con nombre API "Congo DR"', () => {
  const result = findFixture(allFixtures, 'R.D. Congo', 'Uzbekistán');
  assert.ok(result, 'debe encontrar el fixture');
  assert.equal(result.reversed, false, 'Congo DR es home = teamA → no invertido');
});

test('R.D. Congo vs Uzbekistán: goles correctos', () => {
  const result = findFixture(allFixtures, 'R.D. Congo', 'Uzbekistán');
  const { resultA, resultB } = resolveGoals(result.fixture, result.reversed);
  assert.equal(resultA, 1); // R.D. Congo 1
  assert.equal(resultB, 0); // Uzbekistán 0
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

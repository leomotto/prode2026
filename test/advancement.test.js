'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const {
  computeBestThirds,
  advanceKnockoutMatch,
} = require('../src/services/AdvancementService');

// ── Helpers ────────────────────────────────────────────────────────────────

function team(name, pts, gd = 0, gf = 0) {
  return { name, pts, gd, gf, pj: 3, pg: 0, pe: 0, pp: 0, gc: 0, flag: '🏳️' };
}

// Mock db factory: findUnique devuelve matches por id, update los registra
function mockDb(matchMap) {
  const updates = [];
  return {
    updates,
    match: {
      findUnique: async ({ where }) => matchMap[where.id] ?? null,
      update: async ({ where, data }) => {
        updates.push({ id: where.id, data });
        return {};
      },
    },
  };
}

// ── computeBestThirds ──────────────────────────────────────────────────────

test('computeBestThirds: ordena por pts → gd → gf', () => {
  const standings = {
    A: [team('1A', 9), team('2A', 6), team('3A', 3, 1, 3)],
    B: [team('1B', 9), team('2B', 6), team('3B', 3, 1, 4)], // más gf que 3A
    C: [team('1C', 7), team('2C', 5), team('3C', 4)],        // más pts
  };
  const thirds = computeBestThirds(standings);
  assert.equal(thirds[0].name, '3C'); // 4 pts
  assert.equal(thirds[1].name, '3B'); // 3 pts, gf=4
  assert.equal(thirds[2].name, '3A'); // 3 pts, gf=3
});

test('computeBestThirds: ignora grupos sin partidos jugados (pj=0)', () => {
  const standings = {
    A: [team('1A', 9), team('2A', 6), { ...team('3A', 0), pj: 0 }],
    B: [team('1B', 9), team('2B', 6), team('3B', 3)],
  };
  const thirds = computeBestThirds(standings);
  assert.equal(thirds.length, 1);
  assert.equal(thirds[0].name, '3B');
});

// ── advanceKnockoutMatch ───────────────────────────────────────────────────

test('ganador por goles avanza al siguiente partido', async () => {
  // R32-M1 winner → R16-M1 sideA
  const db = mockDb({
    'R32-M1': { id: 'R32-M1', resultA: 2, resultB: 0, penaltyA: null, penaltyB: null, teamAName: 'Argentina', teamAFlag: '🇦🇷', teamBName: 'Francia', teamBFlag: '🇫🇷' },
    'R16-M1': { id: 'R16-M1', teamAName: null, teamBName: 'Alemania' },
  });

  const result = await advanceKnockoutMatch(db, 'R32-M1');

  assert.ok(result, 'debe retornar resultado');
  assert.equal(result.winner.name, 'Argentina');
  assert.equal(result.loser.name, 'Francia');

  const r16update = db.updates.find(u => u.id === 'R16-M1');
  assert.ok(r16update, 'debe haber actualizado R16-M1');
  assert.equal(r16update.data.teamAName, 'Argentina');
});

test('empate sin penaltyA/B → no avanza (partido aún no tiene definición)', async () => {
  const db = mockDb({
    'R32-M1': { id: 'R32-M1', resultA: 1, resultB: 1, penaltyA: null, penaltyB: null, teamAName: 'Argentina', teamAFlag: '🇦🇷', teamBName: 'Francia', teamBFlag: '🇫🇷' },
  });

  const result = await advanceKnockoutMatch(db, 'R32-M1');
  assert.equal(result, null);
  assert.equal(db.updates.length, 0);
});

test('empate con penales → ganador por penales avanza', async () => {
  // Argentina gana 4-2 en penales después de 1-1 en tiempo reglamentario+extra
  const db = mockDb({
    'R32-M1': { id: 'R32-M1', resultA: 1, resultB: 1, penaltyA: 4, penaltyB: 2, teamAName: 'Argentina', teamAFlag: '🇦🇷', teamBName: 'Francia', teamBFlag: '🇫🇷' },
    'R16-M1': { id: 'R16-M1', teamAName: null, teamBName: 'Alemania' },
  });

  const result = await advanceKnockoutMatch(db, 'R32-M1');

  assert.ok(result, 'debe retornar resultado con datos de penales');
  assert.equal(result.winner.name, 'Argentina');
  assert.equal(result.loser.name, 'Francia');

  const r16update = db.updates.find(u => u.id === 'R16-M1');
  assert.ok(r16update, 'debe haber actualizado el próximo partido');
  assert.equal(r16update.data.teamAName, 'Argentina');
});

test('perdedor en penales va al tercer puesto si corresponde', async () => {
  // SF-M1 loser → TP-M1 sideA
  const db = mockDb({
    'SF-M1': { id: 'SF-M1', resultA: 0, resultB: 0, penaltyA: 3, penaltyB: 5, teamAName: 'Brasil', teamAFlag: '🇧🇷', teamBName: 'Francia', teamBFlag: '🇫🇷' },
    'TP-M1': { id: 'TP-M1', teamAName: null, teamBName: null },
    'FINAL-M1': { id: 'FINAL-M1', teamAName: null, teamBName: null },
  });

  const result = await advanceKnockoutMatch(db, 'SF-M1');

  assert.ok(result);
  assert.equal(result.winner.name, 'Francia'); // más penales
  assert.equal(result.loser.name, 'Brasil');

  const tpUpdate = db.updates.find(u => u.id === 'TP-M1');
  assert.ok(tpUpdate, 'Brasil debe ir al tercer puesto');
  assert.equal(tpUpdate.data.teamAName, 'Brasil');

  const finalUpdate = db.updates.find(u => u.id === 'FINAL-M1');
  assert.ok(finalUpdate, 'Francia debe ir a la final');
  assert.equal(finalUpdate.data.teamAName, 'Francia');
});

test('match no encontrado → retorna null', async () => {
  const db = mockDb({});
  const result = await advanceKnockoutMatch(db, 'inexistente');
  assert.equal(result, null);
});

test('match sin resultado → retorna null', async () => {
  const db = mockDb({
    'R32-M1': { id: 'R32-M1', resultA: null, resultB: null, penaltyA: null, penaltyB: null },
  });
  const result = await advanceKnockoutMatch(db, 'R32-M1');
  assert.equal(result, null);
});

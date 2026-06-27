'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { calcularPuntos } = require('../src/lib/scoring');

// ── calcularPuntos ─────────────────────────────────────────────────────────

test('resultado exacto → 3 puntos', () => {
  const { base, total } = calcularPuntos(
    { resultA: 2, resultB: 1 },
    { scoreA:  2, scoreB:  1 }
  );
  assert.equal(base,  3);
  assert.equal(total, 3);
});

test('ganador correcto (no exacto) → 1 punto', () => {
  const { base, total } = calcularPuntos(
    { resultA: 3, resultB: 0 },
    { scoreA:  1, scoreB:  0 }
  );
  assert.equal(base,  1);
  assert.equal(total, 1);
});

test('empate correcto (no exacto) → 1 punto', () => {
  const { base, total } = calcularPuntos(
    { resultA: 1, resultB: 1 },
    { scoreA:  0, scoreB:  0 }
  );
  assert.equal(base,  1);
  assert.equal(total, 1);
});

test('ganador incorrecto → 0 puntos', () => {
  const { base, total } = calcularPuntos(
    { resultA: 0, resultB: 2 },
    { scoreA:  1, scoreB:  0 }
  );
  assert.equal(base,  0);
  assert.equal(total, 0);
});

test('pronóstico empate pero hubo ganador → 0 puntos', () => {
  const { base, total } = calcularPuntos(
    { resultA: 2, resultB: 1 },
    { scoreA:  1, scoreB:  1 }
  );
  assert.equal(base,  0);
  assert.equal(total, 0);
});

test('resultado nulo → devuelve null', () => {
  const { base, total } = calcularPuntos(
    { resultA: null, resultB: null },
    { scoreA:  1,    scoreB:  0    }
  );
  assert.equal(base,  null);
  assert.equal(total, null);
});

test('bonus siempre 0 (no implementado)', () => {
  const { bonus } = calcularPuntos(
    { resultA: 2, resultB: 1 },
    { scoreA:  2, scoreB:  1 }
  );
  assert.equal(bonus, 0);
});

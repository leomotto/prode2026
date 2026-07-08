'use strict';

/**
 * Motor de puntuación para el Prode Mundial 2026
 * Recibe el resultado real y el pronóstico, devuelve puntos base + bonus.
 * Criterio oficial:
 * - 3 puntos por acertar el resultado exacto.
 * - 1 punto por acertar el ganador o empate sin marcador exacto.
 * - 0 puntos en cualquier otro caso.
 */
function calcularPuntos(real, prono) {
  const { resultA, resultB } = real;
  const { scoreA, scoreB } = prono;

  if (resultA === null || resultB === null) return { base: null, bonus: null, total: null };

  const ganadorReal = Math.sign(resultA - resultB);   // -1 (B), 0 (Empate), 1 (A)
  const ganadorPred = Math.sign(scoreA  - scoreB);

  let base = 0;

  if (scoreA === resultA && scoreB === resultB) {
    base = 3; // Resultado exacto
  } else if (ganadorReal === ganadorPred) {
    base = 1; // Ganador o empate correcto
  } else {
    base = 0; // Incorrecto
  }

  return { base, bonus: 0, total: base };
}

module.exports = { calcularPuntos };

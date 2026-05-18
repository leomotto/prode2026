'use strict';

/**
 * Motor de puntuación para el Prode Mundial 2026
 * Recibe el resultado real y el pronóstico, devuelve puntos base + bonus
 */
function calcularPuntos(real, prono) {
  const { resultA, resultB } = real;
  const { scoreA, scoreB, firstScorer, cardsCount, cornersCount, btts, mvp } = prono;

  let base = 0;
  let bonus = 0;

  if (resultA === null || resultB === null) return { base: null, bonus: null, total: null };

  const ganadorReal = Math.sign(resultA - resultB);   // -1, 0, 1
  const ganadorPred = Math.sign(scoreA  - scoreB);

  if (scoreA === resultA && scoreB === resultB) {
    base = 10; // Exacto
  } else if (ganadorReal === ganadorPred) {
    const difReal = Math.abs(resultA - resultB);
    const difPred = Math.abs(scoreA  - scoreB);
    if (difReal === difPred) {
      base = 7; // Ganador + diferencia exacta
    } else if (scoreA === resultA || scoreB === resultB) {
      base = 5; // Ganador + goles de un equipo exactos
    } else {
      base = 3; // Solo ganador
    }
  } else {
    base = 0;
  }

  // Bonus
  if (firstScorer) bonus += 3; // se valida externamente contra el goleador real
  if (cardsCount !== null && cardsCount !== undefined) bonus += 1; // se valida externamente
  if (cornersCount !== null && cornersCount !== undefined) bonus += 1; // se valida externamente
  const bttReal = resultA > 0 && resultB > 0;
  if (btts !== null && btts !== undefined && btts === bttReal) bonus += 1;
  if (mvp) bonus += 2; // se valida externamente

  return { base, bonus, total: base + bonus };
}

/**
 * Valida bonus especiales contra los valores reales del partido
 * @param {object} prono - predicción del usuario
 * @param {object} extras - { realFirstScorer, realCardsCount, realCornersCount, realMvp }
 * @returns {number} puntos bonus validados
 */
function calcularBonus(prono, extras = {}) {
  let bonus = 0;
  const { firstScorer, cardsCount, cornersCount, btts, mvp, scoreA, scoreB } = prono;
  const { realFirstScorer, realCardsCount, realCornersCount, realMvp, resultA, resultB } = extras;

  if (firstScorer && realFirstScorer &&
      firstScorer.trim().toLowerCase() === realFirstScorer.trim().toLowerCase()) bonus += 3;

  if (cardsCount !== null && cardsCount !== undefined &&
      realCardsCount !== null && realCardsCount !== undefined &&
      cardsCount === realCardsCount) bonus += 1;

  if (cornersCount !== null && cornersCount !== undefined &&
      realCornersCount !== null && realCornersCount !== undefined &&
      cornersCount === realCornersCount) bonus += 1;

  const bttReal = resultA > 0 && resultB > 0;
  if (btts !== null && btts !== undefined && btts === bttReal) bonus += 1;

  if (mvp && realMvp &&
      mvp.trim().toLowerCase() === realMvp.trim().toLowerCase()) bonus += 2;

  return bonus;
}

module.exports = { calcularPuntos, calcularBonus };

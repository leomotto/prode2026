const { calcularPuntos, calcularBonus } = require('../lib/scoring');

/**
 * Recalcula y asigna los puntos de todas las predicciones para un partido dado.
 * @param {object} db - Instancia de Prisma (ej: fastify.db)
 * @param {string} matchId - ID del partido
 * @param {object} realStats - Estadísticas reales del partido (opcional, para bonus)
 */
async function calculatePointsForMatch(db, matchId, realStats = {}) {
  // 1. Obtener el partido y verificar que esté FINALIZADO
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match || match.status !== 'FINISHED' || match.resultA === null || match.resultB === null) {
    throw new Error('El partido no está finalizado o no tiene resultados válidos');
  }

  // 2. Traer todas las predicciones de este partido
  const predictions = await db.prediction.findMany({ where: { matchId } });

  let updated = 0;
  // 3. Calcular y actualizar puntos para cada pronóstico
  for (const pred of predictions) {
    const base = calcularPuntos({ resultA: match.resultA, resultB: match.resultB }, pred).base;
    
    // Fallback de bonus a los guardados en el partido si no se pasan en realStats
    const bonusData = {
      resultA: match.resultA,
      resultB: match.resultB,
      realFirstScorer: realStats.realFirstScorer || null,
      realCardsCount: realStats.realCardsCount || null,
      realCornersCount: realStats.realCornersCount || null,
      realMvp: realStats.realMvp || null,
    };
    
    const bonus = calcularBonus(pred, bonusData);
    
    await db.prediction.update({
      where: { id: pred.id },
      data: {
        pointsBase: base,
        pointsBonus: bonus,
        pointsTotal: base + bonus,
        calculatedAt: new Date(),
        locked: true,
      },
    });
    updated++;
  }

  return { match, updatedPredictions: updated };
}

module.exports = {
  calculatePointsForMatch
};

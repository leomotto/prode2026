const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const MatchService = require('./src/services/MatchService');
const AdvancementService = require('./src/services/AdvancementService');

async function main() {
  console.log("🛠️  Buscando partidos finalizados para recalcular puntos...");
  const finishedMatches = await prisma.match.findMany({
    where: { status: 'FINISHED' }
  });
  
  for (const match of finishedMatches) {
    if (match.resultA !== null && match.resultB !== null) {
      console.log(`- Recalculando ${match.id} (${match.teamAName} vs ${match.teamBName})`);
      try {
        await MatchService.calculatePointsForMatch(prisma, match.id);
      } catch (err) {
        console.error(`Error recalculando ${match.id}:`, err.message);
      }
    }
  }
  
  console.log("🛠️  Corriendo advancement completo para asegurar propagación a la siguiente fase...");
  await AdvancementService.runFullAdvancement(prisma);
  
  console.log("✅ Fix aplicado correctamente.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });

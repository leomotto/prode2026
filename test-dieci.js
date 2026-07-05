const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
async function run() {
  const matches = await db.match.findMany({where: {phase: 'DIECISEISAVOS'}});
  matches.forEach(m => console.log(`${m.id}: ${m.teamAName} vs ${m.teamBName} [${m.status}]`));
}
run().catch(console.error).finally(()=>db.$disconnect());

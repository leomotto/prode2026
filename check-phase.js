const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
async function run() {
  const m = await db.match.findMany({ where: { id: { startsWith: 'R16-' } } });
  m.forEach(x => console.log(`${x.id}: phase=${x.phase} teamA=${x.teamAName} teamB=${x.teamBName}`));
}
run().then(()=>process.exit(0));

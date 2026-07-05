const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
async function run() {
  const m = await db.match.findMany({ where: { phase: 'OCTAVOS' } });
  m.forEach(x => console.log(x.id, x.teamAName, x.teamBName));
}
run().finally(() => db.$disconnect());

const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
async function run() {
  const m14 = await db.match.findUnique({where: {id: 'R32-M14'}});
  const m16 = await db.match.findUnique({where: {id: 'R32-M16'}});
  console.log('M14:', m14.status, m14.teamAName, m14.teamBName);
  console.log('M16:', m16.status, m16.teamAName, m16.teamBName);
}
run().catch(console.error).finally(()=>db.$disconnect());

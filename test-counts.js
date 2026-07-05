const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
async function run() {
  const allGroupMatches = await db.match.findMany({ where: { phase: 'GRUPOS' } });
  const counts = { total: allGroupMatches.length, finished: allGroupMatches.filter(m=>m.status==='FINISHED').length };
  console.log('Group matches:', counts);
  const R32Matches = await db.match.findMany({ where: { phase: 'DIECISEISAVOS' } });
  const r32Counts = { total: R32Matches.length, finished: R32Matches.filter(m=>m.status==='FINISHED').length };
  console.log('R32 matches:', r32Counts);
}
run().catch(console.error).finally(()=>db.$disconnect());

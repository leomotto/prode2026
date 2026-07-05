const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
async function run() {
  const s = await db.match.findFirst({ where: { teamAName: 'Suiza', teamBName: 'Argelia' } });
  const a = await db.match.findFirst({ where: { teamAName: 'Argelia', teamBName: 'Suiza' } });
  console.log(s || a);
}
run().catch(console.error).finally(()=>db.$disconnect());

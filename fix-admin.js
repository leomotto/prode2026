const { PrismaClient } = require('@prisma/client');
const { runFullAdvancement } = require('./src/services/AdvancementService');

const db = new PrismaClient();

async function run() {
  await runFullAdvancement(db);
  console.log('Finished full advancement!');
}

run().catch(console.error).finally(()=>db.$disconnect());

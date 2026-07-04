const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function run() {
  const updates = [
    { id: 'R16-M1', a: 'Canadá', b: 'Marruecos', cA: 'CAN', cB: 'MAR', fA: '🇨🇦', fB: '🇲🇦' },
    { id: 'R16-M2', a: 'Paraguay', b: 'Francia', cA: 'PAR', cB: 'FRA', fA: '🇵🇾', fB: '🇫🇷' },
    { id: 'R16-M3', a: 'Portugal', b: 'España', cA: 'POR', cB: 'ESP', fA: '🇵🇹', fB: '🇪🇸' },
    { id: 'R16-M4', a: 'EE.UU.', b: 'Bélgica', cA: 'USA', cB: 'BEL', fA: '🇺🇸', fB: '🇧🇪' },
    { id: 'R16-M5', a: 'Brasil', b: 'Noruega', cA: 'BRA', cB: 'NOR', fA: '🇧🇷', fB: '🇳🇴' },
    { id: 'R16-M6', a: 'México', b: 'Inglaterra', cA: 'MEX', cB: 'ENG', fA: '🇲🇽', fB: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { id: 'R16-M7', a: 'Ganador Partido 86', b: 'Ganador Partido 88', cA: 'W86', cB: 'W88', fA: '❔', fB: '❔' },
    { id: 'R16-M8', a: 'G P85', b: 'G P87', cA: 'W85', cB: 'W87', fA: '❔', fB: '❔' },
  ];

  for (const u of updates) {
    await db.match.update({
      where: { id: u.id },
      data: {
        teamAName: u.a,
        teamBName: u.b,
        teamACode: u.cA,
        teamBCode: u.cB,
        teamAFlag: u.fA,
        teamBFlag: u.fB,
        argentina: u.a === 'Argentina' || u.b === 'Argentina'
      }
    });
    console.log(`Updated ${u.id}: ${u.a} vs ${u.b}`);
  }
}

run().catch(console.error).finally(()=>db.$disconnect());

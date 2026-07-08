'use strict';
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Grupos del Mundial 2026 (sorteo dic 2025)
const GROUPS = {
  A: [{ name: 'México',      flag: '🇲🇽', code: 'MEX' }, { name: 'Sudáfrica',  flag: '🇿🇦', code: 'RSA' }, { name: 'Corea del Sur', flag: '🇰🇷', code: 'KOR' }, { name: 'Chequia',    flag: '🇨🇿', code: 'CZE' }],
  B: [{ name: 'Canadá',      flag: '🇨🇦', code: 'CAN' }, { name: 'Bosnia',      flag: '🇧🇦', code: 'BIH' }, { name: 'Qatar',         flag: '🇶🇦', code: 'QAT' }, { name: 'Suiza',      flag: '🇨🇭', code: 'SUI' }],
  C: [{ name: 'Brasil',      flag: '🇧🇷', code: 'BRA' }, { name: 'Marruecos',  flag: '🇲🇦', code: 'MAR' }, { name: 'Haití',         flag: '🇭🇹', code: 'HAI' }, { name: 'Escocia',    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', code: 'SCO' }],
  D: [{ name: 'EE.UU.',      flag: '🇺🇸', code: 'USA' }, { name: 'Paraguay',   flag: '🇵🇾', code: 'PAR' }, { name: 'Australia',     flag: '🇦🇺', code: 'AUS' }, { name: 'Turquía',    flag: '🇹🇷', code: 'TUR' }],
  E: [{ name: 'Alemania',    flag: '🇩🇪', code: 'GER' }, { name: 'Curazao',    flag: '🇨🇼', code: 'CUW' }, { name: 'Costa de Marfil', flag: '🇨🇮', code: 'CIV' }, { name: 'Ecuador',  flag: '🇪🇨', code: 'ECU' }],
  F: [{ name: 'Países Bajos',flag: '🇳🇱', code: 'NED' }, { name: 'Japón',      flag: '🇯🇵', code: 'JPN' }, { name: 'Suecia',        flag: '🇸🇪', code: 'SWE' }, { name: 'Túnez',      flag: '🇹🇳', code: 'TUN' }],
  G: [{ name: 'Bélgica',    flag: '🇧🇪', code: 'BEL' }, { name: 'Egipto',     flag: '🇪🇬', code: 'EGY' }, { name: 'Irán',          flag: '🇮🇷', code: 'IRN' }, { name: 'Nueva Zelanda', flag: '🇳🇿', code: 'NZL' }],
  H: [{ name: 'España',      flag: '🇪🇸', code: 'ESP' }, { name: 'Cabo Verde', flag: '🇨🇻', code: 'CPV' }, { name: 'Arabia Saudita',flag: '🇸🇦', code: 'KSA' }, { name: 'Uruguay',    flag: '🇺🇾', code: 'URU' }],
  I: [{ name: 'Francia',     flag: '🇫🇷', code: 'FRA' }, { name: 'Senegal',    flag: '🇸🇳', code: 'SEN' }, { name: 'Iraq',          flag: '🇮🇶', code: 'IRQ' }, { name: 'Noruega',    flag: '🇳🇴', code: 'NOR' }],
  J: [{ name: 'Argentina',   flag: '🇦🇷', code: 'ARG' }, { name: 'Argelia',    flag: '🇩🇿', code: 'ALG' }, { name: 'Austria',       flag: '🇦🇹', code: 'AUT' }, { name: 'Jordania',   flag: '🇯🇴', code: 'JOR' }],
  K: [{ name: 'Portugal',    flag: '🇵🇹', code: 'POR' }, { name: 'Ghana',      flag: '🇬🇭', code: 'GHA' }, { name: 'Panamá',        flag: '🇵🇦', code: 'PAN' }, { name: 'Polonia',    flag: '🇵🇱', code: 'POL' }],
  L: [{ name: 'Inglaterra',  flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', code: 'ENG' }, { name: 'Serbia',  flag: '🇷🇸', code: 'SRB' }, { name: 'Rep. Dominicana', flag: '🇩🇴', code: 'DOM' }, { name: 'Colombia', flag: '🇨🇴', code: 'COL' }],
};

// Fase de grupos: cada grupo juega 3 fechas (6 partidos por grupo)
// Fechas aproximadas basadas en el calendario oficial
const GROUP_SCHEDULE = {
  A: [
    { d1: '2026-06-11T21:00:00-05:00', v1: 'Estadio Azteca, Ciudad de México' },
    { d2: '2026-06-12T12:00:00-05:00', v2: 'SoFi Stadium, Los Ángeles' },
    { d3: '2026-06-17T12:00:00-05:00', v3: 'AT&T Stadium, Dallas' },
    { d4: '2026-06-17T15:00:00-05:00', v4: 'Estadio Azteca, Ciudad de México' },
    { d5: '2026-06-21T15:00:00-05:00', v5: 'SoFi Stadium, Los Ángeles' },
    { d6: '2026-06-21T15:00:00-05:00', v6: 'AT&T Stadium, Dallas' },
  ],
  B: [
    { d1: '2026-06-12T18:00:00-05:00', v1: 'BC Place, Vancouver' },
    { d2: '2026-06-12T21:00:00-05:00', v2: 'BMO Field, Toronto' },
    { d3: '2026-06-17T18:00:00-05:00', v3: 'BC Place, Vancouver' },
    { d4: '2026-06-17T21:00:00-05:00', v4: 'BMO Field, Toronto' },
    { d5: '2026-06-22T15:00:00-05:00', v5: 'BC Place, Vancouver' },
    { d6: '2026-06-22T15:00:00-05:00', v6: 'BMO Field, Toronto' },
  ],
  C: [
    { d1: '2026-06-13T12:00:00-05:00', v1: 'MetLife Stadium, Nueva York' },
    { d2: '2026-06-13T18:00:00-05:00', v2: 'Estadio Akron, Guadalajara' },
    { d3: '2026-06-18T12:00:00-05:00', v3: 'MetLife Stadium, Nueva York' },
    { d4: '2026-06-18T18:00:00-05:00', v4: 'Estadio Akron, Guadalajara' },
    { d5: '2026-06-22T18:00:00-05:00', v5: 'MetLife Stadium, Nueva York' },
    { d6: '2026-06-22T18:00:00-05:00', v6: 'Estadio Akron, Guadalajara' },
  ],
  D: [
    { d1: '2026-06-13T21:00:00-05:00', v1: 'SoFi Stadium, Los Ángeles' },
    { d2: '2026-06-14T12:00:00-05:00', v2: 'Levi\'s Stadium, San Francisco' },
    { d3: '2026-06-19T12:00:00-05:00', v3: 'SoFi Stadium, Los Ángeles' },
    { d4: '2026-06-19T18:00:00-05:00', v4: 'Levi\'s Stadium, San Francisco' },
    { d5: '2026-06-23T15:00:00-05:00', v5: 'SoFi Stadium, Los Ángeles' },
    { d6: '2026-06-23T15:00:00-05:00', v6: 'Levi\'s Stadium, San Francisco' },
  ],
  E: [
    { d1: '2026-06-14T18:00:00-05:00', v1: 'Gillette Stadium, Boston' },
    { d2: '2026-06-15T12:00:00-05:00', v2: 'Mercedes-Benz Stadium, Atlanta' },
    { d3: '2026-06-19T21:00:00-05:00', v3: 'Gillette Stadium, Boston' },
    { d4: '2026-06-20T12:00:00-05:00', v4: 'Mercedes-Benz Stadium, Atlanta' },
    { d5: '2026-06-24T15:00:00-05:00', v5: 'Gillette Stadium, Boston' },
    { d6: '2026-06-24T15:00:00-05:00', v6: 'Mercedes-Benz Stadium, Atlanta' },
  ],
  F: [
    { d1: '2026-06-15T15:00:00-05:00', v1: 'NRG Stadium, Houston' },
    { d2: '2026-06-15T18:00:00-05:00', v2: 'Arrowhead Stadium, Kansas City' },
    { d3: '2026-06-20T15:00:00-05:00', v3: 'NRG Stadium, Houston' },
    { d4: '2026-06-20T18:00:00-05:00', v4: 'Arrowhead Stadium, Kansas City' },
    { d5: '2026-06-24T18:00:00-05:00', v5: 'NRG Stadium, Houston' },
    { d6: '2026-06-24T18:00:00-05:00', v6: 'Arrowhead Stadium, Kansas City' },
  ],
  G: [
    { d1: '2026-06-15T21:00:00-05:00', v1: 'Lincoln Financial Field, Filadelfia' },
    { d2: '2026-06-16T12:00:00-05:00', v2: 'Empower Field, Denver' },
    { d3: '2026-06-21T12:00:00-05:00', v3: 'Lincoln Financial Field, Filadelfia' },
    { d4: '2026-06-21T18:00:00-05:00', v4: 'Empower Field, Denver' },
    { d5: '2026-06-25T15:00:00-05:00', v5: 'Lincoln Financial Field, Filadelfia' },
    { d6: '2026-06-25T15:00:00-05:00', v6: 'Empower Field, Denver' },
  ],
  H: [
    { d1: '2026-06-16T15:00:00-05:00', v1: 'Hard Rock Stadium, Miami' },
    { d2: '2026-06-16T18:00:00-05:00', v2: 'Camping World Stadium, Orlando' },
    { d3: '2026-06-21T21:00:00-05:00', v3: 'Hard Rock Stadium, Miami' },
    { d4: '2026-06-22T12:00:00-05:00', v4: 'Camping World Stadium, Orlando' },
    { d5: '2026-06-25T18:00:00-05:00', v5: 'Hard Rock Stadium, Miami' },
    { d6: '2026-06-25T18:00:00-05:00', v6: 'Camping World Stadium, Orlando' },
  ],
  I: [
    { d1: '2026-06-16T21:00:00-05:00', v1: 'AT&T Stadium, Dallas' },
    { d2: '2026-06-17T15:00:00-06:00', v2: 'Estadio Guadalajara' },
    { d3: '2026-06-22T15:00:00-05:00', v3: 'AT&T Stadium, Dallas' },
    { d4: '2026-06-22T18:00:00-06:00', v4: 'Estadio BBVA, Monterrey' },
    { d5: '2026-06-26T15:00:00-05:00', v5: 'AT&T Stadium, Dallas' },
    { d6: '2026-06-26T15:00:00-05:00', v6: 'Estadio BBVA, Monterrey' },
  ],
  J: [
    { d1: '2026-06-16T21:00:00-05:00', v1: 'Arrowhead Stadium, Kansas City' },       // ARG vs ALG
    { d2: '2026-06-17T09:00:00-05:00', v2: 'AT&T Stadium, Arlington' },               // AUT vs JOR
    { d3: '2026-06-22T12:00:00-05:00', v3: 'AT&T Stadium, Arlington' },               // ARG vs AUT
    { d4: '2026-06-22T15:00:00-05:00', v4: 'Arrowhead Stadium, Kansas City' },        // JOR vs ALG
    { d5: '2026-06-27T22:00:00-05:00', v5: 'AT&T Stadium, Arlington' },               // JOR vs ARG
    { d6: '2026-06-27T22:00:00-05:00', v6: 'Arrowhead Stadium, Kansas City' },        // ALG vs AUT
  ],
  K: [
    { d1: '2026-06-17T18:00:00-05:00', v1: 'Estadio Azteca, Ciudad de México' },
    { d2: '2026-06-17T21:00:00-05:00', v2: 'NRG Stadium, Houston' },
    { d3: '2026-06-23T12:00:00-05:00', v3: 'Estadio Azteca, Ciudad de México' },
    { d4: '2026-06-23T18:00:00-05:00', v4: 'NRG Stadium, Houston' },
    { d5: '2026-06-27T12:00:00-05:00', v5: 'Estadio Azteca, Ciudad de México' },
    { d6: '2026-06-27T12:00:00-05:00', v6: 'NRG Stadium, Houston' },
  ],
  L: [
    { d1: '2026-06-18T12:00:00-05:00', v1: 'MetLife Stadium, Nueva York' },
    { d2: '2026-06-18T15:00:00-05:00', v2: 'Levi\'s Stadium, San Francisco' },
    { d3: '2026-06-23T21:00:00-05:00', v3: 'MetLife Stadium, Nueva York' },
    { d4: '2026-06-24T12:00:00-05:00', v4: 'Levi\'s Stadium, San Francisco' },
    { d5: '2026-06-27T18:00:00-05:00', v5: 'MetLife Stadium, Nueva York' },
    { d6: '2026-06-27T18:00:00-05:00', v6: 'Levi\'s Stadium, San Francisco' },
  ],
};

function makeMatchId(codeA, codeB, phase, num) {
  return `${codeA}-${codeB}-${phase}${num}`;
}

function getCity(venue) {
  const parts = venue.split(',');
  return parts[parts.length - 1].trim();
}

async function main() {
  console.log('🌱 Iniciando seed del fixture Mundial 2026...');

  const matches = [];

  // ─── FASE DE GRUPOS (72 partidos) ────────────────────────────
  for (const [group, teams] of Object.entries(GROUPS)) {
    const sched = GROUP_SCHEDULE[group];
    const isArgGroup = group === 'J';
    let schedIdx = 0;

    // 6 combinaciones por grupo
    const combos = [
      [0, 1], [2, 3],  // Fecha 1
      [0, 2], [1, 3],  // Fecha 2
      [3, 0], [1, 2],  // Fecha 3
    ];

    for (let i = 0; i < combos.length; i++) {
      const [ai, bi] = combos[i];
      const tA = teams[ai];
      const tB = teams[bi];
      const s = sched[i];
      const dateKey = `d${i + 1}`;
      const venueKey = `v${i + 1}`;

      const isArg = tA.code === 'ARG' || tB.code === 'ARG';
      const matchId = makeMatchId(tA.code, tB.code, `G${group}`, i + 1);

      matches.push({
        id: matchId,
        phase: 'GRUPOS',
        groupName: group,
        teamAName: tA.name, teamAFlag: tA.flag, teamACode: tA.code,
        teamBName: tB.name, teamBFlag: tB.flag, teamBCode: tB.code,
        date: new Date(s[dateKey]),
        venue: s[venueKey],
        city: getCity(s[venueKey]),
        status: 'UPCOMING',
        featured: isArg,
        argentina: isArg,
      });
    }
  }

  // ─── DIECISEISAVOS (16 partidos) ──────────────────────────────
  const r32Dates = [
    '2026-06-28', '2026-06-28', '2026-06-29', '2026-06-29',
    '2026-06-30', '2026-06-30', '2026-07-01', '2026-07-01',
    '2026-07-02', '2026-07-02', '2026-07-03', '2026-07-03',
    '2026-07-04', '2026-07-04', '2026-07-04', '2026-07-05',
  ];
  const r32Venues = [
    'MetLife Stadium, Nueva York', 'AT&T Stadium, Dallas',
    'SoFi Stadium, Los Ángeles', 'NRG Stadium, Houston',
    'Arrowhead Stadium, Kansas City', 'Hard Rock Stadium, Miami',
    'BC Place, Vancouver', 'BMO Field, Toronto',
    'Gillette Stadium, Boston', 'Mercedes-Benz Stadium, Atlanta',
    'Empower Field, Denver', 'Camping World Stadium, Orlando',
    'Lincoln Financial Field, Filadelfia', 'Levi\'s Stadium, San Francisco',
    'Estadio Azteca, Ciudad de México', 'Estadio BBVA, Monterrey',
  ];
  for (let i = 0; i < 16; i++) {
    const matchNum = i + 1;
    matches.push({
      id: `R32-M${matchNum}`,
      phase: 'DIECISEISAVOS',
      groupName: null,
      teamAName: `Clasificado ${String.fromCharCode(65 + Math.floor(i * 1.5))}1`, teamAFlag: '🏳️', teamACode: `R32A${matchNum}`,
      teamBName: `Clasificado ${String.fromCharCode(66 + Math.floor(i * 1.5))}2`, teamBFlag: '🏳️', teamBCode: `R32B${matchNum}`,
      date: new Date(`${r32Dates[i]}T18:00:00-05:00`),
      venue: r32Venues[i],
      city: getCity(r32Venues[i]),
      status: 'UPCOMING',
      featured: false,
      argentina: false,
    });
  }

  // ─── OCTAVOS (8 partidos) ──────────────────────────────────────
  const r16Dates = ['2026-07-04', '2026-07-05', '2026-07-06', '2026-07-06', '2026-07-07', '2026-07-07', '2026-07-08', '2026-07-08'];
  const r16Venues = [
    'MetLife Stadium, Nueva York', 'AT&T Stadium, Dallas',
    'SoFi Stadium, Los Ángeles', 'Hard Rock Stadium, Miami',
    'Arrowhead Stadium, Kansas City', 'NRG Stadium, Houston',
    'BC Place, Vancouver', 'Mercedes-Benz Stadium, Atlanta',
  ];
  for (let i = 0; i < 8; i++) {
    matches.push({
      id: `R16-M${i + 1}`,
      phase: 'OCTAVOS',
      groupName: null,
      teamAName: `Ganador R32-M${i * 2 + 1}`, teamAFlag: '🏳️', teamACode: `R16A${i + 1}`,
      teamBName: `Ganador R32-M${i * 2 + 2}`, teamBFlag: '🏳️', teamBCode: `R16B${i + 1}`,
      date: new Date(`${r16Dates[i]}T20:00:00-05:00`),
      venue: r16Venues[i],
      city: getCity(r16Venues[i]),
      status: 'UPCOMING',
      featured: true,
      argentina: false,
    });
  }

  // ─── CUARTOS (4 partidos) ──────────────────────────────────────
  const qfDates = [
    '2026-07-09T16:00:00-04:00', // Boston (EDT) - 4:00 PM Local
    '2026-07-10T12:00:00-07:00', // LA (PDT) - 12:00 PM Local
    '2026-07-11T17:00:00-04:00', // Miami (EDT) - 5:00 PM Local
    '2026-07-11T20:00:00-05:00'  // Kansas City (CDT) - 8:00 PM Local
  ];
  const qfVenues = [
    'Gillette Stadium, Boston', 
    'SoFi Stadium, Los Ángeles',
    'Hard Rock Stadium, Miami', 
    'Arrowhead Stadium, Kansas City',
  ];
  const qfPairings = [
    { a: 6, b: 1 }, // QF-M1: Winner R16-M6 vs Winner R16-M1
    { a: 4, b: 7 }, // QF-M2: Winner R16-M4 vs Winner R16-M7
    { a: 5, b: 3 }, // QF-M3: Winner R16-M5 vs Winner R16-M3
    { a: 8, b: 2 }  // QF-M4: Winner R16-M8 vs Winner R16-M2
  ];
  for (let i = 0; i < 4; i++) {
    const pair = qfPairings[i];
    matches.push({
      id: `QF-M${i + 1}`,
      phase: 'CUARTOS',
      groupName: null,
      teamAName: `Ganador R16-M${pair.a}`, teamAFlag: '🏳️', teamACode: `QFA${i + 1}`,
      teamBName: `Ganador R16-M${pair.b}`, teamBFlag: '🏳️', teamBCode: `QFB${i + 1}`,
      date: new Date(qfDates[i]),
      venue: qfVenues[i],
      city: getCity(qfVenues[i]),
      status: 'UPCOMING',
      featured: true,
      argentina: false,
    });
  }

  // ─── SEMIFINALES (2 partidos) ──────────────────────────────────
  for (let i = 0; i < 2; i++) {
    matches.push({
      id: `SF-M${i + 1}`,
      phase: 'SEMIFINAL',
      groupName: null,
      teamAName: `Ganador QF-M${i * 2 + 1}`, teamAFlag: '🏳️', teamACode: `SFA${i + 1}`,
      teamBName: `Ganador QF-M${i * 2 + 2}`, teamBFlag: '🏳️', teamBCode: `SFB${i + 1}`,
      date: new Date(i === 0 ? '2026-07-14T20:00:00-05:00' : '2026-07-15T20:00:00-05:00'),
      venue: i === 0 ? 'AT&T Stadium, Dallas' : 'MetLife Stadium, Nueva York',
      city: i === 0 ? 'Dallas' : 'Nueva York',
      status: 'UPCOMING',
      featured: true,
      argentina: false,
    });
  }

  // ─── TERCER PUESTO ─────────────────────────────────────────────
  matches.push({
    id: 'TP-M1',
    phase: 'TERCER_PUESTO',
    groupName: null,
    teamAName: 'Perdedor SF-M1', teamAFlag: '🏳️', teamACode: 'TPA1',
    teamBName: 'Perdedor SF-M2', teamBFlag: '🏳️', teamBCode: 'TPB1',
    date: new Date('2026-07-18T16:00:00-05:00'),
    venue: 'Hard Rock Stadium, Miami',
    city: 'Miami',
    status: 'UPCOMING',
    featured: true,
    argentina: false,
  });

  // ─── FINAL ────────────────────────────────────────────────────
  matches.push({
    id: 'FINAL-M1',
    phase: 'FINAL',
    groupName: null,
    teamAName: 'Ganador SF-M1', teamAFlag: '🏳️', teamACode: 'FINA1',
    teamBName: 'Ganador SF-M2', teamBFlag: '🏳️', teamBCode: 'FINB1',
    date: new Date('2026-07-19T17:00:00-05:00'),
    venue: 'MetLife Stadium, Nueva York / Nueva Jersey',
    city: 'Nueva York',
    status: 'UPCOMING',
    featured: true,
    argentina: false,
  });

  console.log(`📋 Total partidos a insertar: ${matches.length}`);

  // Insertar en la base de datos (upsert para re-ejecutar sin duplicados)
  let inserted = 0;
  for (const match of matches) {
    await prisma.match.upsert({
      where: { id: match.id },
      update: match,
      create: match,
    });
    inserted++;
  }

  console.log(`✅ ${inserted} partidos insertados/actualizados.`);
  console.log(`🇦🇷 Partidos de Argentina: ${matches.filter(m => m.argentina).length}`);
  console.log(`⭐ Partidos destacados: ${matches.filter(m => m.featured).length}`);
}

main()
  .catch(e => { console.error('❌ Error en seed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());

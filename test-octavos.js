const https = require('https');
https.get('https://prode.muchacholoco.com.ar/api/matches', res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const matches = JSON.parse(body);
    const octavos = matches.filter(m => m.phase === 'OCTAVOS');
    octavos.sort((a, b) => new Date(a.date) - new Date(b.date));
    octavos.forEach(m => console.log(`${m.id}: ${m.teamAName} vs ${m.teamBName} (${m.date})`));
  });
});

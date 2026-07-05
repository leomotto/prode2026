const fs = require('fs');
fetch('https://prode.muchacholoco.com.ar/api/matches').then(r=>r.json()).then(matches=>{
    try {
        const activeMatches = matches.filter(m => m.status === 'LIVE' || m.status === 'UPCOMING').sort((a,b) => new Date(a.date) - new Date(b.date));
        if (activeMatches.length > 0 && activeMatches[0].phase) {
          const currentPhase = activeMatches[0].phase;
          console.log("Current Phase:", currentPhase);
        } else {
          console.log("No active matches or phase");
        }
    } catch(e) {
        console.error("ERROR IN LOGIC:", e);
    }
}).catch(e => console.error("FETCH ERROR:", e));

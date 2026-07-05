const { JSDOM } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync('public/matches.html', 'utf-8');
const dom = new JSDOM(html, { runScripts: "dangerously" });
const window = dom.window;

// Mock API and globals
window.Auth = { getUser: () => ({ id: '123' }) };
window.api = {
  matches: { all: () => Promise.resolve(require('./matches.json')) },
  predictions: { mine: () => Promise.resolve([]) }
};
window.Notify = { isOn: () => false };
window.Fmt = { time: (d) => d, date: (d) => d };
window.matchSideClass = () => '';
window.scoreDisp = () => '0-0';
window.matchMeta = () => 'meta';
window.teamCode = (f) => f ? 'XYZ' : '???';
window.escHtml = (s) => s;
window.renderEmojis = () => {};
window.Theme = { isDark: () => false };

window.eval(`
  // Paste necessary functions from matches.html if not evaluated
`);

setTimeout(() => {
  window.loadAll().then(() => {
    console.log("RENDERED HTML LENGTH:", window.document.getElementById('matches-list').innerHTML.length);
    if (window.document.getElementById('matches-list').innerHTML.includes('empty-state')) {
      console.log("EMPTY STATE!");
    } else {
      console.log("SUCCESS!");
    }
  }).catch(e => console.error("FAILED:", e));
}, 500);


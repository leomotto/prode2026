const { JSDOM } = require('jsdom');
const html = require('fs').readFileSync('public/matches.html', 'utf-8');
const dom = new JSDOM(html);
const document = dom.window.document;

const currentPhase = 'DIECISEISAVOS';
const btn = [...document.querySelectorAll('.tab-btn')].find(b => b.getAttribute('onclick') === `setFilter(this,'${currentPhase}')`);
console.log("Found btn:", btn ? btn.outerHTML : "NULL");

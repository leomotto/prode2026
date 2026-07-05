const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  await page.goto('https://prode.muchacholoco.com.ar/matches', { waitUntil: 'networkidle2' });
  const html = await page.content();
  console.log("HTML LENGTH:", html.length);
  if (html.includes('empty-state')) console.log("EMPTY STATE DETECTED!");
  const activeTab = await page.$eval('.tab-btn.active', el => el.textContent);
  console.log("ACTIVE TAB:", activeTab);
  await browser.close();
})();

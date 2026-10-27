const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e))); pg.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await pg.route(/unpkg\.com|fonts\./, r => r.abort());
  await pg.goto('file://' + path.resolve(__dirname, '../index.html'));
  await pg.waitForTimeout(3000);
  const info = await pg.evaluate(() => ({ abx: typeof ABX, parse: !!(window.ABX && ABX.parseCard), ops: Object.keys(ABX.OPS||{}).length, cards: ALL_CARDS.length }));
  console.log(JSON.stringify(info)); console.log('errors:', errs.filter(e=>!/peerjs|Peer|net::/i.test(e)));
  await b.close();
})();

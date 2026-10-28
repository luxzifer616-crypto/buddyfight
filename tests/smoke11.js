// Chromium: the defense window shows Zeitwelg's field [Counter] [Act] as a tile, and clicking it ends the battle.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(String(e))); pg.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await pg.route(/unpkg\.com|fonts\./, r => r.abort());
  await pg.goto('file://' + path.resolve(__dirname, '../index.html'));
  await pg.waitForTimeout(2500);
  await pg.evaluate(() => app.startBattle('hotseat'));
  await pg.waitForTimeout(2500);
  const r = await pg.evaluate(() => {
    const mku = (card) => ({ card, rested:false, attacksLeft:1, soul:[], tempPower:0, tempDef:0, tempCrit:0 });
    [battle.plr, battle.opp].forEach(f => { ['left','center','right'].forEach(p => f.monsters[p] = null); f.hand = []; f.isBot = false; });
    battle.activeSide = 'opp'; battle.phase = 'attack'; battle.turnCount = 4;
    battle.plr.gauge = battle.plr.deck.splice(0, 3);
    battle.plr.monsters.left = mku(CARD_MAP.get(6046)); battle.plr.monsters.center = mku(CARD_MAP.get(5955));
    battle.opp.monsters.center = mku(Object.assign({}, CARD_MAP.get(5937), { power: 99000 }));
    battle.renderBattle();
    battle.initiateAttackWithDefenseCheck('opp', ['center'], 'center');
    const modal = document.getElementById('defense-prompt-modal');
    const tiles = [...document.querySelectorAll('#def-cards-list .def-option-card')].map(t => t.textContent.replace(/\s+/g, ' ').trim());
    return { open: !modal.classList.contains('hidden'), tiles, gauge: battle.plr.gauge.length };
  });
  console.log(JSON.stringify(r));
  await pg.screenshot({ path: process.argv[2] || 'defense.png' });
  await pg.click('#def-cards-list .def-option-card >> nth=0');
  await pg.waitForTimeout(1500);
  const after = await pg.evaluate(() => ({ gauge: battle.plr.gauge.length, dragod: !!battle.plr.monsters.center, life: battle.plr.life, modalHidden: document.getElementById('defense-prompt-modal').classList.contains('hidden') }));
  console.log(JSON.stringify(after));
  console.log('errors:', errs.filter(e => !/peerjs|Peer|net::/i.test(e)));
  await b.close();
})();

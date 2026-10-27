// Per-card sweep: run every ABX-executable enter/act ability against a live battle; assert no exception + card conservation.
const { createEnv } = require("./headless.js");
const env = createEnv(); const { run, flush } = env;
run(`ABX.fast=true; ABX.autoPlay=true; ABX.debug=false; globalThis.__errs=[];`);
const ids = JSON.parse(run(`JSON.stringify(ALL_CARDS.filter(c=>c.type==='Monster'||c.type==='Item'||c.type==='Spell').filter(c=>{const p=ABX.get(c);return p.abilities.some(a=>ABX.isExecutable(a)&&((a.trigger&&a.trigger.event==='enter'&&a.trigger.self)||a.kind==='act'));}).map(c=>c.id))`));
console.log("cards with executable enter/act abilities:", ids.length);
const chunk = 300; let bad = [], tested = 0, drew = 0;
(async () => {
  for (const id of ids) {
    const res = run(`(async function(){
      const c = CARD_MAP.get(${id});
      battle.start('hotseat', generateFlagDeck(447,'T',571,true), generateFlagDeck(447,'O',571,true));
      const me=battle.plr, op=battle.opp;
      op.drop = op.deck.splice(0,6); me.drop = me.deck.splice(0,6); me.gauge = me.deck.splice(0,4); op.gauge = op.deck.splice(0,3);
      op.monsters.center = { card: CARD_MAP.get(me.deck[0]) && CARD_MAP.get(me.deck[0]).type==='Monster' ? CARD_MAP.get(me.deck[0]) : c, rested:false, attacksLeft:1, soul:[], tempPower:0,tempDef:0,tempCrit:0 };
      const total = () => [me,op].reduce((n,f)=> n + f.deck.length+f.hand.length+f.drop.length+f.gauge.length+(f.setSpells||[]).length + ['left','center','right'].reduce((k,p)=>k+(f.monsters[p]?1+f.monsters[p].soul.length:0),0) + (f.item?1+(f.item.soul||[]).length:0),0);
      const u = c.type==='Monster' ? { card:c, rested:false, attacksLeft:1, soul:[], tempPower:0,tempDef:0,tempCrit:0, actUsed:false } : null;
      if (u) me.monsters.left = u;
      const t0 = total();
      const p = ABX.get(c);
      for (const ab of p.abilities) {
        if (!ABX.isExecutable(ab)) continue;
        if (ab.trigger && ab.trigger.event==='enter' && ab.trigger.self) await ABX.runAbility('plr', c, ab, u, {auto:true, event:{name:'enter'}});
        else if (ab.kind==='act') await ABX.runAbility('plr', c, ab, u, {auto:true, event:{name:'act'}});
      }
      globalThis.__total = total;
      return { id:${id}, name:c.name, t0, hand: me.hand.length };
    })().catch(e=>({id:${id}, err:String(e&&e.stack||e).slice(0,300)}))`);
    const r = await res; await flush(); r.t1 = r.err ? 0 : run('__total()'); tested++;
    if (r.err) bad.push(r); else if (r.t1 !== r.t0 && !/search|draw/.test("")) bad.push(Object.assign({kind:"count"}, r));
  }
  console.log("tested", tested, "problems", bad.length);
  const errs = bad.filter(b=>b.err), cnt = bad.filter(b=>!b.err);
  console.log("exceptions:", errs.length); errs.slice(0,8).forEach(b=>console.log(" ", b.id, b.err));
  console.log("count changes (cards created/lost; draws & decklist moves are conservative so these are suspects):", cnt.length); cnt.slice(0,15).forEach(b=>console.log(" ", b.id, b.name, b.t0, "->", b.t1));
})();

// Online cut-in sync test: our cut-ins are sent to the friend (names flipped); the friend's cut-ins are shown safely.
const { createEnv } = require("./headless");
const env = createEnv();
const { run, sandbox } = env;
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };

run(`
  window.__sent = [];
  app.peerConn = { open: true, send: (m) => window.__sent.push(m) };
  battle.mode = "online_p2p";
  battle.opp = { name: "🌐 Online Friend" };
  battle.plr = { name: "You" };
  window.__shown = [];
  const orig = battle.showCutin.bind(battle);
  battle.showCutin = function (t, s, i) { window.__shown.push([t, s, i, !!this._cutinFromPeer]); return orig(t, s, i); };
`);

// 1. local cut-in is sent, names flipped
run(`battle.showCutin("COUNTER — DEFENSE!", "🌐 Online Friend cast Foo!", "CardSprite/n1.png")`);
let m = sandbox.__sent[0];
ok(m && m.type === "P2P_CUTIN", "local cut-in sends P2P_CUTIN");
ok(m && m.sub === "You cast Foo!", "friend's name becomes 'You' for the receiver: " + (m && m.sub));
run(`battle.showCutin("CAST!", "Your Youth card", "CardSprite/n1.png")`);
ok(sandbox.__sent[1].sub === "Your Youth card", "'Your'/'Youth' not flipped");
run(`battle.showCutin("X", "You cast Bar", "")`);
ok(sandbox.__sent[2].sub === "🌐 Online Friend cast Bar", "'You' becomes friend's name: " + sandbox.__sent[2].sub);

// 2. receiving: needs the battle screen to be active; record what the banner gets
sandbox.__texts = {};
const origDoc = sandbox.document;
sandbox.document = new Proxy(origDoc, { get: (t, p) => {
  if (p === "getElementById") return (id) => {
    if (id === "screen-battle") return { classList: { contains: () => true } };
    const el = t.getElementById(id);
    return new Proxy(el, { set: (tt, k, v) => { if (k === "textContent" || k === "src") sandbox.__texts[id + "." + String(k)] = v; return Reflect.set(tt, k, v); } });
  };
  return t[p];
} });
const before = sandbox.__sent.length;
run(`battle.receiveCutinFromPeer({ type: "P2P_CUTIN", title: "CAST!", sub: "🌐 Online Friend cast Baz!", imgSrc: "CardSprite/n2.png" })`);
ok(sandbox.__sent.length === before, "received cut-in is not echoed back");
ok(sandbox.__texts["cutin-title.textContent"] === "CAST!" && sandbox.__texts["cutin-sub.textContent"] === "🌐 Online Friend cast Baz!", "friend's cut-in text shown on our screen");
ok(sandbox.__texts["cutin-card-img.src"] === "CardSprite/n2.png", "local image used");
run(`battle.receiveCutinFromPeer({ title: "T", sub: "S", imgSrc: "http://evil.example/x.png" })`);
ok(sandbox.__texts["cutin-card-img.src"] === "Sprite/Sleeves/s0.png", "outside image rejected: " + sandbox.__texts["cutin-card-img.src"]);
run(`battle.receiveCutinFromPeer({ title: "T", sub: "S", imgSrc: "Sprite/../secret.png" })`);
ok(sandbox.__texts["cutin-card-img.src"] === "Sprite/Sleeves/s0.png", "path traversal rejected");
run(`battle.mode = "bot"; battle.receiveCutinFromPeer({ title: "NO", sub: "NO" })`);
ok(sandbox.__texts["cutin-title.textContent"] === "T", "ignored when not in an online match");

// 3. a cut-in after receiving still sends again (flag was reset)
run(`battle.mode = "online_p2p"`);
const n = sandbox.__sent.length;
run(`battle.showCutin("A", "B", "")`);
ok(sandbox.__sent.length === n + 1, "flag reset: next local cut-in is sent");

// 4. hotseat / bot: nothing is sent
run(`battle.mode = "hotseat"`);
const k = sandbox.__sent.length;
run(`battle.showCutin("A", "B", "")`);
ok(sandbox.__sent.length === k, "hotseat does not send");

// 5. ABX ability announce
run(`battle.mode = "online_p2p"`);
const a0 = sandbox.__shown ? sandbox.__shown.length : 0;
const r = run(`(function(){ const c = ALL_CARDS.find(c => window.ABX && ABX.actAbilities(c).length); return c ? c.id : 0; })()`);
ok(r > 0, "found a card with an ABX [Act] ability: " + r);
console.log(fail ? "FAILED " + fail : "ALL PASSED");
process.exit(fail ? 1 : 0);

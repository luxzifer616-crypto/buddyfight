// Online room safety: one friend per room, a second hello doesn't restart the match,
// join errors after connecting don't show "Could not join", and state-sync cut-ins aren't echoed.
const { createEnv } = require("./headless");
const env = createEnv();
const { run, sandbox } = env;
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL:", m); } else console.log("ok:", m); };

// Fake PeerJS: records handlers so the test can fire events.
run(`
  window.__peers = [];
  window.Peer = function (id) { this.id = id; this.h = {}; this.on = (e, f) => { this.h[e] = f; }; this.destroy = () => { this.destroyed = true; };
    this.connect = (target) => makeConn(); window.__peers.push(this); };
  window.makeConn = function () { const c = { h: {}, open: false, sent: [], closed: false };
    c.on = (e, f) => { c.h[e] = f; }; c.send = (m) => c.sent.push(m); c.close = () => { c.closed = true; c.open = false; };
    c.fire = (e, a) => c.h[e] && c.h[e](a); return c; };
  app.getIceServers = async () => [];
  window.__starts = [];
  app.startBattle = function (mode, deck) { window.__starts.push(mode); battle.mode = mode; battle.matchOver = false; window.__battleActive = true; };
  app.closeRoomModal = () => {};
`);
// screen-battle "active" follows __battleActive
const origDoc = sandbox.document;
const joinInput = { value: "" };
sandbox.document = new Proxy(origDoc, { get: (t, p) => {
  if (p === "getElementById") return (id) => id === "screen-battle"
    ? { classList: { contains: () => !!sandbox.__battleActive, add() {}, remove() {} } }
    : id === "join-room-input" ? joinInput
    : t.getElementById(id);
  return t[p];
} });

(async () => {
  // --- Host side ---
  await run(`app.createMultiplayerRoom()`);
  const hostPeer = () => run(`window.__peers[window.__peers.length - 1]`);
  run(`window.__c1 = makeConn(); window.__peers[0].h.connection(window.__c1); window.__c1.open = true; window.__c1.fire("open");`);
  run(`window.__c1.fire("data", { type: "P2P_HELLO_JOIN", guestDeck: app.state.decks[0] })`);
  ok(sandbox.__starts.length === 1, "first friend starts the match");

  run(`window.__c2 = makeConn(); window.__peers[0].h.connection(window.__c2); window.__c2.open = true; window.__c2.fire("open");`);
  ok(run(`app.peerConn === window.__c1`), "second joiner does not replace the current friend");
  ok(run(`window.__c2.closed`), "second joiner is turned away");
  run(`window.__c2.fire("data", { type: "P2P_HELLO_JOIN", guestDeck: app.state.decks[0] })`);
  ok(sandbox.__starts.length === 1, "second joiner's hello is ignored");

  run(`window.__c1.sent.length = 0; window.__c1.fire("data", { type: "P2P_HELLO_JOIN", guestDeck: app.state.decks[0] })`);
  ok(sandbox.__starts.length === 1, "repeated hello from the friend does not restart the match");
  ok(run(`window.__c1.sent.some(m => m.type === "P2P_STATE_SYNC")`), "repeated hello gets the current board");

  run(`window.__c2.fire("close")`);
  ok(run(`app.peerConn === window.__c1`), "a turned-away connection closing doesn't drop the friend");

  // --- Guest side ---
  sandbox.__battleActive = false;
  sandbox.__alerts = [];
  joinInput.value = "BF-1234";
  await run(`app.joinMultiplayerRoom()`);
  run(`window.__gp = window.__peers[window.__peers.length - 1]; window.__gp.h.open(); app.peerConn.open = true; app.peerConn.fire("open");`);
  ok(run(`app.peerConn.sent.some(m => m.type === "P2P_HELLO_JOIN")`), "guest says hello once connected");
  run(`battle.mode = "online_p2p"; window.__gp.h.error({ type: "network" })`);
  ok(!(sandbox.__alerts || []).some(a => /Could not join/.test(a)), "network error mid-match does not say 'Could not join'");
  ok(sandbox.__starts.length === 1, "network error mid-match does not start a local battle");

  // Before connecting, a join error still reports the failure.
  sandbox.__alerts = [];
  joinInput.value = "BF-9999";
  await run(`app.joinMultiplayerRoom()`);
  run(`window.__peers[window.__peers.length - 1].h.error({ type: "peer-unavailable" })`);
  ok((sandbox.__alerts || []).some(a => /Could not join/.test(a)), "failed join still shows 'Could not join'");

  // --- State-sync cut-in is not echoed back ---
  sandbox.__battleActive = true;
  run(`window.__sent = []; app.peerConn = { open: true, send: (m) => window.__sent.push(m) }; battle.mode = "online_p2p"; battle.renderBattle = () => {}; battle.checkWinCondition = () => {};`);
  run(`battle.receiveOnlineStateFromPeer({ turnCount: 2, activeSideForReceiver: "opp", senderPlr: JSON.parse(JSON.stringify(battle.plr || {})), senderOpp: JSON.parse(JSON.stringify(battle.opp || {})), cutin: { title: "T", sub: "S", imgSrc: "http://evil.example/x.png" } })`);
  ok(!run(`window.__sent.some(m => m.type === "P2P_CUTIN")`), "cut-in inside a state sync is not echoed back");

  console.log(fail ? "FAILED " + fail : "ALL PASSED");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log("ERROR", e && e.stack || e); process.exit(1); });

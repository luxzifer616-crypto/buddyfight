/* ==================== BATTLE FX (28 Oct 2026) ====================
 * Visual layer for the battle screen only. It never changes game state:
 * after every battle.renderBattle() it reads life / gauge / phase / turn and
 * sets CSS variables + classes, and pops "-2" / "+1" numbers when they change.
 */
(function () {
  if (typeof battle === "undefined" || !battle || typeof battle.renderBattle !== "function") return;

  const PHASES = ["start", "main", "attack", "final"];
  const prev = { fighters: null, plr: null, opp: null };
  const reduceMotion = (() => {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
  })();

  function hudFor(side) {
    return document.querySelector(side === "plr" ? "#screen-battle .plr-hud" : "#screen-battle .opp-hud");
  }

  function popNumber(hud, text, kind) {
    if (!hud || reduceMotion) return;
    const el = document.createElement("div");
    el.className = "fx-pop fx-pop-" + kind;
    el.textContent = text;
    hud.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  function flash(hud, cls) {
    if (!hud) return;
    hud.classList.remove(cls);
    void hud.offsetWidth; // restart the animation
    hud.classList.add(cls);
    setTimeout(() => hud.classList.remove(cls), 900);
  }

  function updateSide(side, f) {
    const hud = hudFor(side);
    if (!hud || !f) return;
    const life = Number(f.life) || 0;
    const gauge = (f.gauge && f.gauge.length) || 0;

    hud.style.setProperty("--life-pct", Math.max(0, Math.min(1, life / 10)));
    hud.style.setProperty("--gauge-pct", Math.max(0, Math.min(1, gauge / 10)));
    // Heart beats faster when life is low
    const beat = life >= 7 ? 1.15 : life >= 4 ? 0.85 : 0.55;
    hud.style.setProperty("--beat", beat + "s");
    hud.dataset.lifeTier = life >= 7 ? "high" : life >= 4 ? "mid" : "low";

    const p = prev[side];
    if (p) {
      if (life < p.life) { popNumber(hud, "−" + (p.life - life), "dmg"); flash(hud, "fx-hit"); }
      else if (life > p.life) { popNumber(hud, "+" + (life - p.life), "heal"); flash(hud, "fx-heal"); }
      if (gauge > p.gauge) { popNumber(hud, "⚡+" + (gauge - p.gauge), "gauge"); flash(hud, "fx-charge"); }
    }
    prev[side] = { life, gauge };
  }

  function updateFx() {
    const scr = document.getElementById("screen-battle");
    if (!scr || !battle.plr || !battle.opp) return;

    // New match → forget the old numbers so we don't pop "-0/+8"
    if (prev.fighters !== battle.plr) { prev.fighters = battle.plr; prev.plr = null; prev.opp = null; }

    updateSide("plr", battle.plr);
    updateSide("opp", battle.opp);

    const active = battle.activeSide === "plr" ? "plr" : "opp";
    const plrHud = hudFor("plr"), oppHud = hudFor("opp");
    if (plrHud) plrHud.classList.toggle("fx-active-turn", active === "plr");
    if (oppHud) oppHud.classList.toggle("fx-active-turn", active === "opp");
    scr.dataset.activeSide = active;
    scr.dataset.phase = battle.phase || "";

    const idx = Math.max(0, PHASES.indexOf(battle.phase));
    const steps = scr.querySelector(".phase-steps");
    if (steps) steps.style.setProperty("--phase-progress", idx / (PHASES.length - 1));
    PHASES.forEach((ph, i) => {
      const el = document.getElementById("ph-" + ph);
      if (el) el.classList.toggle("fx-done", i < idx);
    });
  }

  const original = battle.renderBattle;
  battle.renderBattle = function () {
    const r = original.apply(this, arguments);
    try { updateFx(); } catch (e) { /* visuals must never break the game */ }
    return r;
  };
  window.BattleFX = { update: updateFx };
})();

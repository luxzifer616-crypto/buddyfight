/* ==================== ABX UI ====================
 * Small self-contained popups used by the ability engine:
 *   ABX.ui.pickCards({title, subtitle, cards:[{card, badge}], min, max, ordered})  -> Promise<number[]>  (chosen indexes, in pick order)
 *   ABX.ui.confirm({title, text, card, yes, no})                                  -> Promise<boolean>
 *   ABX.ui.pickOption({title, options:[{label, sub}]})                            -> Promise<number>
 * Tests (and bots) can replace them through ABX.hooks.pickCards / confirm / pickOption.
 */
(function (root) {
  "use strict";
  const ABX = root.ABX || (root.ABX = {});
  ABX.hooks = ABX.hooks || { pickCards: null, confirm: null, pickOption: null };
  const ui = (ABX.ui = ABX.ui || {});

  const hasDom = () => typeof document !== "undefined" && document && typeof document.createElement === "function" && root.__ABX_NO_DOM__ !== true;

  function ensureStyle() {
    if (!hasDom() || ABX._styleDone) return;
    ABX._styleDone = true;
    try {
      const st = document.createElement("style");
      st.textContent = `
      .abx-ov{position:fixed;inset:0;background:rgba(5,8,20,.78);z-index:100000;display:flex;align-items:center;justify-content:center;padding:12px;font-family:inherit}
      .abx-box{background:#14182c;color:#eef1ff;border:2px solid #f5c542;border-radius:14px;max-width:min(960px,96vw);max-height:92vh;overflow:auto;padding:16px 18px;box-shadow:0 10px 40px rgba(0,0,0,.6)}
      .abx-title{font-size:1.1rem;font-weight:800;color:#f5c542;margin:0 0 4px}
      .abx-sub{font-size:.9rem;opacity:.9;margin:0 0 10px;white-space:pre-line}
      .abx-grid{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:8px 0}
      .abx-tile{width:92px;cursor:pointer;border:2px solid transparent;border-radius:8px;padding:3px;background:#1f2542;position:relative;text-align:center}
      .abx-tile img{width:100%;border-radius:5px;display:block}
      .abx-tile .abx-n{position:absolute;top:2px;left:2px;background:#f5c542;color:#111;font-weight:800;border-radius:10px;padding:0 7px;font-size:.8rem;display:none}
      .abx-tile.sel{border-color:#f5c542;box-shadow:0 0 10px #f5c542}
      .abx-tile.sel .abx-n{display:block}
      .abx-tile .abx-nm{font-size:.68rem;line-height:1.1;margin-top:2px;max-height:2.4em;overflow:hidden}
      .abx-tile .abx-bd{font-size:.65rem;opacity:.8}
      .abx-row{display:flex;gap:10px;justify-content:center;margin-top:10px;flex-wrap:wrap}
      .abx-btn{background:#f5c542;color:#111;border:none;border-radius:8px;padding:9px 18px;font-weight:800;cursor:pointer;font-size:.95rem}
      .abx-btn.sec{background:#38406a;color:#eef1ff}
      .abx-btn:disabled{opacity:.4;cursor:not-allowed}
      .abx-cardimg{width:110px;float:left;margin:0 12px 6px 0;border-radius:6px}
      `;
      document.head && document.head.appendChild && document.head.appendChild(st);
    } catch (e) { /* ignore */ }
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  function overlay(inner) {
    ensureStyle();
    const ov = document.createElement("div");
    ov.className = "abx-ov";
    const box = document.createElement("div");
    box.className = "abx-box";
    ov.appendChild(box);
    box.innerHTML = inner;
    document.body.appendChild(ov);
    return { ov, box };
  }

  /* ---------- confirm ---------- */
  ui.confirm = function (o) {
    if (ABX.hooks.confirm) return Promise.resolve(ABX.hooks.confirm(o));
    if (!hasDom()) return Promise.resolve(true);
    return new Promise((resolve) => {
      const card = o.card;
      const { ov, box } = overlay(
        `<div class="abx-title">${esc(o.title || "Use ability?")}</div>` +
        (card && card.img ? `<img class="abx-cardimg" src="${esc(card.img)}" alt="">` : "") +
        `<div class="abx-sub">${esc(o.text || "")}</div><div style="clear:both"></div>` +
        `<div class="abx-row"><button class="abx-btn" data-y>${esc(o.yes || "✨ Yes")}</button><button class="abx-btn sec" data-n>${esc(o.no || "No / Skip")}</button></div>`
      );
      const done = (v) => { try { ov.remove(); } catch (e) { /* ignore */ } resolve(v); };
      box.querySelector("[data-y]").onclick = () => done(true);
      box.querySelector("[data-n]").onclick = () => done(false);
    });
  };

  /* ---------- pick cards (multi, ordered) ---------- */
  ui.pickCards = function (o) {
    const list = o.cards || [];
    const min = Math.max(0, o.min == null ? 1 : o.min);
    const max = Math.min(list.length, o.max == null ? 1 : o.max);
    if (ABX.hooks.pickCards) return Promise.resolve(ABX.hooks.pickCards(o));
    if (!hasDom()) return Promise.resolve(list.slice(0, Math.max(min, Math.min(max, 1))).map((_, i) => i));
    return new Promise((resolve) => {
      const picked = [];
      const tiles = list.map((it, i) => {
        const c = it.card || {};
        return `<div class="abx-tile" data-i="${i}"><span class="abx-n"></span><img src="${esc(c.img || "Sprite/Sleeves/s0.png")}" alt=""><div class="abx-nm">${esc(c.name || "?")}</div>${it.badge ? `<div class="abx-bd">${esc(it.badge)}</div>` : ""}</div>`;
      }).join("");
      const { ov, box } = overlay(
        `<div class="abx-title">${esc(o.title || "Choose cards")}</div>` +
        `<div class="abx-sub">${esc(o.subtitle || "")}${max > 1 ? `\nSelect ${min === max ? max : `${min}–${max}`} card(s)${o.ordered ? " in the order you want" : ""}.` : ""}</div>` +
        `<div class="abx-grid">${tiles}</div>` +
        `<div class="abx-row"><button class="abx-btn" data-ok>Confirm</button>${min === 0 ? `<button class="abx-btn sec" data-skip>Choose none</button>` : ""}</div>`
      );
      const okBtn = box.querySelector("[data-ok]");
      const refresh = () => {
        box.querySelectorAll(".abx-tile").forEach(t => {
          const idx = picked.indexOf(+t.getAttribute("data-i"));
          t.classList.toggle("sel", idx >= 0);
          const n = t.querySelector(".abx-n"); if (n) n.textContent = idx >= 0 ? String(idx + 1) : "";
        });
        okBtn.disabled = picked.length < min || picked.length > max;
      };
      box.querySelectorAll(".abx-tile").forEach(t => {
        t.onclick = () => {
          const i = +t.getAttribute("data-i");
          const at = picked.indexOf(i);
          if (at >= 0) picked.splice(at, 1);
          else if (max === 1) { picked.length = 0; picked.push(i); }
          else if (picked.length < max) picked.push(i);
          refresh();
        };
      });
      const done = (v) => { try { ov.remove(); } catch (e) { /* ignore */ } resolve(v); };
      okBtn.onclick = () => done(picked.slice());
      const sk = box.querySelector("[data-skip]"); if (sk) sk.onclick = () => done([]);
      refresh();
    });
  };

  /* ---------- pick one option (modal abilities) ---------- */
  ui.pickOption = function (o) {
    if (ABX.hooks.pickOption) return Promise.resolve(ABX.hooks.pickOption(o));
    if (!hasDom()) return Promise.resolve(0);
    return new Promise((resolve) => {
      const opts = (o.options || []).map((op, i) => `<button class="abx-btn sec" style="display:block;width:100%;margin:6px 0;text-align:left" data-i="${i}">${esc(op.label)}${op.sub ? `<div style="font-weight:400;font-size:.8rem;opacity:.85">${esc(op.sub)}</div>` : ""}</button>`).join("");
      const { ov, box } = overlay(`<div class="abx-title">${esc(o.title || "Choose one")}</div><div class="abx-sub">${esc(o.subtitle || "")}</div>${opts}${o.allowNone ? `<div class="abx-row"><button class="abx-btn sec" data-none>Cancel</button></div>` : ""}`);
      const done = (v) => { try { ov.remove(); } catch (e) { /* ignore */ } resolve(v); };
      box.querySelectorAll("button[data-i]").forEach(b => { b.onclick = () => done(+b.getAttribute("data-i")); });
      const nb = box.querySelector("[data-none]"); if (nb) nb.onclick = () => done(-1);
    });
  };

  root.ABX = ABX;
})(typeof window !== "undefined" ? window : globalThis);

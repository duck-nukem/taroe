window.Taroe = window.Taroe || {};

(function (T) {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const CARD_RATIO = 1.72; // height / width of the RWS scans
  const DIFFICULTY = {
    easier: { label: 'Easier', blurb: '+1 card each level' },
    normal: { label: 'Normal', blurb: '+2 cards each level' },
    hard: { label: 'Hard', blurb: '+3 cards each level' },
  };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  class UI {
    constructor(settings) {
      this.settings = settings;
      this.slotEls = [];
      this.slotKey = null;
      this.paneEls = new Map();
      this.paneKey = null;
      this.timer = null;
      this.modalResolve = null;
    }

    attach(game) {
      this.game = game;
      game.on((type, data) => this.onEvent(type, data));

      $('#btn-play').addEventListener('click', () => game.play());
      $('#btn-clear').addEventListener('click', () => {
        if (game.phase !== 'recall') return;
        game.clearPlaced();
        this.renderTable();
      });
      $('#btn-ready').addEventListener('click', () => game.finishMemorize());
      $('#btn-tutorial').addEventListener('click', () => T.openPalaceTutorial(this));
      $('#btn-settings').addEventListener('click', () => this.openSettings());
      $('#btn-help').addEventListener('click', () => this.openHelp());
      $('#modal').addEventListener('click', (e) => {
        if (e.target.id === 'modal') this.closeModal(null);
      });
      document.addEventListener('keydown', (e) => this.onKey(e));
      window.addEventListener('resize', () => {
        this.layoutSlots();
        this.layoutPane();
      });

      this.renderAll();
    }

    // ---- events -------------------------------------------------------------

    onEvent(type, data) {
      if (type === 'phase') {
        this.renderAll();
        if (data === 'memorize') this.startTimer();
        if (data === 'victory') T.confetti($('#confetti'));
      } else if (type === 'placed') {
        this.renderTable();
      } else if (type === 'twist') {
        this.onTwist(data);
      } else if (type === 'miss') {
        this.onMiss(data);
      } else if (type === 'shop') {
        this.renderHud();
        this.renderStage();
      }
    }

    onMiss({ kind, cancelled, note, lost }) {
      const slots = $('#slots');
      slots.classList.remove('shake');
      void slots.offsetWidth;
      slots.classList.add('shake');
      let msg =
        kind === 'cards'
          ? 'A stranger is in your spread — or someone is missing. −1 hand.'
          : 'Right cards, wrong order. −1 strike.';
      if (cancelled) msg = `${kind === 'cards' ? 'Wrong cards' : 'Wrong order'} — ${note || 'forgiven.'}`;
      this.toast(msg, cancelled ? 'info' : 'bad');
      if (!lost) this.renderAll();
    }

    onKey(e) {
      const g = this.game;
      if (e.target.matches('input, textarea')) return;
      if (e.key === 'Escape' && !$('#modal').hidden) return this.closeModal(null);
      if (!$('#modal').hidden) return;
      if (e.key === 'Enter') {
        if (g.phase === 'recall') g.play();
        else if (g.phase === 'roundWon') g.openShop();
        else if (g.phase === 'title') g.restart();
        else if (g.phase === 'bossIntro') g.faceBoss();
        else return;
      } else if (e.key === 'Backspace' && g.phase === 'recall') {
        g.undo();
      } else if (e.key === ' ' && g.phase === 'memorize') {
        g.finishMemorize();
      } else return;
      e.preventDefault();
    }

    // ---- rendering ------------------------------------------------------------

    renderAll() {
      this.renderHud();
      this.renderRelics();
      this.renderTable();
      this.renderStage();
    }

    renderTable() {
      this.renderBanner();
      this.renderSlots();
      this.renderPane();
    }

    renderHud() {
      const g = this.game;
      const r = g.round;
      $('#level').textContent = g.level;
      const until = g.levelsUntilBoss();
      $('#level-sub').textContent = `${r ? g.sequence.length : g.targetLength()} of ${g.deck.length} cards`;
      $('#boss-sub').textContent = until === 0 ? (r && r.boss ? `${r.boss.icon} ${r.boss.name}` : 'Boss level') : `Boss in ${until}`;
      $('#boss-sub').classList.toggle('now', until === 0);
      $('#hands').innerHTML = this.pips(r ? r.hands : g.stat('hands'), r ? r.maxHands : g.stat('hands'));
      $('#strikes').innerHTML = this.pips(r ? r.strikes : g.stat('strikes'), r ? r.maxStrikes : g.stat('strikes'));
      $('#hands-n').textContent = r ? r.hands : g.stat('hands');
      $('#strikes-n').textContent = r ? r.strikes : g.stat('strikes');
      $('#money').textContent = `$${g.money}`;
      $('#mode-tag').textContent = `${DIFFICULTY[g.difficulty].label} · ${g.mode === 'normal' ? 'Growing chain' : 'Fresh spreads'}`;
      $('#table').dataset.boss = r && r.boss && g.phase !== 'title' ? r.boss.id : '';
    }

    pips(n, max) {
      let s = '';
      for (let i = 0; i < max; i++) s += `<i class="${i < n ? 'on' : ''}"></i>`;
      return s;
    }

    renderRelics() {
      const items = this.game.ownedItems();
      $('#relics').innerHTML = items.length
        ? items
            .map(
              ({ def, stacks }) => `
          <div class="relic" title="${esc(def.name)} — ${esc(T.Items.describe(def, stacks))}">
            <span class="relic-icon">${def.icon}</span>
            <span class="relic-name">${esc(def.name)}</span>
            ${stacks > 1 ? `<span class="relic-stacks">×${stacks}</span>` : ''}
          </div>`
            )
            .join('')
        : '<p class="empty">None yet. Win a round, visit the shop.</p>';
    }

    renderBanner() {
      const g = this.game;
      const r = g.round;
      const banner = $('#banner');
      banner.dataset.phase = g.phase;
      const title = $('#banner-title');
      const sub = $('#banner-sub');
      const boss = r && r.boss;
      if (g.phase === 'memorize') {
        title.textContent = r.twisted ? 'Memorize the new order' : 'Memorize';
        sub.textContent = `Level ${g.level} · ${g.sequence.length} cards${boss ? ` · Boss: ${boss.name}` : ''} · Space when ready`;
      } else if (g.phase === 'twist') {
        title.textContent = `${boss.icon} ${boss.name}`;
        sub.textContent = boss.twistText;
      } else if (g.phase === 'recall') {
        const filled = r.placed.filter((x) => x != null).length;
        title.textContent = 'Recall';
        const hint = boss && boss.recallHint ? boss.recallHint : 'Lay the cards back in their order';
        sub.textContent = `${hint} · ${filled}/${r.placed.length} · Enter to play, Backspace to undo`;
      } else if (g.phase === 'roundWon' || g.phase === 'victory') {
        title.textContent = 'Remembered';
        sub.textContent = `Level ${g.level} cleared`;
      } else if (g.phase === 'gameOver') {
        title.textContent = 'Forgotten';
        sub.textContent = 'This was the spread';
      } else {
        title.textContent = '';
        sub.textContent = '';
      }
      $('#btn-ready').hidden = g.phase !== 'memorize';
      $('#timer').hidden = g.phase !== 'memorize';
    }

    // Slots: the spread on the table. Elements persist within a level so flips animate.
    renderSlots({ deal = true } = {}) {
      const g = this.game;
      const r = g.round;
      const host = $('#slots');
      if (!r) {
        host.innerHTML = '';
        this.slotEls = [];
        this.slotKey = null;
        return;
      }
      const key = `${g.runId}:${g.level}:${r.version}`;
      if (key !== this.slotKey) {
        this.slotKey = key;
        host.innerHTML = '';
        this.slotEls = g.sequence.map((_, i) => {
          const el = document.createElement('div');
          el.className = deal ? 'slot dealing' : 'slot';
          el.style.setProperty('--i', i);
          el.innerHTML = `
            <div class="card3d">
              <div class="face front"><img alt="" draggable="false"></div>
              <div class="face back"></div>
            </div>
            <div class="slot-label"><span class="num">${i + 1}</span><span class="locus"></span></div>`;
          el.addEventListener('click', () => g.unplace(i));
          el.addEventListener('animationend', () => el.classList.remove('dealing'), { once: true });
          host.appendChild(el);
          return el;
        });
        this.layoutSlots();
      }

      const showTruth = g.phase !== 'recall';
      const faceDown = g.phase === 'twist' && !r.boss.faceUp;
      this.slotEls.forEach((el, i) => {
        const id = showTruth ? g.sequence[i] : r.placed[i];
        const img = el.querySelector('img');
        if (id != null && img.dataset.id !== String(id)) {
          const card = T.cardById(id);
          img.src = card.img;
          img.alt = card.name;
          img.dataset.id = id;
        }
        const revealed = g.phase === 'recall' && r.revealed.has(i);
        el.classList.toggle('up', id != null && !faceDown);
        el.classList.toggle('revealed', revealed);
        el.classList.toggle('guess', g.phase === 'recall' && id != null && !revealed);
        el.classList.toggle('won', g.phase === 'roundWon' || g.phase === 'victory');
        el.classList.toggle('lost', g.phase === 'gameOver');
        el.classList.toggle('next', g.phase === 'recall' && r.placed.indexOf(null) === i);
        el.querySelector('.locus').textContent = this.settings.palace ? this.settings.loci[i] || '' : '';
      });
    }

    layoutSlots() {
      const host = $('#slots');
      const n = this.slotEls.length;
      if (!n) return;
      const box = $('#spread').getBoundingClientRect();
      const gap = 14;
      const labelH = 34;
      let best = { cw: 0, perRow: n };
      for (let rows = 1; rows <= 6; rows++) {
        const perRow = Math.ceil(n / rows);
        const byW = (box.width - 24 - (perRow - 1) * gap) / perRow;
        const byH = ((box.height - 24 - (rows - 1) * gap) / rows - labelH) / CARD_RATIO;
        const cw = Math.min(byW, byH, 168);
        if (cw > best.cw) best = { cw, perRow };
      }
      host.style.setProperty('--cw', `${Math.floor(best.cw)}px`);
      host.style.maxWidth = `${best.perRow * (Math.floor(best.cw) + gap)}px`;
    }

    // Pane: every card still in the deck, to pick from during recall.
    renderPane() {
      const g = this.game;
      const pane = $('#pane');
      const host = $('#pane-cards');
      const r = g.round;
      const key = g.deck.join(',');
      if (key !== this.paneKey) {
        this.paneKey = key;
        host.innerHTML = '';
        this.paneEls.clear();
        for (const id of g.deck) {
          const card = T.cardById(id);
          const el = document.createElement('button');
          el.className = 'pcard';
          el.title = `${card.numeral} · ${card.name}`;
          el.innerHTML = `<img src="${card.img}" alt="${esc(card.name)}" draggable="false"><span class="mark">✦</span>`;
          el.addEventListener('click', () => g.place(id));
          host.appendChild(el);
          this.paneEls.set(id, el);
        }
        this.layoutPane();
      }

      const active = g.phase === 'recall';
      pane.classList.toggle('veiled', !active);
      $('#pane-hint').textContent =
        g.phase === 'memorize' || g.phase === 'twist' ? 'The deck waits until the cards turn over…' : '';
      for (const [id, el] of this.paneEls) {
        el.disabled = !active || r.placed.includes(id);
        el.classList.toggle('used', active && r.placed.includes(id));
        el.classList.toggle('marked', active && r.marked.has(id));
      }
      $('#btn-play').disabled = !g.canPlay();
      $('#btn-clear').disabled = !active;
    }

    layoutPane() {
      const host = $('#pane-cards');
      const n = this.paneEls.size;
      if (!n) return;
      const w = host.getBoundingClientRect().width;
      const gap = 8;
      const rows = w < 700 ? 3 : 2;
      const perRow = Math.ceil(n / rows);
      const pw = Math.max(40, Math.min(78, (w - (perRow - 1) * gap) / perRow));
      host.style.setProperty('--pw', `${Math.floor(pw)}px`);
    }

    // ---- stage overlays (title, round won, shop, game over, victory) ----------

    renderStage() {
      const g = this.game;
      const overlay = $('#stage');
      const sheet = $('#stage-sheet');
      const view = this.stageViews[g.phase];
      overlay.hidden = !view;
      if (!view) return;
      const { docked, html, bind } = view.call(this, g);
      overlay.classList.toggle('docked', !!docked);
      sheet.innerHTML = html;
      bind && bind(sheet);
    }

    get stageViews() {
      return {
        title: () => ({
          html: `
            <div class="title-mark">✦</div>
            <h1 class="title">Taroe</h1>
            <p class="tagline">A memory game of the twenty-two Major Arcana</p>
            <p class="lead">Watch the spread. Hold it in mind. When the cards turn over, lay them back down in order.
              Each level adds more, and every third level a boss twists the spread. Remember all ${T.CARDS.length} and the game is yours.</p>
            <div class="difficulty" role="radiogroup" aria-label="Difficulty">
              ${Object.entries(DIFFICULTY)
                .map(
                  ([id, d]) => `
                <button class="diff ${this.settings.difficulty === id ? 'on' : ''}" data-diff="${id}" role="radio"
                  aria-checked="${this.settings.difficulty === id}">
                  <b>${d.label}</b><span>${d.blurb}</span>
                </button>`
                )
                .join('')}
            </div>
            ${this.settings.tutorialDone ? '' : '<p class="nudge">New to memory palaces? Take the 3-minute tutorial first — it’s the trick that makes this game work.</p>'}
            <div class="actions">
              <button class="primary big" data-act="start">Begin</button>
              <button class="${this.settings.tutorialDone ? '' : 'glow'}" data-act="tutorial">Memory palace tutorial</button>
              <button data-act="help">How to play</button>
            </div>`,
          bind: (el) => {
            el.querySelectorAll('[data-diff]').forEach(
              (b) =>
                (b.onclick = () => {
                  this.settings.difficulty = b.dataset.diff;
                  T.Settings.save(this.settings);
                  this.renderStage();
                })
            );
            el.querySelector('[data-act=start]').onclick = () => this.game.restart();
            el.querySelector('[data-act=tutorial]').onclick = () => T.openPalaceTutorial(this);
            el.querySelector('[data-act=help]').onclick = () => this.openHelp();
          },
        }),

        bossIntro: (g) => {
          const b = g.round.boss;
          return {
            html: `
              <div class="boss-intro">
                <div class="boss-label">Boss · Level ${g.level}</div>
                <div class="boss-icon">${b.icon}</div>
                <h1 class="title boss-name">${esc(b.name)}</h1>
                <p class="lead">${esc(b.description)}</p>
                <p class="muted center">${g.sequence.length} cards · Defeat it for +$${b.reward}</p>
                <div class="actions"><button class="primary big" data-act="face">Face ${esc(b.name)}</button></div>
              </div>`,
            bind: (el) => (el.querySelector('[data-act=face]').onclick = () => g.faceBoss()),
          };
        },

        roundWon: (g) => ({
          docked: true,
          html: `
            <div class="reward">
              <div>
                <h2>Remembered.</h2>
                <ul class="lines">
                  ${g.lastReward.lines.map((l) => `<li><span>${esc(l.label)}</span><b>+$${l.amount}</b></li>`).join('')}
                </ul>
              </div>
              <div class="reward-total">
                <span class="lbl">Earned</span><b>$${g.lastReward.total}</b>
                <button class="primary big" data-act="shop">Visit the shop →</button>
              </div>
            </div>`,
          bind: (el) => (el.querySelector('[data-act=shop]').onclick = () => g.openShop()),
        }),

        shop: (g) => {
          const nextLen = g.targetLength(g.level + 1);
          const nextBoss = g.isBossLevel(g.level + 1);
          const offers = g.shop.offers.map((o, i) => {
            const { def, price, ok, reason } = g.offerState(o);
            const owned = g.owned[def.id] || 0;
            return `
              <div class="offer rarity-${def.rarity} ${o.sold ? 'sold' : ''}">
                <div class="offer-icon">${def.icon}</div>
                <div class="offer-rarity">${def.rarity}${def.kind === 'instant' ? ' · instant' : ''}</div>
                <h3>${esc(def.name)}</h3>
                <p>${esc(T.Items.describe(def, owned + 1))}</p>
                ${owned ? `<div class="offer-owned">Owned ×${owned}</div>` : ''}
                <button class="buy primary" data-buy="${i}" ${ok ? '' : 'disabled'} title="${esc(reason || '')}">
                  ${o.sold ? 'Sold' : `Buy · $${price}`}
                </button>
              </div>`;
          });
          return {
            html: `
              <div class="shop-head">
                <h2>The Shop</h2>
                <div class="shop-money">$${g.money}</div>
              </div>
              <div class="offers">${offers.join('') || '<p class="empty">The shelves are bare.</p>'}</div>
              <div class="actions">
                <button data-act="reroll" ${g.money < g.shop.rerollCost ? 'disabled' : ''}>Reroll · $${g.shop.rerollCost}</button>
                <button class="primary big ${nextBoss ? 'boss-next' : ''}" data-act="next">
                  Level ${g.level + 1} · ${nextLen} cards${nextBoss ? ' · Boss' : ''} →</button>
              </div>`,
            bind: (el) => {
              el.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => g.buy(Number(b.dataset.buy))));
              el.querySelector('[data-act=reroll]').onclick = () => g.reroll();
              el.querySelector('[data-act=next]').onclick = () => g.leaveShop();
            },
          };
        },

        gameOver: (g) => ({
          docked: true,
          html: `
            <div class="reward">
              <div>
                <h2>The cards fall silent.</h2>
                <p class="muted">You reached level ${g.level}. Longest spread remembered: ${g.best || 0} cards.
                  Study the true order above before you begin again.</p>
              </div>
              <div class="reward-total">
                <button class="primary big" data-act="restart">Start over</button>
              </div>
            </div>`,
          bind: (el) => (el.querySelector('[data-act=restart]').onclick = () => g.restart()),
        }),

        victory: (g) => ({
          html: `
            <div class="title-mark">☀</div>
            <h1 class="title">The World is yours</h1>
            <p class="lead">You held all ${g.sequence.length} cards of the Major Arcana in mind, in order.
              The Fool's journey is complete — and, as always, it begins again.</p>
            <p class="muted center">Final purse: $${g.money}</p>
            <div class="actions"><button class="primary big" data-act="restart">Begin anew</button></div>`,
          bind: (el) => (el.querySelector('[data-act=restart]').onclick = () => g.restart()),
        }),
      };
    }

    // ---- boss twist animation ---------------------------------------------------
    // Generic FLIP animation: works for any boss, whatever it does to the sequence.

    async onTwist({ boss, before, after, highlight }) {
      const g = this.game;
      const round = g.round;
      const live = () => g.round === round && g.phase === 'twist';
      this.renderBanner();
      this.renderPane();
      const elFor = (id) => this.slotEls.find((el) => el.querySelector('img').dataset.id === String(id));

      if (!boss.faceUp) {
        this.slotEls.forEach((el) => el.classList.remove('up'));
        await wait(700);
        if (!live()) return;
      }
      if (highlight.length) {
        highlight.forEach((id) => elFor(id) && elFor(id).classList.add('lifted', boss.faceUp ? 'lift-up' : 'lift-down'));
        await wait(1100);
        if (!live()) return;
      }

      // First: where each card is now.
      const rects = new Map(before.map((id) => [id, elFor(id).getBoundingClientRect()]));
      const ghosts = before
        .filter((id) => !after.includes(id))
        .map((id) => {
          const ghost = elFor(id).cloneNode(true);
          const rect = rects.get(id);
          Object.assign(ghost.style, { position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, margin: 0, zIndex: 5 });
          ghost.style.setProperty('--cw', `${rect.width}px`);
          ghost.classList.add('ghost');
          document.body.appendChild(ghost);
          return ghost;
        });

      // Last: rebuild the spread in its new order, then Invert + Play.
      this.slotKey = null;
      this.renderSlots({ deal: false });
      this.slotEls.forEach((el) => {
        const id = Number(el.querySelector('img').dataset.id);
        const from = rects.get(id);
        const to = el.getBoundingClientRect();
        const dx = from.left - to.left;
        const dy = from.top - to.top;
        const scale = from.width / to.width;
        el.style.transformOrigin = 'top left';
        el.style.transition = 'none';
        el.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
        if (highlight.includes(id)) el.classList.add('lifted', 'lift-up');
      });
      void document.body.offsetWidth;
      requestAnimationFrame(() => {
        ghosts.forEach((gh) => gh.classList.add('vanish'));
        this.slotEls.forEach((el) => {
          el.style.transition = 'transform 0.9s cubic-bezier(0.5, 0, 0.2, 1)';
          el.style.transform = '';
        });
      });
      await wait(1100);
      ghosts.forEach((gh) => gh.remove());
      this.slotEls.forEach((el) => el.classList.remove('lifted', 'lift-up'));
      this.slotEls.forEach((el) => {
        el.style.transition = el.style.transform = el.style.transformOrigin = '';
      });
      if (!live()) return;
      await wait(400);
      g.afterTwist();
    }

    // ---- memorize timer -----------------------------------------------------

    startTimer() {
      const g = this.game;
      const total = g.round.revealTime * 1000;
      const dealDelay = g.round.twisted ? 200 : 350 + g.sequence.length * 60; // let the deal animation land first
      const t = (this.timer = { total, remaining: total, delay: dealDelay, last: performance.now() });
      const fill = $('#timer-fill');
      const text = $('#timer-text');
      const tick = (now) => {
        if (this.timer !== t || g.phase !== 'memorize') return;
        const dt = now - t.last;
        t.last = now;
        if ($('#modal').hidden) {
          if (t.delay > 0) t.delay -= dt;
          else t.remaining -= dt;
        }
        fill.style.transform = `scaleX(${Math.max(0, t.remaining / t.total)})`;
        text.textContent = `${Math.max(0, t.remaining / 1000).toFixed(1)}s`;
        if (t.remaining <= 0) g.finishMemorize();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    // ---- modal: settings, help, card picker ---------------------------------------

    openModal(html, bind) {
      this.setModal(html, bind);
      $('#modal').hidden = false;
      return new Promise((resolve) => (this.modalResolve = resolve));
    }

    // Replace the open modal's content (multi-step dialogs like the tutorial).
    setModal(html, bind) {
      const sheet = $('#modal-sheet');
      sheet.innerHTML = html;
      sheet.scrollTop = 0;
      bind && bind(sheet);
    }

    closeModal(value) {
      $('#modal').hidden = true;
      const resolve = this.modalResolve;
      this.modalResolve = null;
      resolve && resolve(value);
    }

    pickCard({ title, candidates }) {
      return this.openModal(
        `<h2>${esc(title)}</h2>
         <div class="picker">
           ${candidates
             .map((id) => {
               const c = T.cardById(id);
               return `<button class="pcard" data-id="${id}" title="${esc(c.name)}"><img src="${c.img}" alt="${esc(c.name)}"></button>`;
             })
             .join('')}
         </div>
         <div class="actions"><button data-act="cancel">Cancel</button></div>`,
        (el) => {
          el.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => this.closeModal(Number(b.dataset.id))));
          el.querySelector('[data-act=cancel]').onclick = () => this.closeModal(null);
        }
      );
    }

    openSettings() {
      const s = this.settings;
      const save = () => T.Settings.save(s);
      this.openModal(
        `<h2>Settings</h2>
         <label class="field">
           <span>Memorize time <b id="rt-val">${s.revealTime}s</b></span>
           <input type="range" min="1" max="7" step="1" value="${s.revealTime}" id="rt">
           <small>How long the spread stays face up. Applies from the next level. Hourglasses add on top.</small>
         </label>
         <fieldset class="field">
           <span>Difficulty</span>
           ${Object.entries(DIFFICULTY)
             .map(
               ([id, d]) => `<label class="radio"><input type="radio" name="difficulty" value="${id}" ${s.difficulty === id ? 'checked' : ''}>
             <span><b>${d.label}</b> — ${d.blurb}.</span></label>`
             )
             .join('')}
           <small>Takes effect when a new run starts.</small>
         </fieldset>
         <fieldset class="field">
           <span>Mode</span>
           <label class="radio"><input type="radio" name="mode" value="normal" ${s.mode === 'normal' ? 'checked' : ''}>
             <span><b>Growing chain</b> — the spread keeps its cards and order; each level appends new ones.</span></label>
           <label class="radio"><input type="radio" name="mode" value="shuffle" ${s.mode === 'shuffle' ? 'checked' : ''}>
             <span><b>Fresh spreads</b> — a brand new spread every level.</span></label>
           <small>Mode changes take effect when a new run starts.</small>
         </fieldset>
         <label class="field check">
           <input type="checkbox" id="palace" ${s.palace ? 'checked' : ''}>
           <span><b>Memory palace</b> — label each position with a place (a locus) to hang the card on.</span>
         </label>
         <label class="field">
           <span>Your palace — one place per line, in walking order</span>
           <textarea id="loci" rows="7">${esc(s.loci.join('\n'))}</textarea>
           <small>Use a route you know by heart: your home, your commute. ${T.CARDS.length} stops cover the whole deck.</small>
         </label>
         <div class="actions">
           <button data-act="newrun">Start a new run</button>
           <button class="primary" data-act="close">Done</button>
         </div>`,
        (el) => {
          el.querySelector('#rt').oninput = (e) => {
            s.revealTime = Number(e.target.value);
            el.querySelector('#rt-val').textContent = `${s.revealTime}s`;
            save();
          };
          el.querySelectorAll('[name=difficulty]').forEach(
            (r) => (r.onchange = () => {
              s.difficulty = r.value;
              save();
            })
          );
          el.querySelectorAll('[name=mode]').forEach(
            (r) => (r.onchange = () => {
              s.mode = r.value;
              save();
            })
          );
          el.querySelector('#palace').onchange = (e) => {
            s.palace = e.target.checked;
            save();
            this.renderSlots();
          };
          el.querySelector('#loci').oninput = (e) => {
            const loci = e.target.value.split('\n').map((x) => x.trim()).filter(Boolean);
            s.loci = loci.length ? loci : T.Settings.DEFAULT_LOCI.slice();
            save();
            this.renderSlots();
          };
          el.querySelector('[data-act=close]').onclick = () => this.closeModal(null);
          el.querySelector('[data-act=newrun]').onclick = () => {
            this.closeModal(null);
            this.game.restart();
          };
        }
      );
    }

    openHelp() {
      this.openModal(
        `<h2>How to play</h2>
         <ol class="rules">
           <li>A spread of Major Arcana is laid out face up. You have a few seconds to memorize it.</li>
           <li>The cards turn over. Pick cards from the deck at the bottom to lay them back <b>in the same order</b>.
             Click a placed card to take it back.</li>
           <li>Each round you have <b class="c-hand">3 hands</b> and <b class="c-strike">2 strikes</b>.
             Playing a card that wasn't in the spread (or leaving one out) costs a hand.
             The right cards in the wrong order cost a strike. Run out of either and the run is over.</li>
           <li>Win a round: <b>$1</b> per hand left, <b>$2</b> per strike left. Spend it in the shop.</li>
           <li>In <i>Growing chain</i> mode the spread keeps its order and grows each level (+1 easier, +2 normal, +3 hard), until you hold all ${T.CARDS.length}.</li>
           <li>Every third level is a <b>boss</b>. Bosses twist the spread — swap two cards, steal one, reverse it, scatter it —
             and the twisted order is what you keep for the rest of the run.</li>
         </ol>
         <h3>The memory palace</h3>
         <p>Mentalists don't memorize lists — they <i>walk</i> them. Pick a route you know well (your home works).
           Each position in the spread is a stop on that walk, shown under the card. When a card appears,
           imagine it vividly at that stop: <i>Death is knocking at the front door; the Hanged Man swings from the coat hook.</i>
           The stranger and more sensory the image, the better it sticks. To recall, walk the route again and see who is there.</p>
         <p class="muted">New to this? Try the memory palace tutorial from the sidebar. Edit your route in Settings. Keys: <kbd>Space</kbd> ready · <kbd>Enter</kbd> play · <kbd>Backspace</kbd> undo.</p>
         <div class="actions"><button class="primary" data-act="close">Got it</button></div>`,
        (el) => (el.querySelector('[data-act=close]').onclick = () => this.closeModal(null))
      );
    }

    // ---- toasts ---------------------------------------------------------------

    toast(msg, kind = 'info') {
      const el = document.createElement('div');
      el.className = `toast ${kind}`;
      el.textContent = msg;
      $('#toasts').appendChild(el);
      setTimeout(() => el.classList.add('out'), 2600);
      setTimeout(() => el.remove(), 3100);
    }
  }

  // Small canvas confetti burst for the victory screen.
  T.confetti = function (canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colors = ['#e8c06a', '#f6e7b8', '#d9534f', '#5b8fd9', '#7cc49a', '#c79be0'];
    const parts = Array.from({ length: 220 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 200,
      y: innerHeight / 2.5,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 16 - 4,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 6,
      h: 3 + Math.random() * 4,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    const start = performance.now();
    (function frame(now) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (now - start < 5000) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    })(start);
  };

  T.UI = UI;
})(window.Taroe);

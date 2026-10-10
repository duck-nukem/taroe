// Game rules and state. No DOM in here — the UI listens via game.on(fn)
// and talks back through the `io` object (pickCard, toast).

window.Taroe = window.Taroe || {};

(function (T) {
  'use strict';

  const RULES = {
    startLength: 3, // cards in level 1
    growth: { easier: 1, normal: 2, hard: 3 }, // cards added per level, by difficulty
    bossEvery: 3, // every Nth level is a boss level
    bossTimeCut: 0.85, // each boss beaten multiplies seconds-per-card by this
    minSecondsPerCard: 0.8, // ...but never below this
    minMemorize: 1.5, // seconds, for any countdown
    quickStudyRate: 0.5, // $ per second left when you press Ready (paid only if you win)
    shopOffers: 3,
    rerollBase: 1,
    rarityWeights: { common: 6, uncommon: 3, rare: 1 },
  };

  const BASE_STATS = {
    hands: 3,
    strikes: 2,
    revealBonus: 0, // flat extra seconds per countdown
    revealMult: 0, // +x% memorize time
    timeWard: 0, // boss time cuts to ignore
    luck: 0,
    rewardPerHand: 1,
    rewardPerStrike: 2,
    rewardFlat: 0,
  };

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  class Game {
    constructor({ settings, io }) {
      this.settings = settings;
      this.io = io;
      this.listeners = [];
      this.runId = 0;
      this.phase = 'title';
      this.newRun();
      this.phase = 'title';
    }

    on(fn) {
      this.listeners.push(fn);
    }

    emit(type, data) {
      for (const fn of this.listeners) fn(type, data, this);
    }

    // ---- run lifecycle -----------------------------------------------------

    newRun() {
      this.runId++;
      this.mode = this.settings.mode;
      this.difficulty = this.settings.difficulty in RULES.growth ? this.settings.difficulty : 'normal';
      this.bossesFaced = 0;
      this.bossesBeaten = 0;
      this.level = 1;
      this.money = 0;
      this.deck = T.CARDS.map((c) => c.id);
      this.sequence = [];
      this.lociOf = new Map(); // card id -> index into settings.loci; bosses move cards, places go with them
      this.owned = {}; // item id -> stacks
      this.round = null;
      this.shop = null;
      this.lastReward = null;
      this.best = 0;
    }

    restart() {
      this.newRun();
      this.startLevel();
    }

    goToTitle() {
      this.newRun();
      this.setPhase('title');
    }

    // Memorize time is budgeted per card you have to learn, and tightens after each boss.
    secondsPerCard() {
      const cuts = Math.max(0, this.bossesBeaten - this.stat('timeWard'));
      return Math.max(RULES.minSecondsPerCard, this.settings.secondsPerCard * RULES.bossTimeCut ** cuts);
    }

    memorizeTime(newCards) {
      const t = newCards * this.secondsPerCard() * (1 + this.stat('revealMult')) + this.stat('revealBonus');
      return Math.max(RULES.minMemorize, Math.round(t * 10) / 10);
    }

    targetLength(level = this.level) {
      return Math.min(this.deck.length, RULES.startLength + (level - 1) * RULES.growth[this.difficulty]);
    }

    isBossLevel(level = this.level) {
      return level % RULES.bossEvery === 0;
    }

    levelsUntilBoss() {
      return (RULES.bossEvery - (this.level % RULES.bossEvery)) % RULES.bossEvery;
    }

    pickBoss() {
      const first = this.bossesFaced === 0;
      const pool = T.Bosses.all().filter((b) => (first || !b.firstOnly) && (!b.available || b.available(this)));
      if (!pool.length) return null;
      this.bossesFaced++;
      return pick(pool);
    }

    startLevel() {
      const len = this.targetLength();
      const previous = new Set(this.sequence);
      if (this.mode === 'normal') {
        // The spread grows: last level's cards stay, in order, new ones are appended.
        const seq = this.sequence.filter((id) => this.deck.includes(id));
        const pool = shuffle(this.deck.filter((id) => !seq.includes(id)));
        while (seq.length < len) seq.push(pool.pop());
        this.sequence = seq;
      } else {
        this.sequence = shuffle(this.deck).slice(0, len);
        this.lociOf = new Map();
      }
      this.assignLoci();

      const hands = this.stat('hands');
      const strikes = this.stat('strikes');
      this.round = {
        hands,
        strikes,
        maxHands: hands,
        maxStrikes: strikes,
        newCards: 0,
        revealTime: 0,
        secondsLeft: 0, // banked by pressing Ready early
        revealed: new Set(), // slot indices that stay face up
        marked: new Set(), // card ids highlighted in the pane
        placed: Array(len).fill(null),
        placeOrder: [],
        misses: [],
        flags: {}, // scratch space for item hooks
        isFinal: len === this.deck.length,
        boss: this.isBossLevel() ? this.pickBoss() : null,
        twisted: false,
        version: 0, // bumps when a boss rewrites the sequence
      };
      this.round.newCards =
        this.mode === 'normal' ? this.sequence.filter((id) => !previous.has(id)).length || len : len;
      this.round.revealTime = this.memorizeTime(this.round.newCards);
      this.runHook('onRoundSetup', this.ctx());
      this.setPhase(this.round.boss ? 'bossIntro' : 'memorize');
    }

    // Each card keeps its palace stop for the whole run. New cards take the next stops
    // along the route; stops freed by a stolen card are only reused once the route runs out.
    assignLoci() {
      for (const id of [...this.lociOf.keys()]) if (!this.sequence.includes(id)) this.lociOf.delete(id);
      const used = new Set(this.lociOf.values());
      const routeLength = Math.max(this.settings.loci ? this.settings.loci.length : 0, T.CARDS.length);
      for (const id of this.sequence) {
        if (this.lociOf.has(id)) continue;
        let next = used.size ? Math.max(...used) + 1 : 0;
        if (next >= routeLength) for (next = 0; used.has(next); ) next++;
        this.lociOf.set(id, next);
        used.add(next);
      }
    }

    locusOf(slot) {
      return this.lociOf.get(this.sequence[slot]);
    }

    faceBoss() {
      if (this.phase === 'bossIntro') this.setPhase('memorize');
    }

    // Memorize time is up (or the player is ready). A boss twists the spread first.
    finishMemorize(secondsLeft = 0) {
      if (this.phase !== 'memorize') return;
      const r = this.round;
      r.secondsLeft += Math.max(0, secondsLeft);
      if (r.boss && !r.twisted) {
        const before = this.sequence.slice();
        const { sequence, highlight = [] } = r.boss.apply(before.slice(), this.ctx());
        this.sequence = sequence;
        this.assignLoci(); // forget stops of cards the boss removed
        r.twisted = true;
        r.version++;
        r.placed = Array(sequence.length).fill(null);
        r.isFinal = sequence.length === this.deck.length;
        // A recount only budgets time for the cards that actually moved.
        r.newCards = sequence.filter((id, i) => before[i] !== id).length || 1;
        r.revealTime = this.memorizeTime(r.newCards);
        this.phase = 'twist';
        // The UI animates from `before` to `after`, then calls afterTwist().
        this.emit('twist', { boss: r.boss, before, after: sequence.slice(), highlight });
        return;
      }
      this.startRecall();
    }

    afterTwist() {
      if (this.phase !== 'twist') return;
      if (this.round.boss.recount) this.setPhase('memorize');
      else this.startRecall();
    }

    startRecall() {
      this.runHook('onRecallStart', this.ctx());
      for (const i of this.round.revealed) this.round.placed[i] = this.sequence[i];
      this.setPhase('recall');
    }

    setPhase(phase) {
      this.phase = phase;
      this.emit('phase', phase);
    }

    // ---- items -------------------------------------------------------------

    ownedItems() {
      return Object.entries(this.owned)
        .map(([id, stacks]) => ({ def: T.Items.get(id), stacks }))
        .filter((x) => x.def && x.stacks > 0);
    }

    stat(name) {
      let v = BASE_STATS[name] ?? 0;
      for (const { def, stacks } of this.ownedItems()) {
        if (def.stats && def.stats[name]) v += def.stats[name] * stacks;
      }
      return v;
    }

    runHook(name, ctx) {
      for (const { def, stacks } of this.ownedItems()) {
        const fn = def.hooks && def.hooks[name];
        if (fn) fn(ctx, stacks);
      }
      return ctx;
    }

    // Context handed to item hooks / onBuy. Keep helpers here so items stay tiny.
    ctx(extra = {}) {
      const game = this;
      const round = this.round;
      const ctx = {
        game,
        round,
        roll: (p) => Math.random() < clamp01(p + game.stat('luck')),
        toast: (msg) => game.io.toast(msg),
        pickCard: (opts) => game.io.pickCard(opts),

        revealRandomSlot() {
          const hidden = game.sequence.map((_, i) => i).filter((i) => !round.revealed.has(i));
          if (hidden.length <= 1) return null; // always leave something to remember
          const i = pick(hidden);
          round.revealed.add(i);
          return i;
        },
        markRandomCard() {
          const options = game.sequence.filter(
            (id, i) => !round.marked.has(id) && !round.revealed.has(i)
          );
          if (!options.length) return null;
          const id = pick(options);
          round.marked.add(id);
          return id;
        },
        removeFromDeck(id) {
          game.deck = game.deck.filter((x) => x !== id);
          game.sequence = game.sequence.filter((x) => x !== id);
        },

        cancelled: false,
        note: null,
        cancelPenalty(note) {
          ctx.cancelled = true;
          ctx.note = note || null;
        },

        lines: [],
        addRewardLine(label, amount) {
          ctx.lines.push({ label, amount });
        },
        ...extra,
      };
      return ctx;
    }

    // ---- recall ------------------------------------------------------------

    place(cardId) {
      const r = this.round;
      if (this.phase !== 'recall' || r.placed.includes(cardId)) return;
      const slot = r.placed.indexOf(null);
      if (slot === -1) return;
      r.placed[slot] = cardId;
      r.placeOrder.push(slot);
      this.emit('placed', { slot, cardId });
    }

    unplace(slot) {
      const r = this.round;
      if (this.phase !== 'recall' || r.revealed.has(slot) || r.placed[slot] == null) return;
      r.placed[slot] = null;
      r.placeOrder = r.placeOrder.filter((s) => s !== slot);
      this.emit('placed', { slot, cardId: null });
    }

    undo() {
      const slot = this.round && this.round.placeOrder[this.round.placeOrder.length - 1];
      if (slot != null) this.unplace(slot);
    }

    clearPlaced() {
      const r = this.round;
      r.placed = r.placed.map((id, i) => (r.revealed.has(i) ? id : null));
      r.placeOrder = [];
    }

    canPlay() {
      return this.phase === 'recall' && !this.round.placed.includes(null);
    }

    play() {
      if (!this.canPlay()) return;
      const r = this.round;
      const inSpread = new Set(this.sequence);
      const wrongCards = r.placed.some((id) => !inSpread.has(id));
      if (!wrongCards && r.placed.every((id, i) => id === this.sequence[i])) {
        this.winRound();
        return;
      }

      const kind = wrongCards ? 'cards' : 'order';
      const ctx = this.runHook('onMiss', this.ctx({ kind }));
      if (!ctx.cancelled) {
        if (kind === 'cards') r.hands--;
        else r.strikes--;
      }
      const correctPositions = r.placed.filter((id, i) => id === this.sequence[i]).length;
      r.misses.push({ kind, cancelled: ctx.cancelled });
      this.clearPlaced();

      const lost = r.hands <= 0 || r.strikes <= 0;
      this.emit('miss', { kind, cancelled: ctx.cancelled, note: ctx.note, correctPositions, lost });
      if (lost) this.setPhase('gameOver');
    }

    winRound() {
      const r = this.round;
      const ctx = this.ctx();
      const perHand = this.stat('rewardPerHand');
      const perStrike = this.stat('rewardPerStrike');
      ctx.addRewardLine(`${r.hands} hand${r.hands === 1 ? '' : 's'} left × $${perHand}`, r.hands * perHand);
      ctx.addRewardLine(`${r.strikes} strike${r.strikes === 1 ? '' : 's'} left × $${perStrike}`, r.strikes * perStrike);
      const flat = this.stat('rewardFlat');
      if (flat) ctx.addRewardLine('Merchant’s Purse', flat);
      if (r.boss && r.boss.reward) ctx.addRewardLine(`${r.boss.name} defeated`, r.boss.reward);
      const quick = Math.floor(r.secondsLeft * RULES.quickStudyRate);
      if (quick > 0) ctx.addRewardLine(`Quick study (${r.secondsLeft.toFixed(1)}s early)`, quick);
      if (r.boss) this.bossesBeaten++;
      this.runHook('modifyReward', ctx);

      const total = ctx.lines.reduce((s, l) => s + l.amount, 0);
      this.money += total;
      this.best = Math.max(this.best, this.sequence.length);
      this.lastReward = { lines: ctx.lines, total };
      this.setPhase(r.isFinal ? 'victory' : 'roundWon');
    }

    // ---- shop --------------------------------------------------------------

    openShop() {
      this.shop = { offers: this.rollOffers(), rerollCost: RULES.rerollBase };
      this.setPhase('shop');
    }

    rollOffers() {
      const pool = T.Items.all().filter(
        (d) => (this.owned[d.id] || 0) < d.maxStacks && (!d.available || d.available(this))
      );
      const offers = [];
      while (offers.length < RULES.shopOffers && pool.length) {
        const total = pool.reduce((s, d) => s + (RULES.rarityWeights[d.rarity] || 1), 0);
        let roll = Math.random() * total;
        const idx = pool.findIndex((d) => (roll -= RULES.rarityWeights[d.rarity] || 1) < 0);
        offers.push({ id: pool[idx].id, sold: false });
        pool.splice(idx, 1);
      }
      return offers;
    }

    offerState(offer) {
      const def = T.Items.get(offer.id);
      const price = T.Items.price(def, this);
      if (offer.sold) return { def, price, ok: false, reason: 'Sold' };
      if (def.kind === 'passive' && (this.owned[def.id] || 0) >= def.maxStacks)
        return { def, price, ok: false, reason: 'Maxed' };
      const can = def.canBuy ? def.canBuy(this) : true;
      if (can !== true) return { def, price, ok: false, reason: can };
      if (this.money < price) return { def, price, ok: false, reason: 'Not enough money' };
      return { def, price, ok: true };
    }

    async buy(index) {
      if (this.phase !== 'shop' || this.buying) return;
      const offer = this.shop.offers[index];
      const { def, price, ok } = this.offerState(offer);
      if (!ok) return;
      this.buying = true;
      try {
        if (def.kind === 'instant') {
          const result = await def.onBuy(this.ctx());
          if (result === false) return;
        } else {
          this.owned[def.id] = (this.owned[def.id] || 0) + 1;
        }
        this.money -= price;
        offer.sold = true;
        this.emit('shop');
      } finally {
        this.buying = false;
      }
    }

    reroll() {
      if (this.phase !== 'shop' || this.money < this.shop.rerollCost) return;
      this.money -= this.shop.rerollCost;
      this.shop.rerollCost++;
      this.shop.offers = this.rollOffers();
      this.emit('shop');
    }

    leaveShop() {
      if (this.phase !== 'shop') return;
      this.level++;
      this.startLevel();
    }
  }

  T.Game = Game;
  T.RULES = RULES;
})(window.Taroe);

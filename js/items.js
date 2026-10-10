// Shop items ("relics"). Everything the shop can sell lives here.
//
// To add an item, call Taroe.Items.register({...}) with:
//
//   id           unique string
//   name, icon   display (icon is any short string / emoji)
//   rarity       'common' | 'uncommon' | 'rare'   (affects shop odds)
//   price        number, or (game) => number
//   kind         'passive' — kept for the rest of the run, can stack
//                'instant' — applied once on purchase (onBuy), never owned
//   maxStacks    passive only; default 1
//   description  string, or (stacks) => string
//   available    optional (game) => boolean — hide from the shop when false
//   canBuy       optional (game) => true | 'reason why not'
//
//   stats        passive only: numbers added per stack to the game stats:
//                  hands, strikes        round start values
//                  revealBonus           extra memorize seconds
//                  luck                  added to every ctx.roll() chance (can be negative)
//                  rewardPerHand, rewardPerStrike, rewardFlat
//
//   hooks        passive only: { hookName(ctx, stacks) }
//                  onRoundSetup   round created, before memorize (ctx.round is mutable)
//                  onRecallStart  cards about to flip — ctx.revealRandomSlot(), ctx.markRandomCard()
//                  onMiss         a wrong play — ctx.kind is 'cards' | 'order';
//                                 call ctx.cancelPenalty(note) to forgive it
//                  modifyReward   round won — ctx.addRewardLine(label, amount)
//
//   onBuy        instant only: async (ctx) => false to abort (no charge).
//                ctx.pickCard({title, candidates}) resolves to a card id or null,
//                ctx.removeFromDeck(id), ctx.toast(msg)
//
// All chances should go through ctx.roll(p) so luck modifiers apply.

window.Taroe = window.Taroe || {};

Taroe.Items = (() => {
  const registry = new Map();
  return {
    register(def) {
      if (registry.has(def.id)) throw new Error(`Duplicate item id: ${def.id}`);
      registry.set(def.id, { maxStacks: 1, kind: 'passive', rarity: 'common', ...def });
    },
    get: (id) => registry.get(id),
    all: () => [...registry.values()],
    describe(def, stacks = 1) {
      return typeof def.description === 'function' ? def.description(stacks) : def.description;
    },
    price(def, game) {
      return typeof def.price === 'function' ? def.price(game) : def.price;
    },
  };
})();

// ---------------------------------------------------------------------------
// Placeholder catalogue — prices and numbers are first guesses, tune freely.
// ---------------------------------------------------------------------------

Taroe.Items.register({
  id: 'banish',
  name: 'Banish',
  icon: '✂',
  rarity: 'common',
  kind: 'instant',
  price: 3,
  description: 'Remove one card of your choice from the deck. Fewer decoys, and a shorter road to the end.',
  available: (game) => game.deck.length > 10,
  canBuy: (game) =>
    game.deck.some((id) => !game.sequence.includes(id)) || 'Every card left is already in your spread.',
  async onBuy(ctx) {
    const candidates = ctx.game.deck.filter((id) => !ctx.game.sequence.includes(id));
    const id = await ctx.pickCard({ title: 'Banish which card?', candidates });
    if (id == null) return false;
    ctx.removeFromDeck(id);
    ctx.toast(`${Taroe.cardById(id).name} leaves the deck.`);
  },
});

Taroe.Items.register({
  id: 'lingering-glance',
  name: 'Lingering Glance',
  icon: '👁',
  rarity: 'common',
  price: 5,
  maxStacks: 3,
  description: (n) =>
    n > 1
      ? `${n} separate 25% chances that a card stays face up (and locked in place).`
      : '25% chance that one card does not flip — it stays face up, locked in place.',
  hooks: {
    onRecallStart(ctx, stacks) {
      for (let i = 0; i < stacks; i++) if (ctx.roll(0.25)) ctx.revealRandomSlot();
    },
  },
});

Taroe.Items.register({
  id: 'hourglass',
  name: 'Hourglass',
  icon: '⏳',
  rarity: 'common',
  price: 4,
  maxStacks: 3,
  description: (n) => `+${n}s to memorize.`,
  stats: { revealBonus: 1 },
});

Taroe.Items.register({
  id: 'lantern',
  name: 'Hermit’s Lantern',
  icon: '🏮',
  rarity: 'uncommon',
  price: 6,
  maxStacks: 2,
  description: (n) =>
    n > 1 ? `Marks ${n} cards in the deck pane that belong to the spread.` : 'Marks one card in the deck pane that belongs to the spread.',
  hooks: {
    onRecallStart(ctx, stacks) {
      for (let i = 0; i < stacks; i++) ctx.markRandomCard();
    },
  },
});

Taroe.Items.register({
  id: 'four-leaf',
  name: 'Four-Leaf Clover',
  icon: '🍀',
  rarity: 'uncommon',
  price: 5,
  maxStacks: 2,
  description: (n) => `+${n * 10}% to every chance.`,
  stats: { luck: 0.1 },
});

Taroe.Items.register({
  id: 'extra-hand',
  name: 'The Magician’s Sleeve',
  icon: '✋',
  rarity: 'uncommon',
  price: 6,
  maxStacks: 2,
  description: (n) => `+${n} hand${n > 1 ? 's' : ''} each round.`,
  stats: { hands: 1 },
});

Taroe.Items.register({
  id: 'iron-will',
  name: 'Iron Will',
  icon: '🛡',
  rarity: 'rare',
  price: 8,
  maxStacks: 1,
  description: '+1 strike each round.',
  stats: { strikes: 1 },
});

Taroe.Items.register({
  id: 'second-wind',
  name: 'Second Wind',
  icon: '🌬',
  rarity: 'rare',
  price: 7,
  description: 'The first wrong order each round costs no strike.',
  hooks: {
    onMiss(ctx) {
      if (ctx.kind === 'order' && !ctx.round.flags.secondWind) {
        ctx.round.flags.secondWind = true;
        ctx.cancelPenalty('Second Wind forgives it.');
      }
    },
  },
});

Taroe.Items.register({
  id: 'purse',
  name: 'Merchant’s Purse',
  icon: '👛',
  rarity: 'common',
  price: 4,
  maxStacks: 3,
  description: (n) => `+$${n} for every round won.`,
  stats: { rewardFlat: 1 },
});

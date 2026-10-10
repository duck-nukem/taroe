# Taroe

A memory-training card game with the 22 Major Arcana, loosely inspired by Balatro.
Open `index.html` in a browser. No build step, no server needed.

## Rules

- Level 1 deals 3 cards face up, then they flip over. Memorize time is **per new card**: 2.5 s by default (Settings: 1–5 s).
  Only cards you haven't learned yet count, so a level that adds 2 cards gives you 5 s.
- Each boss you beat cuts memorize time by 15%, but never below 0.8 s per card. The Hourglass (+20% time) and the
  Stopped Clock (ignores one boss's cut) push back.
- Press **Ready** early. If you win the round, every 2 seconds left pays $1 (**Quick study**).
- Pick cards from the deck pane to rebuild the spread in order, then **Play**.
- Every round starts with **1 hand** and **2 strikes**.
  - A card that wasn't in the spread, or a missing one: −1 hand.
  - The right cards in the wrong order: −1 strike.
  - Either counter reaches 0: the run is over.
  - After a wrong play, cards already in the right slot stay locked in (green). Only the wrong ones go back.
- **Give up** (sidebar) ends the run early and reveals the spread.
- Winning a round pays $1 per hand left + $2 per strike left. Spend it in the shop.
- **Difficulty** (pick it on the title screen): the spread grows by +1 (Easier), +2 (Normal) or +3 (Hard) cards each level.
- **Growing chain** (default): the spread keeps its order and grows each level.
  **Fresh spreads**: a new random spread every level.
- Remember the whole deck (all 22, or fewer if you banished some) to win.

### Bosses

Every 3rd level is a boss. A boss twists the spread after you memorize it. The twisted order then stays for the rest of the run.

| Boss | Twist |
| --- | --- |
| The Trickster 🃏 | Two cards swap places face up, then you get a new countdown |
| The Thief 🗝 | The cards turn face down and one is removed. Leave it out. |
| The Mirror 🪞 | Face down, the spread reverses. *First boss only.* |
| The Tower ⚡ | The spread is shuffled face up, then you get a new countdown. *First boss only.* |

Beating a boss pays +$3.

The game opens on a title screen, so you can set difficulty, build your palace or change settings before a run.
**Your palace** has one stop per card and counts how many of the 22 you've filled.
Blank stops borrow the example route.

The memory palace labels under each slot are a route of *loci* (Settings: edit them, one per line).
The **Memory palace tutorial** (title screen or sidebar) teaches the method of loci. You build a route, practice
vivid imagery, place 5 cards and walk the route to recall them.

## Code map

| File | What's in it |
| --- | --- |
| `js/cards.js` | Card data (names, numerals, image paths) |
| `js/bosses.js` | **Bosses.** Registry plus the four bosses. Its header documents the boss API. |
| `js/tutorial.js` | Interactive memory palace tutorial |
| `js/items.js` | **Shop items.** Registry plus the placeholder catalogue. Its header documents the item API. |
| `js/game.js` | Rules and state. No DOM. `RULES` / `BASE_STATS` at the top hold the tunable numbers. |
| `js/ui.js` | Rendering, input, timer, modals |
| `js/settings.js` | Persisted settings (localStorage) and the default palace route |

### Adding a boss

```js
Taroe.Bosses.register({
  id: 'hermit',
  name: 'The Hermit',
  icon: '🏮',
  description: 'The first and last cards trade places.',
  twistText: 'The ends change places…',
  faceUp: true,      // animate face up, or turn the cards over first
  recount: true,     // give a fresh memorize countdown afterwards
  apply(seq) {
    [seq[0], seq[seq.length - 1]] = [seq[seq.length - 1], seq[0]];
    return { sequence: seq, highlight: [seq[0], seq[seq.length - 1]] };
  },
});
```

`apply` returns the new order. Cards it drops are removed from the spread but stay in the deck.
The UI works out the animation by comparing the old and new order, so a new boss needs no UI code.

### Adding a shop item

```js
Taroe.Items.register({
  id: 'mirror',
  name: 'Moon Mirror',
  icon: '🪞',
  rarity: 'uncommon',
  price: 6,
  maxStacks: 2,
  description: (n) => `${n * 15}% chance the last card stays face up.`,
  hooks: {
    onRecallStart(ctx, stacks) {
      const last = ctx.game.sequence.length - 1;
      if (ctx.roll(0.15 * stacks)) ctx.round.revealed.add(last);
    },
  },
});
```

- **Passive items** use `stats` (`hands`, `strikes`, `revealBonus`, `luck`, reward stats) and/or `hooks`
  (`onRoundSetup`, `onRecallStart`, `onMiss`, `modifyReward`).
- **Instant items** use `kind: 'instant'` with an async `onBuy(ctx)`. `ctx.pickCard()` lets the player choose a card.
- Route every chance through `ctx.roll(p)` so luck items (positive or negative) apply.
- To add a new hook point, call `this.runHook('name', this.ctx({...}))` from `game.js`.

## Card art

`assets/cards/hires/` holds the full scans (~1100×1920) and `assets/cards/web/` holds the 900 px copies the game uses.
They are the 1909 Rider–Waite–Smith Major Arcana by Pamela Colman Smith, which is public domain.
The scans come from Wikimedia Commons ("RWS Tarot NN Name.jpg").
The Smith-Waite Centennial deck reproduces this same artwork.

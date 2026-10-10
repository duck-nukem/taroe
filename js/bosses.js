// Boss rounds. Every RULES.bossEvery-th level is a boss level.
//
// A boss twists the spread after you memorize it. The twisted sequence replaces the old
// one for the rest of the run. To add a boss, call Taroe.Bosses.register({...}) with:
//
//   id, name, icon     display
//   description        shown on the boss intro screen
//   twistText          banner text while the twist animates
//   recallHint         banner text during recall (optional)
//   faceUp             true: the twist happens face up (you watch the cards move)
//                      false: the cards turn over first, then move face down
//   recount            true: after the twist you get a fresh memorize countdown
//   firstOnly          true: can only be the run's first boss
//   reward             bonus $ for beating it
//   available          optional (game) => boolean
//   apply(sequence, ctx) => { sequence, highlight }
//                      gets a copy of the spread, returns the new spread plus the card ids
//                      to spotlight before they move. Cards missing from the result are
//                      removed from the spread (they stay in the deck).

window.Taroe = window.Taroe || {};

Taroe.Bosses = (() => {
  const registry = new Map();
  return {
    register(def) {
      if (registry.has(def.id)) throw new Error(`Duplicate boss id: ${def.id}`);
      registry.set(def.id, { faceUp: true, recount: false, firstOnly: false, reward: 3, ...def });
    },
    get: (id) => registry.get(id),
    all: () => [...registry.values()],
  };
})();

(function (B) {
  const randInt = (n) => Math.floor(Math.random() * n);

  B.register({
    id: 'trickster',
    name: 'The Trickster',
    icon: '🃏',
    description: 'Once you have memorized the spread, two cards trade places before your eyes — taking their palace stops with them. Watch, then memorize the new walk. The swap is permanent.',
    twistText: 'Two cards trade places…',
    recallHint: 'Two cards traded places. Lay down the new order.',
    faceUp: true,
    recount: true,
    available: (game) => game.sequence.length >= 2,
    apply(seq) {
      const i = randInt(seq.length);
      let j = randInt(seq.length - 1);
      if (j >= i) j++;
      [seq[i], seq[j]] = [seq[j], seq[i]];
      return { sequence: seq, highlight: [seq[i], seq[j]] };
    },
  });

  B.register({
    id: 'thief',
    name: 'The Thief',
    icon: '🗝',
    description: 'The cards turn face down — then one is stolen, and its stop vanishes from your walk. Remember who stood there and leave that card out. It stays gone for the rest of the run.',
    twistText: 'The cards turn over… and one is stolen.',
    recallHint: 'One card was stolen. Lay down the rest, in order.',
    faceUp: false,
    available: (game) => game.sequence.length >= 3,
    apply(seq) {
      const [stolen] = seq.splice(randInt(seq.length), 1);
      return { sequence: seq, highlight: [stolen] };
    },
  });

  B.register({
    id: 'mirror',
    name: 'The Mirror',
    icon: '🪞',
    description: 'The cards turn face down and the spread is reversed. Lay it down back to front — and it stays reversed for the rest of the run.',
    twistText: 'The spread turns back to front…',
    recallHint: 'Reversed! Walk your palace backwards.',
    faceUp: false,
    firstOnly: true,
    apply(seq) {
      return { sequence: seq.reverse(), highlight: [] };
    },
  });

  B.register({
    id: 'tower',
    name: 'The Tower',
    icon: '⚡',
    description: 'Lightning scatters the spread — every card keeps its stop, but your walk now visits them in a new order. Memorize the new route; it counts from now on.',
    twistText: 'Lightning strikes — the spread scatters!',
    recallHint: 'The new order stands. Lay it down.',
    faceUp: true,
    recount: true,
    firstOnly: true,
    apply(seq) {
      const before = seq.join();
      do {
        for (let i = seq.length - 1; i > 0; i--) {
          const j = randInt(i + 1);
          [seq[i], seq[j]] = [seq[j], seq[i]];
        }
      } while (seq.length > 1 && seq.join() === before);
      return { sequence: seq, highlight: [] };
    },
  });
})(Taroe.Bosses);

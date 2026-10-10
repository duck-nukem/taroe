// The 22 Major Arcana (Rider–Waite–Smith, Pamela Colman Smith, 1909 — public domain).
// `image` is a vivid one-liner of what's on the card, used by the memory palace tutorial.
window.Taroe = window.Taroe || {};

Taroe.CARDS = [
  ['0', 'The Fool', 'fool', 'a carefree traveller stepping off a cliff while a little white dog yaps at his heels'],
  ['I', 'The Magician', 'magician', 'a robed magician pointing a wand at the sky and a finger at the ground'],
  ['II', 'The High Priestess', 'high-priestess', 'a veiled priestess sitting between a black and a white pillar, a scroll in her lap'],
  ['III', 'The Empress', 'empress', 'a crowned woman lounging on cushions in a field of ripe wheat'],
  ['IV', 'The Emperor', 'emperor', 'a stern bearded king on a stone throne carved with ram heads'],
  ['V', 'The Hierophant', 'hierophant', 'a pope in a triple crown blessing two kneeling monks'],
  ['VI', 'The Lovers', 'lovers', 'a naked couple beneath a huge winged angel and a blazing sun'],
  ['VII', 'The Chariot', 'chariot', 'a warrior in a chariot pulled by one black and one white sphinx'],
  ['VIII', 'Strength', 'strength', 'a woman calmly closing a lion’s jaws with her bare hands'],
  ['IX', 'The Hermit', 'hermit', 'an old man in a grey cloak holding up a lantern with a star inside'],
  ['X', 'Wheel of Fortune', 'wheel-of-fortune', 'a giant spinning wheel with a sphinx on top and a snake sliding down'],
  ['XI', 'Justice', 'justice', 'a red-robed judge raising a sword in one hand and scales in the other'],
  ['XII', 'The Hanged Man', 'hanged-man', 'a calm man hanging upside down by one foot, his head glowing'],
  ['XIII', 'Death', 'death', 'a skeleton knight in black armour riding a white horse'],
  ['XIV', 'Temperance', 'temperance', 'an angel with one foot in a pool, pouring water between two cups'],
  ['XV', 'The Devil', 'devil', 'a horned goat-demon perched above two chained people'],
  ['XVI', 'The Tower', 'tower', 'a tower struck by lightning, its crown blasted off, people falling'],
  ['XVII', 'The Star', 'star', 'a naked woman kneeling by a pool, pouring water under one enormous star'],
  ['XVIII', 'The Moon', 'moon', 'a dog and a wolf howling at the moon while a crayfish crawls out of a pond'],
  ['XIX', 'The Sun', 'sun', 'a laughing child riding a white horse beneath a giant smiling sun'],
  ['XX', 'Judgement', 'judgement', 'an angel blasting a trumpet as the dead rise from their coffins'],
  ['XXI', 'The World', 'world', 'a dancer floating inside a laurel wreath, a wand in each hand'],
].map(([numeral, name, slug, image], id) => ({
  id,
  numeral,
  name,
  image,
  img: `assets/cards/web/${String(id).padStart(2, '0')}-${slug}.jpg`,
  hires: `assets/cards/hires/${String(id).padStart(2, '0')}-${slug}.jpg`,
}));

Taroe.cardById = (id) => Taroe.CARDS[id];

// "The Hanged Man" sorts and matches as "Hanged Man".
Taroe.cardSortName = (card) => card.name.replace(/^The\s+/i, '');

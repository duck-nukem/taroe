window.Taroe = window.Taroe || {};

(function (T) {
  'use strict';

  const KEY = 'taroe.settings.v1';

  // A walk through a house — replace with a place you know by heart.
  const DEFAULT_LOCI = [
    'Front door', 'Doormat', 'Coat hook', 'Hallway mirror', 'Staircase', 'Sofa',
    'Fireplace', 'Bookshelf', 'Window', 'Dining table', 'Kitchen sink', 'Stove',
    'Fridge', 'Back door', 'Garden path', 'Fountain', 'Shed', 'Bedroom door',
    'Bed', 'Wardrobe', 'Bathtub', 'Rooftop',
  ];

  const ROUTE_LENGTH = DEFAULT_LOCI.length; // one stop per Major Arcana card

  const DEFAULTS = {
    secondsPerCard: 2.5, // memorize time per new card, 1–5 (bosses shrink it during a run)
    mode: 'normal', // 'normal' (growing chain) | 'shuffle' (fresh spread each level)
    palace: true, // show memory palace loci under each slot
    loci: [], // the player's own stops; blanks fall back to DEFAULT_LOCI
    difficulty: 'normal', // 'easier' (+1 card per level) | 'normal' (+2) | 'hard' (+3)
    tutorialDone: false,
  };

  function load() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      /* storage unavailable — defaults only */
    }
    const s = { ...DEFAULTS, ...saved };
    delete s.revealTime; // superseded by secondsPerCard
    s.secondsPerCard = Math.max(1, Math.min(5, Number(s.secondsPerCard) || DEFAULTS.secondsPerCard));
    if (!Array.isArray(s.loci)) s.loci = [];
    // Older saves stored the example route itself; treat that as "nothing added yet".
    if (s.loci.join('|') === DEFAULT_LOCI.join('|')) s.loci = [];
    // Always exactly one (possibly blank) stop per card.
    s.loci = Array.from({ length: ROUTE_LENGTH }, (_, i) => String(s.loci[i] || '').trim());
    return s;
  }

  function save(s) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) {
      /* ignore */
    }
  }

  // The place shown for stop i: the player's own, or the example route's.
  const stopName = (s, i) => (s.loci[i] || '').trim() || DEFAULT_LOCI[i] || `Stop ${i + 1}`;

  T.Settings = { load, save, DEFAULTS, DEFAULT_LOCI, ROUTE_LENGTH, stopName };
})(window.Taroe);

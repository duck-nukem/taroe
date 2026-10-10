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

  const DEFAULTS = {
    revealTime: 5, // seconds, 1–7
    mode: 'normal', // 'normal' (growing chain) | 'shuffle' (fresh spread each level)
    palace: true, // show memory palace loci under each slot
    loci: DEFAULT_LOCI,
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
    s.revealTime = Math.max(1, Math.min(7, Number(s.revealTime) || DEFAULTS.revealTime));
    if (!Array.isArray(s.loci) || !s.loci.length) s.loci = DEFAULT_LOCI.slice();
    return s;
  }

  function save(s) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) {
      /* ignore */
    }
  }

  T.Settings = { load, save, DEFAULTS, DEFAULT_LOCI };
})(window.Taroe);

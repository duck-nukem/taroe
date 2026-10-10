(function (T) {
  'use strict';

  const settings = T.Settings.load();
  const ui = new T.UI(settings);
  const game = new T.Game({ settings, io: ui });
  ui.attach(game);

  // Warm the image cache so the first spread doesn't pop in.
  for (const c of T.CARDS) new Image().src = c.img;

  T.game = game; // handy for poking at state from the console
})(window.Taroe);

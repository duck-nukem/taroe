// Interactive memory palace (method of loci) tutorial, shown in the modal.

window.Taroe = window.Taroe || {};

(function (T) {
  'use strict';

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const PRACTICE = 5; // cards in the practice walk
  const ROUTE = 8; // stops edited in the route step
  const STEPS = ['Palace', 'Route', 'Images', 'Place', 'Walk', 'Play'];

  T.openPalaceTutorial = function (ui) {
    const s = ui.settings;
    const state = {
      step: 0,
      practice: shuffle(T.CARDS.map((c) => c.id)).slice(0, PRACTICE),
      learnIndex: 0,
      walkIndex: 0,
      answers: [],
    };
    const decoys = shuffle(T.CARDS.map((c) => c.id).filter((id) => !state.practice.includes(id))).slice(0, 3);
    state.choices = shuffle([...state.practice, ...decoys]);

    const locus = (i) => s.loci[i] || `Stop ${i + 1}`;
    const card = (id) => T.cardById(id);

    const progress = () => `
      <ol class="tut-progress">
        ${STEPS.map((name, i) => `<li class="${i < state.step ? 'done' : i === state.step ? 'on' : ''}">${name}</li>`).join('')}
      </ol>`;

    const nav = ({ back = true, next = 'Next', nextAttrs = '' } = {}) => `
      <div class="actions">
        <button data-act="close">Close</button>
        ${back && state.step > 0 ? '<button data-act="back">Back</button>' : ''}
        ${next ? `<button class="primary" data-act="next" ${nextAttrs}>${next}</button>` : ''}
      </div>`;

    const routeTrail = (filled) => `
      <ol class="trail">
        ${state.practice
          .map(
            (id, i) => `
          <li class="${i < filled ? 'filled' : i === filled ? 'here' : ''}">
            <span class="trail-stop">${i + 1}</span>
            <span class="trail-name">${esc(locus(i))}</span>
            ${i < filled ? `<img src="${card(id).img}" alt="">` : ''}
          </li>`
          )
          .join('')}
      </ol>`;

    const views = [
      // 0 — what it is
      () => ({
        html: `
          <h2>The memory palace</h2>
          <p>About 2,500 years ago the poet Simonides walked out of a banquet hall moments before its roof collapsed.
            He could name every guest buried in the rubble — by remembering <i>where each one had been sitting</i>.
            That is the <b>method of loci</b>: your brain is far better at remembering <i>places</i> and <i>vivid scenes</i>
            than lists.</p>
          <p>Memory champions — and the mentalists on TV — use it to recall hundreds of cards in order. In a 2017 study,
            ordinary people who practiced it for six weeks more than doubled how many words they could remember,
            and kept most of the gain four months later.</p>
          <p>The recipe has three parts:</p>
          <ol class="rules">
            <li><b>A route</b> you know by heart, broken into stops.</li>
            <li><b>A vivid image</b> for each thing you want to remember.</li>
            <li><b>Place</b> each image at the next stop. To recall, <b>walk</b> the route and look.</li>
          </ol>
          ${nav()}`,
      }),

      // 1 — build the route
      () => ({
        html: `
          <h2>Choose your route</h2>
          <p>Pick a place you could walk through blindfolded — your home is ideal. Walk it in a fixed direction
            and name distinct, physical stops: a door, a mirror, a sofa. Each stop holds one card, so its position
            in the spread <i>is</i> its stop on your walk.</p>
          <div class="route-edit">
            ${Array.from({ length: ROUTE }, (_, i) => `
              <label><span>${i + 1}</span><input data-locus="${i}" value="${esc(locus(i))}" maxlength="40"></label>`).join('')}
          </div>
          <p class="muted">Now close your eyes and walk it: front to back, then back to front. Can you see each stop?
            The rest of your ${T.CARDS.length}-stop route can be edited any time in Settings.</p>
          ${nav()}`,
        bind: (el) =>
          el.querySelectorAll('[data-locus]').forEach(
            (input) =>
              (input.oninput = () => {
                const loci = s.loci.slice();
                loci[Number(input.dataset.locus)] = input.value.trim() || T.Settings.DEFAULT_LOCI[Number(input.dataset.locus)];
                s.loci = loci;
                T.Settings.save(s);
                ui.renderSlots();
              })
          ),
      }),

      // 2 — making images
      () => {
        const id = state.practice[0];
        return {
          html: `
            <h2>Make it unforgettable</h2>
            <p>A card sitting politely at a stop will fade. A card <i>doing something</i> to that stop will stick. Four rules:</p>
            <div class="tips">
              <div><b>Exaggerate</b><span>Make it huge, tiny, or absurd.</span></div>
              <div><b>Animate</b><span>Something moves, breaks, crashes.</span></div>
              <div><b>Sense it</b><span>Hear it, smell it, feel the heat.</span></div>
              <div><b>Interact</b><span>The card uses or wrecks the place.</span></div>
            </div>
            <div class="example">
              <img src="${card(id).img}" alt="${esc(card(id).name)}">
              <div>
                <div class="lbl">Example — stop 1: ${esc(locus(0))}</div>
                <p><b>${esc(card(id).name)}</b> is ${esc(card(id).image)}.</p>
                <p class="vivid">Picture all of that crammed into your ${esc(locus(0).toLowerCase())} — bumping into it, too big for it,
                  making a racket. You can feel it as you walk past.</p>
              </div>
            </div>
            <p class="muted">Tip: the cards have strong pictures. Lean on one striking detail per card — the lion’s jaws,
              the upside-down man, the lightning — rather than the name.</p>
            ${nav({ next: 'Try it' })}`,
        };
      },

      // 3 — place five cards
      () => {
        const i = state.learnIndex;
        const id = state.practice[i];
        const last = i === PRACTICE - 1;
        return {
          html: `
            <h2>Place the cards — ${i + 1} of ${PRACTICE}</h2>
            ${routeTrail(i)}
            <div class="example big">
              <img src="${card(id).img}" alt="${esc(card(id).name)}">
              <div>
                <div class="lbl">Stop ${i + 1}: ${esc(locus(i))}</div>
                <h3>${esc(card(id).name)}</h3>
                <p>${esc(card(id).image[0].toUpperCase() + card(id).image.slice(1))}.</p>
                <p class="vivid">Put it at your <b>${esc(locus(i).toLowerCase())}</b>. What is it doing there? What does it sound like?
                  Hold the scene for a few seconds before moving on.</p>
              </div>
            </div>
            ${nav({ next: last ? 'Start the walk' : 'Next stop →' })}`,
          next: () => {
            if (last) state.step++;
            else state.learnIndex++;
          },
          back: () => {
            if (i > 0) state.learnIndex--;
            else state.step--;
          },
        };
      },

      // 4 — walk and recall
      () => {
        const i = state.walkIndex;
        const answered = state.answers.length > i;
        const right = state.practice[i];
        const done = state.answers.length === PRACTICE;
        return {
          html: `
            <h2>Walk the route</h2>
            <p>${done ? 'Walk complete.' : `You’re at stop ${i + 1}: <b>${esc(locus(i))}</b>. Who is there?`}</p>
            <div class="picker tut-picker">
              ${state.choices
                .map((id) => {
                  let cls = '';
                  if (answered && id === right) cls = 'correct';
                  else if (answered && id === state.answers[i] && id !== right) cls = 'wrong';
                  return `<button class="pcard ${cls}" data-pick="${id}" ${answered ? 'disabled' : ''} title="${esc(card(id).name)}">
                    <img src="${card(id).img}" alt="${esc(card(id).name)}"></button>`;
                })
                .join('')}
            </div>
            ${
              answered
                ? `<p class="${state.answers[i] === right ? 'good' : 'bad'}">${
                    state.answers[i] === right
                      ? `Yes — ${esc(card(right).name)} at the ${esc(locus(i).toLowerCase())}.`
                      : `It was ${esc(card(right).name)}. Picture it at the ${esc(locus(i).toLowerCase())} once more.`
                  }</p>`
                : ''
            }
            ${nav({ back: false, next: answered ? (i === PRACTICE - 1 ? 'See how you did' : 'Next stop →') : '', })}`,
          bind: (el) =>
            el.querySelectorAll('[data-pick]').forEach(
              (b) =>
                (b.onclick = () => {
                  state.answers[i] = Number(b.dataset.pick);
                  render();
                })
            ),
          next: () => {
            if (i === PRACTICE - 1) state.step++;
            else state.walkIndex++;
          },
        };
      },

      // 5 — results + how it maps onto the game
      () => {
        const score = state.answers.filter((id, i) => id === state.practice[i]).length;
        return {
          html: `
            <h2>${score === PRACTICE ? 'Perfect walk.' : score >= 3 ? 'Good walk.' : 'A first walk.'} ${score}/${PRACTICE}</h2>
            <p>${
              score === PRACTICE
                ? 'That’s the method working. It only gets stronger with a familiar route.'
                : 'It gets much easier with practice — the route becomes automatic and you only spend effort on the images.'
            }</p>
            <h3>Using it in Taroe</h3>
            <ul class="rules">
              <li>Each slot is labelled with its stop. Glance at the label, drop the card there, move on.</li>
              <li><b>Growing chain:</b> earlier cards keep their stops — you only add new scenes further along the walk.</li>
              <li><b>Cards never leave their stop.</b> When a boss moves a card, its place moves with it — your images stay valid, only the walk changes.</li>
              <li><b>The Trickster</b> swaps two cards: your walk now visits those two stops in swapped order.</li>
              <li><b>The Thief</b> steals one: that stop drops out of the walk. Remember who stood there.</li>
              <li><b>The Mirror</b> reverses the spread: walk your palace backwards.</li>
              <li><b>The Tower</b> scatters everything: same scenes, new route through them — learn the new walk.</li>
            </ul>
            ${nav({ next: 'Done' })}`,
          next: () => {
            s.tutorialDone = true;
            T.Settings.save(s);
            ui.closeModal(null);
            ui.renderStage();
          },
        };
      },
    ];

    let current;
    function render() {
      current = views[state.step]();
      ui.setModal(`<div class="tutorial">${progress()}${current.html}</div>`, (el) => {
        current.bind && current.bind(el);
        const q = (sel) => el.querySelector(sel);
        q('[data-act=close]').onclick = () => ui.closeModal(null);
        if (q('[data-act=back]'))
          q('[data-act=back]').onclick = () => {
            if (current.back) current.back();
            else state.step--;
            render();
          };
        if (q('[data-act=next]'))
          q('[data-act=next]').onclick = () => {
            if (current.next) current.next();
            else state.step++;
            if (!document.querySelector('#modal').hidden) render();
          };
      });
    }

    ui.openModal('', null);
    render();
  };
})(window.Taroe);

// Hasselblad V system mechanical interlock state machine (503CX body, CF lenses, A12 magazine).
// Models the real physical interlocks between body, lens, dark slide, and film magazine:
//
//   release   needs a wound body and, with a magazine on, the dark slide out.
//   crank     turns once: cocks body & lens, returns mirror, advances film a frame.
//             Blocked when wound, pre-released, or when a wound magazine sits on a fired body.
//   lens      mounts and dismounts only with both body and lens cocked (coupling slot at red dot).
//   magazine  detaches only with the dark slide in; slide pulls only while mounted.
//   signals   white = wound, red = released / exposed, on both body and magazine.

export const FRAMES = 12;

const DEFAULT_MESSAGES = {
  'refuse.release.notWound': "The release won't go down because the camera has already fired. Turn the crank to wind it on.",
  'refuse.release.slideIn': 'The release is locked while the dark slide is in. Pull the slide out of the magazine to shoot.',
  'refuse.wind.pre': "The crank won't turn while the mirror is pre-released. Press the release to make the exposure first.",
  'refuse.wind.wound': 'The camera is already wound and ready to shoot.',
  'refuse.wind.mismatch': 'The magazine is already wound (white) while the body is fired (red). Detach the magazine before winding the body.',
  'refuse.pre.already': 'The mirror is already pre-released.',
  'refuse.pre.notWound': 'Wind the camera before using mirror pre-release.',
  'refuse.lensOff.pre': 'Cannot remove the lens while the mirror is pre-released.',
  'refuse.lensOff.notWound': 'Both body and lens must be cocked before removing the lens.',
  'refuse.lensOn.lensFired': 'The lens shutter is uncocked. Cock the rear coupling slot clockwise to the red dot before mounting.',
  'refuse.lensOn.bodyFired': 'The camera body is uncocked. Wind the crank before mounting a lens.',
  'refuse.slideOut.magOff': 'The dark slide is locked while the magazine is off the camera.',
  'refuse.magOff.slideOut': 'Insert the dark slide before removing the magazine.',
  'refuse.insert.midRoll': 'A roll is in progress. Finish all 12 frames before removing the film insert.',
  'refuse.insert.openFirst': 'Unlock and draw out the film insert first.',
  'refuse.magCrank.open': 'Close and lock the film insert before winding to frame 1.',
  'refuse.magCrank.ready': 'The roll is already wound to frame 1.',
  'refuse.magCrank.notLoaded': 'Load a fresh roll of 120 film first.',
  'refuse.film.midRoll': 'Finish the current roll before changing film stocks in this magazine.',
  'notice.noLens': 'Fired with no lens mounted.',
  'notice.noLens.fogged': 'Fired with no lens mounted — the film frame was fogged.',
  'notice.roll.done': 'Roll finished (12/12 exposures).',
  'notice.roll.notReady': 'Wind the magazine crank to frame 1 before shooting.',
  'notice.double': 'Double exposure recorded on the same frame.',
  'notice.rollEnd': 'Frame 12 exposed — roll complete.',
  'notice.lensCocked': 'Lens coupling slot is already cocked.',
  'notice.signals.bodyWound': 'Signal mismatch: body is wound (white), magazine is exposed (red).',
  'notice.signals.bodyFired': 'Signal mismatch: body is fired (red), magazine is wound (white).',
  'notice.frame1': 'Magazine wound to frame 1 and ready.',
  'notice.film.load': 'Film stock queued for the next roll.',
  'notice.magLoaded.A': 'Magazine A loaded and wound to frame 1.',
  'notice.magLoaded.B': 'Magazine B loaded and wound to frame 1.',
};

export function createMechanism(cam, host) {
  const m = {
    bodyCocked: true, lensCocked: true, lensOn: true, released: false, pre: false,
    magOn: true, slideIn: false, magWound: true, roll: 'ready', frame: 1, insertOut: false, windK: 0,
    busy: false, lastDouble: false,
    mags: [
      { id: 'A', film: host.s.film.id, roll: 'ready', frame: 1, magWound: true, slideIn: false },
      { id: 'B', film: 'ilford-hp5-400-v2', roll: 'ready', frame: 1, magWound: true, slideIn: true },
    ],
    cur: 0,
  };
  const MAGF = ['roll', 'frame', 'magWound', 'slideIn'];
  const fileMag = () => { const g = m.mags[m.cur]; MAGF.forEach((k) => { g[k] = m[k]; }); };
  const listeners = new Set();
  const emit = (type, detail = {}) => listeners.forEach((fn) => fn(type, detail));
  const resolveText = (voice) => host.screenText?.(voice) ?? DEFAULT_MESSAGES[voice] ?? voice;
  const say = (text, ms = 4200, voice) => { host.toast?.(text ?? resolveText(voice), ms); if (voice) host.voice?.(voice); };
  const blocked = (action, why, balkKey, voice = `refuse.${action}.${why}`) => { if (balkKey) cam.balk(balkKey); say(null, 5200, voice); emit('blocked', { action, why }); return false; };
  const signals = () => { cam.setSignals(!m.bodyCocked || m.pre, !m.magWound); emit('signals', { body: m.bodyCocked && !m.pre ? 'white' : 'red', mag: m.magWound ? 'white' : 'red' }); };
  const syncFrame = () => { host.s.frame = m.roll === 'ready' ? m.frame : m.roll === 'done' ? FRAMES : 0; cam.setRoll?.(m.roll, m.frame); cam.setRings(host.ringState()); };
  const once = async (fn) => { if (m.busy) return false; m.busy = true; try { return await fn(); } finally { m.busy = false; } };

  async function release() {
    return once(async () => {
      if (!m.bodyCocked && !m.pre) return blocked('release', 'notWound', 'press');
      if (m.magOn && m.slideIn) return blocked('release', 'slideIn', 'press');
      const lens = m.lensOn, film = m.magOn && !m.slideIn && m.roll === 'ready';
      const double = film && !m.magWound;
      await cam.releaseCycle({
        seconds: host.s.shutter, pre: m.pre, lens,
        onMirror: host.setMirror, onSound: host.sound,
        onExpose: async () => { if (film) await host.expose({ double, noLens: !lens }); },
      });
      m.bodyCocked = false; m.released = true; m.pre = false;
      if (lens) { m.lensCocked = false; cam.setCoupling(1, 0.05); }
      if (film) m.magWound = false;
      m.lastDouble = double;
      signals();
      if (!lens) say(null, 4200, film ? 'notice.noLens.fogged' : 'notice.noLens');
      else if (m.magOn && m.roll !== 'ready') say(null, 4200, m.roll === 'done' ? 'notice.roll.done' : 'notice.roll.notReady');
      else if (double) say(null, 4800, 'notice.double');
      emit('fired', { lens, film, double, pre: false });
      return true;
    });
  }

  function canWind() {
    if (m.pre) return blocked('wind', 'pre', 'crank');
    if (m.bodyCocked) return blocked('wind', 'wound', 'crank');
    if (m.magOn && m.magWound && m.roll === 'ready') return blocked('wind', 'mismatch', 'crank');
    return true;
  }

  function windBy(dk) {
    if (m.busy || dk <= 0) return;
    if (m.windK === 0 && !canWind()) { m.windDenied = true; return; }
    if (m.windDenied) return;
    m.windK = Math.min(1, m.windK + dk);
    cam.windTo(m.windK, { lens: m.lensOn, released: m.released });
    if (m.windK >= 1) finishWind();
  }

  function windEnd() { m.windDenied = false; }

  function finishWind() {
    m.windK = 0;
    m.bodyCocked = true; m.released = false;
    if (m.lensOn) { m.lensCocked = true; cam.setCoupling(0, 0.05); }
    host.setMirror(false);
    let advanced = false;
    if (m.magOn && m.roll === 'ready' && !m.magWound) {
      m.magWound = true; advanced = true;
      if (m.frame >= FRAMES) { m.roll = 'done'; say(null, 5200, 'notice.rollEnd'); }
      else m.frame += 1;
    }
    cam.crankHome();
    signals(); syncFrame();
    emit('wound', { advanced, frame: m.frame });
  }

  async function wind() {
    if (m.busy || !canWind()) return false;
    return once(async () => {
      await new Promise((res) => {
        let t = 0;
        const step = () => { t += 1 / 50; m.windK = Math.min(1, t); cam.windTo(m.windK, { lens: m.lensOn, released: m.released }); if (t < 1) requestAnimationFrame(step); else res(); };
        requestAnimationFrame(step);
      });
      host.sound('wind');
      finishWind();
      return true;
    });
  }

  async function preRelease() {
    return once(async () => {
      if (m.pre) return blocked('pre', 'already', 'pre');
      if (!m.bodyCocked) return blocked('pre', 'notWound', 'pre');
      await cam.preRelease({ onMirror: host.setMirror, onSound: host.sound, lens: m.lensOn });
      m.pre = true; signals();
      emit('pre', {});
      return true;
    });
  }

  const mountLens = () => lens(false);

  async function lens(off = m.lensOn) {
    return once(async () => {
      if (off) {
        if (!m.lensOn) return false;
        if (m.pre) return blocked('lensOff', 'pre');
        if (!m.bodyCocked || !m.lensCocked) return blocked('lensOff', 'notWound');
        host.sound('leafClose');
        await cam.lensOff(true);
        m.lensOn = false; emit('lensOff', {});
        return true;
      }
      if (m.lensOn) return false;
      if (!m.lensCocked) { await cam.lensBalk(); return blocked('lensOn', 'lensFired'); }
      if (!m.bodyCocked) { await cam.lensBalk(); return blocked('lensOn', 'bodyFired'); }
      await cam.lensOff(false);
      m.lensOn = true; emit('lensOn', {});
      return true;
    });
  }

  async function cockLens() {
    return once(async () => {
      if (m.lensOn) return false;
      if (m.lensCocked) { say(null, 4200, 'notice.lensCocked'); return false; }
      await cam.setCoupling(0, 1.1);
      m.lensCocked = true; emit('lensCocked', {});
      return true;
    });
  }

  async function fireLensOff() { if (m.lensOn) return; m.lensCocked = false; await cam.setCoupling(1, 0.15); host.sound('leafClose'); }

  async function slide(out = m.slideIn) {
    return once(async () => {
      if (out) {
        if (!m.slideIn) return false;
        if (!m.magOn) return blocked('slideOut', 'magOff');
        await cam.setSlide(true);
        m.slideIn = false; emit('slide', { in: false });
        return true;
      }
      if (m.slideIn) return false;
      await cam.setSlide(false);
      m.slideIn = true; emit('slide', { in: true });
      return true;
    });
  }

  async function magazine(off = m.magOn) {
    return once(async () => {
      if (off) {
        if (!m.magOn) return false;
        if (!m.slideIn) return blocked('magOff', 'slideOut', 'magOff');
        await cam.setMagOff(true);
        m.magOn = false; emit('magOff', {});
        return true;
      }
      if (m.magOn) return false;
      await cam.setMagOff(false);
      m.magOn = true;
      const body = m.bodyCocked && !m.pre ? 'white' : 'red', mag = m.magWound ? 'white' : 'red';
      if (body !== mag && m.roll === 'ready') say(null, 600, body === 'white' ? 'notice.signals.bodyWound' : 'notice.signals.bodyFired');
      emit('magOn', { match: body === mag });
      return true;
    });
  }

  async function insert(out = !m.insertOut) {
    return once(async () => {
      if (out === m.insertOut) return false;
      if (out && m.roll === 'ready') { cam.balk('keyA', -0.22); return blocked('insert', 'midRoll'); }
      const finishing = !out && cam.loadStage;
      await cam.setInsertOut(out);
      if (finishing) { m.roll = 'loaded'; m.magWound = false; m.frame = 1; syncFrame(); signals(); emit('roll', { state: 'loaded' }); }
      m.insertOut = out;
      emit('insert', { out });
      return true;
    });
  }

  let busyLoad = false;
  async function loadStage(to, type, detail) {
    if (!m.insertOut) return say(null, 4200, 'refuse.insert.openFirst');
    if (m.roll === 'ready') return false;
    const g = m.mags[m.cur];
    if (g.pending) { g.film = g.pending; delete g.pending; host.setFilm(g.film); }
    if (busyLoad) return false;
    busyLoad = true;
    try { await cam.loadPhase?.(to); } finally { busyLoad = false; }
    emit(type, detail);
    return true;
  }

  const loadSpools = () => loadStage('spools', 'roll', { state: 'spools' });
  const openClamp = () => loadStage('clamp', 'clamp', { open: true });
  const threadLeader = () => loadStage('leader', 'leader', {});
  const alignArrow = () => loadStage('aligned', 'roll', { state: 'aligned' });

  async function loadRoll() {
    if (!m.insertOut) return say(null, 4200, 'refuse.insert.openFirst');
    const g = m.mags[m.cur];
    if (g.pending) { g.film = g.pending; delete g.pending; host.setFilm(g.film); }
    if (busyLoad) return;
    busyLoad = true;
    try { await cam.loadRoll?.(); } finally { busyLoad = false; }
    m.roll = 'loaded'; m.magWound = false; m.frame = 1; syncFrame(); signals();
    emit('roll', { state: 'loaded' });
  }

  async function magCrank() {
    return once(async () => {
      if (m.insertOut) return blocked('magCrank', 'open');
      if (m.roll !== 'loaded') return blocked('magCrank', 'notLoaded', undefined, m.roll === 'ready' ? 'refuse.magCrank.ready' : 'refuse.magCrank.notLoaded');
      host.sound('wind');
      await new Promise((r) => setTimeout(r, 900));
      m.roll = 'ready'; m.frame = 1; m.magWound = true;
      syncFrame(); signals();
      emit('roll', { state: 'ready' });
      say(null, 4200, 'notice.frame1');
      return true;
    });
  }

  async function fitMagazine(i) {
    if (i === m.cur && m.magOn) return false;
    if (m.magOn) { const ok = await magazine(true); if (!ok) return false; }
    fileMag();
    m.cur = i; const g = m.mags[i];
    MAGF.forEach((k) => { m[k] = g[k]; });
    host.setFilm(g.film); cam.st.slideOut = m.slideIn ? 0 : 1;
    syncFrame(); signals();
    emit('magSelect', { id: g.id });
    return magazine(false);
  }

  function chooseFilm(i, filmId) {
    const g = m.mags[i];
    if (i === m.cur && m.magOn) {
      if (m.roll === 'ready' && m.frame > 1) { say(null, 5600, 'refuse.film.midRoll'); emit('blocked', { action: 'film', why: 'midRoll' }); return false; }
      if (m.roll === 'done') { g.pending = filmId; say(null, 4200, 'notice.film.load'); emit('filmChosen', { id: filmId }); return true; }
      g.film = filmId; host.setFilm(filmId); emit('filmChosen', { id: filmId }); return true;
    }
    if (i === m.cur) fileMag();
    Object.assign(g, { film: filmId, roll: 'ready', frame: 1, magWound: true, slideIn: true });
    if (i === m.cur) { MAGF.forEach((k) => { m[k] = g[k]; }); host.setFilm(filmId); syncFrame(); signals(); }
    say(null, 4200, `notice.magLoaded.${g.id}`);
    emit('filmChosen', { id: filmId });
    return true;
  }

  async function swapLens(lensObj) {
    if (lensObj.id === host.s.lens.id && m.lensOn) return false;
    if (m.pre) return blocked('lensOff', 'pre');
    if (!m.bodyCocked || (m.lensOn && !m.lensCocked)) { cam.balk('lensTwist', 0.15); return blocked('lensOff', 'notWound'); }
    if (!m.lensOn && lensObj.id === host.s.lens.id) return mountLens();
    return once(async () => {
      await host.changeLens(lensObj);
      m.lensOn = true; m.lensCocked = true; cam.st.lensOut = 0; cam.st.lensTwist = 0; cam.setCoupling(0, 0.05);
      emit('lensSwap', { id: lensObj.id });
      return true;
    });
  }

  function reset(over = {}) {
    Object.assign(m, { bodyCocked: true, lensCocked: true, lensOn: true, released: false, pre: false, magOn: true, slideIn: false, magWound: true, roll: 'ready', frame: m.frame || 1, insertOut: false, windK: 0, busy: false }, over);
    fileMag();
    const st = cam.st;
    st.press = 0; st.pre = 0; st.crank = 0;
    st.mirrorK = m.released || m.pre ? 1 : 0; st.auxK = st.mirrorK; st.leafK = m.lensOn && !m.released && !m.pre ? 1 : 0;
    st.lensOut = m.lensOn ? 0 : 1; st.lensTwist = m.lensOn ? 0 : 1;
    st.slideOut = m.slideIn ? 0 : 1; st.magOff = m.magOn ? 0 : 1; st.insertOut = m.insertOut ? 1 : 0;
    st.coupling = m.lensCocked ? 0 : 1;
    host.setMirror(st.mirrorK > 0.5);
    signals(); syncFrame();
  }

  return {
    state: m, on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }, emit,
    release, wind, windBy, windEnd, preRelease, lens, cockLens, fireLensOff, slide, magazine, insert, loadRoll, loadSpools, openClamp, threadLeader, alignArrow, magCrank, reset,
    fitMagazine, chooseFilm, swapLens,
  };
}

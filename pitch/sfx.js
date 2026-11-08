// Because · zvučni efekti za animaciju sastanka (board-scene.html). Sve je sintetizovano (Web Audio), bez fajlova.
// „Govor“ je mrmljanje po slogovima: pila kroz dva formantna filtera (samoglasnici), svaki lik ima svoj glas.
window.SFX = (() => {
  let ctx = null, out = null, bus = null, muted = false;

  function wire(c, dest) {
    ctx = c;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.18;
    out = c.createGain();
    out.gain.value = muted ? 0 : 0.8;
    out.connect(comp); comp.connect(dest);
    bus = c.createGain(); bus.connect(out);
  }
  function init() {
    if (ctx) return ctx;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    const c = new C();
    wire(c, c.destination);
    return ctx;
  }
  const ready = () => ctx && bus && !muted && (ctx.state === "running" || typeof OfflineAudioContext !== "undefined" && ctx instanceof OfflineAudioContext);

  // Glas: osnovni ton (Hz), raspon nasumičnih tonova (polutonovi), slog (ms), jačina, pomeranje formanata.
  const VOICES = {
    ceo:   { pitch: 112, range: 4, rate: 112, vol: 1.0, formant: 0.88 },
    cto:   { pitch: 150, range: 4, rate: 92,  vol: 0.9, formant: 0.95 },
    pm:    { pitch: 196, range: 7, rate: 86,  vol: 0.85, formant: 1.06 },
    sales: { pitch: 236, range: 9, rate: 72,  vol: 0.85, formant: 1.12 },
    us:    { pitch: 178, range: 6, rate: 96,  vol: 0.95, formant: 1.0, nasal: true },
  };
  // Samoglasnici kao par formanata (F1, F2): a, e, i, o, u, ə.
  const VOWELS = [[800, 1200], [430, 1950], [320, 2250], [520, 900], [360, 760], [560, 1450]];

  function syllable(t, v, o) {
    const f0 = v.pitch * (o.shout ? 1.38 : 1) * Math.pow(2, ((Math.random() * 2 - 1) * v.range) / 12);
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.linearRampToValueAtTime(f0 * (o.contour || 1), t + o.dur);
    const [F1, F2] = o.vowel || VOWELS[Math.floor(Math.random() * VOWELS.length)];
    const b1 = ctx.createBiquadFilter(); b1.type = "bandpass"; b1.frequency.value = F1 * v.formant; b1.Q.value = 4.5;
    const b2 = ctx.createBiquadFilter(); b2.type = "bandpass"; b2.frequency.value = F2 * v.formant; b2.Q.value = v.nasal ? 11 : 7;
    const g2 = ctx.createGain(); g2.gain.value = v.nasal ? 0.9 : 0.6;
    const env = ctx.createGain();
    const peak = 2.2 * v.vol * (o.shout ? 1.2 : 1) * (o.gain || 1);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + 0.014);
    env.gain.setValueAtTime(peak, t + o.dur * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(b1); osc.connect(b2); b1.connect(env); b2.connect(g2); g2.connect(env); env.connect(bus);
    osc.start(t); osc.stop(t + o.dur + 0.03);
  }

  // Mrmljanje za ceo tekst oblačića: slog po grupi samoglasnika, pauze na zarezima i tačkama,
  // ton ide gore na „?“, dole na „.“. Vraća trajanje u sekundama.
  function talk(who, text, o = {}) {
    if (!ready() || !text) return 0;
    const v = VOICES[who] || VOICES.pm;
    const rate = ((o.rate || v.rate) * (o.shout ? 0.76 : 1)) / (o.speed || 1) / 1000;
    const t0 = ctx.currentTime + 0.03;
    let t = t0;
    const tokens = text.match(/[A-Za-z0-9%']+|[.,!?…]+/g) || [];
    tokens.forEach((tok, i) => {
      if (/^[.,!?…]+$/.test(tok)) { t += rate * (tok.includes(",") ? 1.1 : 1.9); return; }
      const n = Math.max(1, (tok.match(/[aeiouy]+/gi) || []).length);
      const next = tokens[i + 1] || "";
      for (let s = 0; s < n; s++) {
        const last = s === n - 1;
        const contour = last && next.includes("?") ? 1.22 : last && /[.!]/.test(next) ? 0.86 : 0.98 + Math.random() * 0.06;
        syllable(t, v, { dur: rate * 0.86, shout: o.shout, contour });
        t += rate;
      }
      t += rate * 0.22;
    });
    return t - t0;
  }

  // „Erm..“: razvučeno „ööö“ koje se zatvori u „mmm“ (nosni zvuk = niskopropusni filter se zatvara).
  function hum(who, ms) {
    if (!ready()) return;
    const v = VOICES[who] || VOICES.us;
    const t = ctx.currentTime + 0.02, d = ms / 1000;
    const osc = ctx.createOscillator(); osc.type = "sawtooth";
    osc.frequency.setValueAtTime(v.pitch * 1.02, t);
    osc.frequency.linearRampToValueAtTime(v.pitch * 0.9, t + d);
    const vib = ctx.createOscillator(), vibG = ctx.createGain();
    vib.frequency.value = 5.5; vibG.gain.value = 2.2; vib.connect(vibG); vibG.connect(osc.frequency);
    const b1 = ctx.createBiquadFilter(); b1.type = "bandpass"; b1.Q.value = 4;
    b1.frequency.setValueAtTime(520, t); b1.frequency.linearRampToValueAtTime(300, t + d * 0.6);
    const b2 = ctx.createBiquadFilter(); b2.type = "bandpass"; b2.Q.value = 8; b2.frequency.value = 1500;
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.7, t); g2.gain.linearRampToValueAtTime(0.02, t + d * 0.6);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(3000, t); lp.frequency.linearRampToValueAtTime(420, t + d * 0.6);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1.3, t + 0.05);
    env.gain.setValueAtTime(1.3, t + d * 0.55);
    env.gain.linearRampToValueAtTime(1.0, t + d * 0.8);
    env.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(b1); osc.connect(b2); b1.connect(lp); b2.connect(g2); g2.connect(lp); lp.connect(env); env.connect(bus);
    osc.start(t); vib.start(t); osc.stop(t + d + 0.05); vib.stop(t + d + 0.05);
  }

  // Tih „blup“ kad se oblačić pojavi.
  function pop(gain = 1) {
    if (!ready()) return;
    const t = ctx.currentTime + 0.01;
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(330, t); o.frequency.exponentialRampToValueAtTime(760, t + 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.13);
  }

  let noise = null;
  function noiseBuf() {
    if (noise && noise.sampleRate === ctx.sampleRate) return noise;
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noise;
  }
  // Prelet kamere: šum kroz filter koji se otvori pa zatvori.
  function whoosh(ms, gain = 1) {
    if (!ready()) return;
    const t = ctx.currentTime + 0.01, d = ms / 1000;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf(); src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(260, t); bp.frequency.exponentialRampToValueAtTime(1500, t + d * 0.5); bp.frequency.exponentialRampToValueAtTime(320, t + d);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32 * gain, t + d * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(bp); bp.connect(g); g.connect(bus); src.start(t); src.stop(t + d + 0.05);
  }

  function bell(t, f, peak, decay) {
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + decay + 0.02);
  }
  // Odsjaj na naočarima: „ting“.
  function ting() {
    if (!ready()) return;
    const t = ctx.currentTime + 0.01;
    bell(t, 2637, 0.14, 0.7); bell(t, 3951, 0.06, 0.45); bell(t + 0.09, 3520, 0.08, 0.5);
  }
  // Kažiprst gore: kratak „tik“.
  function tick() {
    if (!ready()) return;
    const t = ctx.currentTime + 0.01;
    const o = ctx.createOscillator(); o.type = "triangle";
    o.frequency.setValueAtTime(1180, t); o.frequency.exponentialRampToValueAtTime(820, t + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.1);
  }
  // Naslovna kartica: mek akord, ton po ton.
  function chime() {
    if (!ready()) return;
    const t = ctx.currentTime + 0.02;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { bell(t + i * 0.11, f, 0.09, 1.6); bell(t + i * 0.11, f * 2, 0.015, 0.8); });
  }

  // Prekid (preskok na naslovnu, ponovo): sve zakazano na starom kanalu se utiša i odbaci.
  function stopAll() {
    if (!ctx || !bus) return;
    const old = bus;
    old.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
    setTimeout(() => { try { old.disconnect(); } catch (e) {} }, 300);
    bus = ctx.createGain(); bus.connect(out);
  }

  return {
    // Da li pregledač pušta zvuk bez klika (obično ne, dok korisnik ne pritisne taster ili klikne).
    canAutoplay() { const c = init(); return !!c && c.state === "running"; },
    unlock() { const c = init(); if (c && c.state === "suspended") c.resume(); },
    setMuted(m) { muted = m; if (out) out.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.03); },
    get muted() { return muted; },
    talk, hum, pop, whoosh, ting, tick, chime, stopAll,
    // Za proveru jačine bez zvučnika: isti zvukovi u OfflineAudioContext.
    _attach(c) { wire(c, c.destination); },
  };
})();

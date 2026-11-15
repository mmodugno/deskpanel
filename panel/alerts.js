let ctx = null;
let wakeLock = null;

export async function arm() {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    await ctx.resume();
  } catch {}
  await keepAwake();
}

async function keepAwake() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {}
}

// El wake lock se pierde al ocultar la pestaña: se vuelve a pedir.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wakeLock) keepAwake();
});

function beep(freqs) {
  if (!ctx || ctx.state !== 'running') return;
  let t = ctx.currentTime;
  for (const f of freqs) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
    t += 0.22;
  }
}

export function notify(kind, flashEl) {
  if (kind === 'permission') {
    beep([660, 880, 1046]);
    navigator.vibrate?.([250, 80, 250, 80, 250]);
  } else if (kind === 'waiting') {
    beep([660, 880, 660]);
    navigator.vibrate?.([200, 100, 200]);
    flashEl.classList.remove('on');
    void flashEl.offsetWidth; // reinicia la animación
    flashEl.classList.add('on');
  } else if (kind === 'done') {
    beep([523, 784]);
    navigator.vibrate?.(120);
  }
}

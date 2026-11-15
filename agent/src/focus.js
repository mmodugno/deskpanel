// Temporizador de foco (pomodoro). Vive en el agente para que el celular y la
// tablet vean lo mismo y sobreviva a recargar la página.
export const DEFAULT_FOCUS = { workMin: 25, breakMin: 5, longBreakMin: 15, cycles: 4 };

const ACTIONS = new Set(['start', 'pause', 'reset', 'skip']);

export function createFocus({ config = {}, now = () => Date.now(), onChange = () => {} } = {}) {
  const cfg = { ...DEFAULT_FOCUS, ...config };
  const minutes = (phase) =>
    phase === 'work' ? cfg.workMin : phase === 'longbreak' ? cfg.longBreakMin : cfg.breakMin;

  let day = new Date(now()).toDateString();
  let s = {
    phase: 'work',
    running: false,
    remainingMs: cfg.workMin * 60000,
    endsAt: null,
    cycle: 0, // pomodoros completados en la tanda actual
    today: 0,
    transitions: 0, // sube cada vez que termina una fase (el panel lo usa para avisar)
  };

  const snapshot = () => ({ ...s, totalMs: minutes(s.phase) * 60000, config: cfg });
  const emit = () => onChange(snapshot());

  function rollDay() {
    const d = new Date(now()).toDateString();
    if (d !== day) {
      day = d;
      s.today = 0;
    }
  }

  function enter(phase, running) {
    s.phase = phase;
    s.remainingMs = minutes(phase) * 60000;
    s.running = running;
    s.endsAt = running ? now() + s.remainingMs : null;
  }

  function finishPhase() {
    rollDay();
    s.transitions += 1;
    if (s.phase === 'work') {
      s.today += 1;
      s.cycle += 1;
      const long = s.cycle >= cfg.cycles;
      if (long) s.cycle = 0;
      enter(long ? 'longbreak' : 'break', true); // el descanso arranca solo
    } else {
      enter('work', false); // el próximo pomodoro espera a que lo inicies
    }
  }

  return {
    act(action) {
      if (!ACTIONS.has(action)) return false;
      rollDay();
      if (action === 'start' && !s.running) {
        s.running = true;
        s.endsAt = now() + s.remainingMs;
      } else if (action === 'pause' && s.running) {
        s.remainingMs = Math.max(0, s.endsAt - now());
        s.running = false;
        s.endsAt = null;
      } else if (action === 'reset') {
        s.cycle = 0;
        enter('work', false);
      } else if (action === 'skip') {
        const wasWork = s.phase === 'work';
        // saltar no cuenta como pomodoro hecho
        enter(wasWork ? 'break' : 'work', wasWork);
      }
      emit();
      return true;
    },
    // Se llama seguido (cada medio segundo) y en los tests con un reloj falso.
    tick() {
      if (s.running && now() >= s.endsAt) {
        finishPhase();
        emit();
        return true;
      }
      return false;
    },
    state: snapshot,
  };
}

export function startFocus(bus, config) {
  const focus = createFocus({ config, onChange: (st) => bus.publish('focus', st) });
  bus.publish('focus', focus.state());
  const timer = setInterval(() => focus.tick(), 500);
  timer.unref();
  return focus;
}

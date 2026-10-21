let noteContext: AudioContext | null = null;
let lastNote = 0;

export function noteAudio() {
  const Context = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  if (!noteContext) noteContext = new Context();
  if (noteContext.state === 'suspended' || noteContext.state === 'interrupted') {
    void noteContext.resume();
  }
  return noteContext;
}

function voice(context: AudioContext, frequency: number, start: number, duration: number, peak: number) {
  [1, 2, 3, 4].forEach((harmonic, index) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency * harmonic;
    const amount = peak * [1, 0.28, 0.12, 0.05][index];
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(amount, 0.0002), start + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  });
}

function play(run: (context: AudioContext) => void) {
  const context = noteAudio();
  if (!context) return;
  const doPlay = () => run(context);
  if (context.state !== 'running') {
    context.resume().then(doPlay).catch(() => undefined);
    return;
  }
  doPlay();
}

export function playSendTick() {
  play((context) => {
    const now = context.currentTime;
    voice(context, 880, now, 0.16, 0.06);
  });
}

// A short, bright bell strike: a sharp attack and a quick natural fade, with the
// slightly "glassy" overtones of a struck bar.
function bell(context: AudioContext, frequency: number, start: number, duration: number, peak: number) {
  [[1, 1], [2.0, 0.35], [3.01, 0.12], [4.2, 0.05]].forEach(([ratio, level]) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency * ratio;
    const amount = peak * level;
    // Higher overtones die away faster, like a real bell.
    const fade = duration / (1 + (ratio - 1) * 0.6);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(amount, 0.0002), start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + fade);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(start);
    osc.stop(start + fade + 0.05);
  });
}

// New message: a quick, bright two-note chime in the spirit of the iPhone "Note" text tone.
export function playMessageNote() {
  const stamp = Date.now();
  if (stamp - lastNote < 1500) return;
  lastNote = stamp;
  play((context) => {
    const now = context.currentTime;
    bell(context, 1046.5, now, 0.45, 0.16);
    bell(context, 1567.98, now + 0.085, 0.6, 0.14);
  });
}

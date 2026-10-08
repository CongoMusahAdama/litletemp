let noteContext: AudioContext | null = null;
let lastNote = 0;

export function noteAudio() {
  const Context = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  if (!noteContext) noteContext = new Context();
  if (noteContext.state === "suspended") void noteContext.resume();
  return noteContext;
}

function voice(context: AudioContext, frequency: number, start: number, duration: number, peak: number) {
  [1, 2, 3, 4].forEach((harmonic, index) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "sine";
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
  const start = () => run(context);
  if (context.state === "suspended") {
    void context.resume().then(start);
    return;
  }
  start();
}

export function playSendTick() {
  play((context) => {
    const now = context.currentTime;
    voice(context, 880, now, 0.16, 0.05);
  });
}

export function playMessageNote() {
  const stamp = Date.now();
  if (stamp - lastNote < 2000) return;
  lastNote = stamp;
  play((context) => {
    const now = context.currentTime;
    voice(context, 523.25, now, 0.7, 0.09);
    voice(context, 659.25, now + 0.18, 0.85, 0.08);
    voice(context, 783.99, now + 0.36, 1.05, 0.07);
  });
}

// Call tones made with Web Audio, so no sound files are needed.
import { noteAudio } from "./note";

function tone(context: AudioContext, frequencies: number[], start: number, duration: number, volume: number, type: OscillatorType = "sine") {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.setValueAtTime(volume, start + Math.max(0.03, duration - 0.04));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  gain.connect(context.destination);
  frequencies.forEach((frequency) => {
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    osc.connect(gain);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  });
}

function withContext(run: (context: AudioContext) => void) {
  const context = noteAudio();
  if (!context) return;
  if (context.state !== "running") {
    context.resume().then(() => run(context)).catch(() => undefined);
    return;
  }
  run(context);
}

/** Repeats a pattern until the returned stop function is called. */
function loop(everyMs: number, pattern: (context: AudioContext, at: number) => void, onTick?: () => void) {
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    withContext((context) => pattern(context, context.currentTime + 0.02));
    onTick?.();
  };
  tick();
  const timer = window.setInterval(tick, everyMs);
  return () => {
    stopped = true;
    window.clearInterval(timer);
  };
}

/** "Tuuut… tuuut…" heard by the caller while the other phone rings. */
export function startRingback() {
  return loop(3000, (context, at) => tone(context, [440, 480], at, 1.4, 0.05));
}

/** A friendly ringtone (and vibration) for an incoming call. */
export function startRingtone() {
  const stop = loop(
    2200,
    (context, at) => {
      [659.25, 783.99, 987.77, 783.99, 659.25, 987.77].forEach((note, index) => {
        tone(context, [note, note * 2], at + index * 0.14, 0.13, 0.07, "triangle");
      });
    },
    () => navigator.vibrate?.([400, 200, 400]),
  );
  return () => {
    stop();
    navigator.vibrate?.(0);
  };
}

/** Two rising blips when the call connects. */
export function playConnectBeep() {
  withContext((context) => {
    const at = context.currentTime + 0.02;
    tone(context, [660], at, 0.12, 0.08);
    tone(context, [990], at + 0.15, 0.16, 0.08);
  });
}

/** Three falling beeps when the call ends or is declined. */
export function playEndBeep() {
  withContext((context) => {
    const at = context.currentTime + 0.02;
    [620, 480, 400].forEach((note, index) => tone(context, [note], at + index * 0.22, 0.18, 0.07));
  });
}

// Small Web Audio beep helper for the classroom toolkit (timer/buzzer sound
// cues). The legacy app synthesizes similar short oscillator tones — this is
// a fresh minimal reimplementation of that same idea, not a port (the
// original's tone generator isn't complex enough to warrant verbatim copying).
let sharedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedContext) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    sharedContext = new Ctor();
  }
  return sharedContext;
}

export function beep(frequency = 880, durationMs = 150, volume = 0.2) {
  const ctx = getContext();
  if (!ctx) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.value = volume;
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
  oscillator.stop(ctx.currentTime + durationMs / 1000);
}

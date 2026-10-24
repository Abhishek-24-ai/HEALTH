/**
 * Web Audio API Engine for Clinical Emergency Alerts and Telemetry Audio Feedback
 * Works offline with zero asset downloads or external sound files.
 */

let audioCtx = null;
let isMuted = false;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function setAudioMuted(muted) {
  isMuted = muted;
  try {
    localStorage.setItem('aura_audio_muted', muted ? 'true' : 'false');
  } catch (e) {
    // ignore localstorage errors
  }
}

export function isAudioMuted() {
  return isMuted;
}

// Initialise mute preference from storage
try {
  isMuted = localStorage.getItem('aura_audio_muted') === 'true';
} catch (e) {
  isMuted = false;
}

/**
 * Level RED: Critical Emergency Resuscitation Pulse Alarm
 * Alternates between 880 Hz and 660 Hz with rapid pulse
 */
export function playRedAlertSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // Device haptic vibration if supported
    if (navigator.vibrate) {
      navigator.vibrate([200, 80, 200, 80, 300]);
    }

    const now = ctx.currentTime;
    
    // First pulse
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.setValueAtTime(659.25, now + 0.12);
    
    // Lowpass filter for medical equipment timbre
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(filter);
    filter.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.36);

    // Echo beep 250ms later
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(880, now + 0.25);
    osc2.frequency.setValueAtTime(659.25, now + 0.37);

    gain2.gain.setValueAtTime(0, now + 0.25);
    gain2.gain.linearRampToValueAtTime(0.2, now + 0.27);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc2.connect(filter);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.25);
    osc2.stop(now + 0.62);
  } catch (err) {
    console.warn('Audio synthesis warning:', err);
  }
}

/**
 * Level YELLOW: Moderate Urgency Sonar Tone
 */
export function playYellowAlertSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (navigator.vibrate) {
      navigator.vibrate([120, 60, 120]);
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.18); // E5

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.32);
  } catch (e) {}
}

/**
 * Level GREEN: Soft Assurance Confirmation
 */
export function playGreenAlertSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now); // A4
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.24);
  } catch (e) {}
}

/**
 * Optical Handshake / QR Capture Success Chime (Satisfying dual arpeggio)
 */
export function playScanSuccessSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (navigator.vibrate) {
      navigator.vibrate([60, 40, 90]);
    }

    const notes = [587.33, 739.99, 880.0, 1174.66]; // D5, F#5, A5, D6
    notes.forEach((freq, idx) => {
      const start = ctx.currentTime + idx * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.22);
    });
  } catch (e) {}
}

/**
 * Click feedback for medical telemetry keypad
 */
export function playKeypadBeep() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);

    gain.gain.setValueAtTime(0.02, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  } catch (e) {}
}

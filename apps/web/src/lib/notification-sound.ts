let lastPlayedAt = 0;

/** Short two-tone chime for in-app lead alerts (no asset file required). */
export function playNotificationSound() {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastPlayedAt < 1500) return;
  lastPlayedAt = now;

  try {
    const AudioCtx =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const playTone = (frequency: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    const now = ctx.currentTime;
    playTone(880, now, 0.12);
    playTone(1174, now + 0.14, 0.16);

    window.setTimeout(() => {
      void ctx.close();
    }, 500);
  } catch {
    // Autoplay policies or unsupported browsers — ignore
  }
}

export const LEAD_ALERT_NOTIFICATION_TYPES = new Set(["lead_assigned", "new_ad_lead"]);

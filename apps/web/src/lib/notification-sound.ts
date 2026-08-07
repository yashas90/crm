let lastPlayedAt = 0;
let audioEl: HTMLAudioElement | null = null;

/** Plays the PropNinja swish for any in-app notification (leads, callbacks, etc.). */
export function playNotificationSound() {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastPlayedAt < 1500) return;
  lastPlayedAt = now;

  try {
    if (!audioEl) {
      audioEl = new Audio("/sounds/notification_swish.mp3");
      audioEl.preload = "auto";
      audioEl.volume = 0.9;
    }
    audioEl.currentTime = 0;
    void audioEl.play().catch(() => {
      playOscillatorFallback();
    });
  } catch {
    playOscillatorFallback();
  }
}

/** Fallback if the MP3 cannot autoplay or load. */
function playOscillatorFallback() {
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

    const t = ctx.currentTime;
    playTone(880, t, 0.12);
    playTone(1174, t + 0.14, 0.16);

    window.setTimeout(() => {
      void ctx.close();
    }, 500);
  } catch {
    // Autoplay policies or unsupported browsers — ignore
  }
}

/** Types that also trigger a browser Notification toast on the web dashboard. */
export const LEAD_ALERT_NOTIFICATION_TYPES = new Set([
  "lead_assigned",
  "leads_bulk_assigned",
  "new_ad_lead",
  "callback_requested",
  "site_visit_confirmed_by_client",
  "sla_breach",
  "followup_due",
  "task_assigned",
  "task_due",
  "site_visit_scheduled",
  "site_visit_reminder",
]);

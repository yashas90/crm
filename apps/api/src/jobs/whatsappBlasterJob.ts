import { logger } from "../lib/logger.js";
import { whatsappBlasterService } from "../services/whatsappBlasterService.js";

const INTERVAL_MS = 1000;
let timer: ReturnType<typeof setInterval> | undefined;
let ticking = false;

export async function tickWhatsAppBlaster() {
  if (ticking) return;
  ticking = true;
  try {
    await whatsappBlasterService.processSendQueue();
  } catch (error) {
    logger.warn("WhatsApp blaster tick failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    ticking = false;
  }
}

export function startWhatsAppBlasterJob() {
  if (timer) return;
  timer = setInterval(() => {
    void tickWhatsAppBlaster();
  }, INTERVAL_MS);
  timer.unref();
}

import { trackingSettings } from "@propninja/db";
import {
  TRACKING_DEFAULTS,
  type TrackingSchedule,
  isWithinTrackingHours,
  trackingScheduleLabel,
} from "@propninja/types/tracking";
import { eq } from "drizzle-orm";
import type { Database } from "./db.js";
import { env } from "./env.js";

function parseHm(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(":").map((part) => Number(part));
  return { hour: h ?? TRACKING_DEFAULTS.startHour, minute: m ?? TRACKING_DEFAULTS.startMinute };
}

export type TrackingRuntimeConfig = {
  enabled: boolean;
  timezone: string;
  startTime: string;
  endTime: string;
  intervalMinutes: number;
  retentionDays: number;
  missingAlertMinutes: number;
  heartbeatThresholdMinutes: number;
  possibleUninstallMinutes: number;
  activeDays: number[];
  scheduleLabel: string;
  schedule: TrackingSchedule;
};

function buildConfig(overrides?: {
  enabled?: boolean;
  timezone?: string;
  startTime?: string;
  endTime?: string;
  intervalMinutes?: number;
  retentionDays?: number;
  missingAlertMinutes?: number;
  heartbeatThresholdMinutes?: number;
  possibleUninstallMinutes?: number;
  activeDays?: number[];
}): TrackingRuntimeConfig {
  const startTime = overrides?.startTime ?? env.TRACKING_START_TIME;
  const endTime = overrides?.endTime ?? env.TRACKING_END_TIME;
  const start = parseHm(startTime);
  const end = parseHm(endTime);
  const activeDays = overrides?.activeDays ?? [...TRACKING_DEFAULTS.activeDays];
  const schedule: TrackingSchedule = {
    startHour: start.hour,
    startMinute: start.minute,
    endHour: end.hour,
    endMinute: end.minute,
    activeDays,
  };
  return {
    enabled: overrides?.enabled ?? env.TRACKING_ENABLED,
    timezone: overrides?.timezone ?? (env.TRACKING_TIMEZONE || TRACKING_DEFAULTS.timezone),
    startTime,
    endTime,
    intervalMinutes: overrides?.intervalMinutes ?? env.TRACKING_INTERVAL_MINUTES,
    retentionDays: overrides?.retentionDays ?? env.TRACKING_RETENTION_DAYS,
    missingAlertMinutes: overrides?.missingAlertMinutes ?? env.TRACKING_MISSING_ALERT_MINUTES,
    heartbeatThresholdMinutes:
      overrides?.heartbeatThresholdMinutes ?? env.TRACKING_HEARTBEAT_THRESHOLD_MINUTES,
    possibleUninstallMinutes:
      overrides?.possibleUninstallMinutes ?? env.TRACKING_POSSIBLE_UNINSTALL_MINUTES,
    activeDays,
    scheduleLabel: trackingScheduleLabel(schedule),
    schedule,
  };
}

/** Env-only config (no DB). Prefer getTrackingConfigForOrg when org context exists. */
export function getTrackingConfig(): TrackingRuntimeConfig {
  return buildConfig();
}

export function getTrackingSchedule(): TrackingSchedule {
  return getTrackingConfig().schedule;
}

export async function getTrackingConfigForOrg(
  db: Database,
  orgId: string,
): Promise<TrackingRuntimeConfig> {
  const [row] = await db
    .select()
    .from(trackingSettings)
    .where(eq(trackingSettings.orgId, orgId))
    .limit(1);
  if (!row) return buildConfig();
  return buildConfig({
    enabled: row.enabled,
    timezone: row.timezone,
    startTime: row.startTime,
    endTime: row.endTime,
    intervalMinutes: row.intervalMinutes,
    retentionDays: row.retentionDays,
    missingAlertMinutes: row.missingAlertMinutes,
    heartbeatThresholdMinutes: row.heartbeatThresholdMinutes,
    possibleUninstallMinutes: row.possibleUninstallMinutes,
    activeDays: row.activeDays?.length ? row.activeDays : [...TRACKING_DEFAULTS.activeDays],
  });
}

export function isTrackingCaptureAllowed(
  capturedAt: Date = new Date(),
  config: TrackingRuntimeConfig = getTrackingConfig(),
): boolean {
  if (!config.enabled) return false;
  return isWithinTrackingHours(capturedAt, config.schedule);
}

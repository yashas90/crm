/** In-memory pending call session — never persisted to disk (PII-safe). */

export type PendingCallRecord = {
  leadId: string;
  callStartTime: number;
};

let pendingCall: PendingCallRecord | null = null;

export async function savePendingCall(record: PendingCallRecord): Promise<void> {
  pendingCall = record;
}

export async function readPendingCall(): Promise<PendingCallRecord | null> {
  return pendingCall;
}

export async function clearPendingCall(): Promise<void> {
  pendingCall = null;
}

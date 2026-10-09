/** Outcome rules for bucket 1 (calling data) vs bucket 2 (leads). Pure — no I/O. */

export const CALL_OUTCOMES = [
  "interested",
  "not_interested",
  "callback",
  "no_answer",
  "busy",
  "invalid",
  "dnc",
] as const;

export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const PIPELINE_STAGES = [
  "new",
  "contacted",
  "site_visit_scheduled",
  "site_visit_done",
  "negotiation",
  "closed_won",
  "closed_lost",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const MAX_CALL_ATTEMPTS = 3;
export const HARD_DAILY_CONTACT_CAP = 100;

export type DeletedReason =
  | "not_interested"
  | "converted_to_lead"
  | "max_attempts_reached"
  | "invalid_number"
  | "dnc";

export type BucketState = {
  inCallingData: boolean;
  isLead: boolean;
};

export type OutcomePlan = {
  callingStatus: "callback" | "retry" | "interested" | "not_interested" | "invalid" | "dnc";
  softDelete: boolean;
  deletedReason: DeletedReason | null;
  poolStatus: "assigned" | "called" | "interested" | "callback" | "invalid" | "dnc";
  poolCallOutcome: string;
  createLead: boolean;
  nextAttempts: number;
  keepVisible: boolean;
  message: string;
  bucketsAfter: BucketState;
};

export function decideCallOutcome(outcome: CallOutcome, callAttempts: number): OutcomePlan {
  const attempts = Math.max(0, Math.min(MAX_CALL_ATTEMPTS, callAttempts));

  switch (outcome) {
    case "not_interested":
      return plan({
        callingStatus: "not_interested",
        softDelete: true,
        deletedReason: "not_interested",
        poolStatus: "called",
        poolCallOutcome: "not_interested",
        createLead: false,
        nextAttempts: attempts,
        message: "Marked not interested and removed from your calling list.",
      });
    case "interested":
      return plan({
        callingStatus: "interested",
        softDelete: true,
        deletedReason: "converted_to_lead",
        poolStatus: "interested",
        poolCallOutcome: "interested",
        createLead: true,
        nextAttempts: attempts,
        message: "Lead created",
      });
    case "callback":
      return plan({
        callingStatus: "callback",
        softDelete: false,
        deletedReason: null,
        poolStatus: "callback",
        poolCallOutcome: "callback",
        createLead: false,
        nextAttempts: attempts,
        message: "Callback scheduled.",
      });
    case "no_answer":
    case "busy":
      return attemptPlan(attempts, outcome);
    case "invalid":
      return plan({
        callingStatus: "invalid",
        softDelete: true,
        deletedReason: "invalid_number",
        poolStatus: "invalid",
        poolCallOutcome: "invalid",
        createLead: false,
        nextAttempts: attempts,
        message: "Marked invalid. This number will not be assigned again.",
      });
    case "dnc":
      return plan({
        callingStatus: "dnc",
        softDelete: true,
        deletedReason: "dnc",
        poolStatus: "dnc",
        poolCallOutcome: "dnc",
        createLead: false,
        nextAttempts: attempts,
        message: "Marked DNC. This number will not be assigned to any agent.",
      });
  }
}

function attemptPlan(attempts: number, outcome: "no_answer" | "busy"): OutcomePlan {
  const next = attempts + 1;
  if (next >= MAX_CALL_ATTEMPTS) {
    return plan({
      callingStatus: "retry",
      softDelete: true,
      deletedReason: "max_attempts_reached",
      poolStatus: "called",
      poolCallOutcome: "no_answer",
      createLead: false,
      nextAttempts: MAX_CALL_ATTEMPTS,
      message: "Contact removed after 3 attempts.",
    });
  }
  return plan({
    callingStatus: "retry",
    softDelete: false,
    deletedReason: null,
    poolStatus: "assigned",
    poolCallOutcome: outcome,
    createLead: false,
    nextAttempts: next,
    message: `Attempt ${next} of ${MAX_CALL_ATTEMPTS}. Moved to retry.`,
  });
}

function plan(
  input: Omit<OutcomePlan, "keepVisible" | "bucketsAfter"> & { message: string },
): OutcomePlan {
  const keepVisible = !input.softDelete;
  const bucketsAfter: BucketState = {
    inCallingData: keepVisible,
    isLead: input.createLead,
  };
  if (bucketsAfter.inCallingData && bucketsAfter.isLead) {
    throw new Error("Outcome would place a contact in calling data and leads at the same time");
  }
  return { ...input, keepVisible, bucketsAfter };
}

/** True when the two buckets do not both hold the contact. */
export function bucketsAreExclusive(state: BucketState): boolean {
  return !(state.inCallingData && state.isLead);
}

/** CRM lead_status that existing screens already understand. */
export function pipelineStageToLeadStatus(
  stage: PipelineStage,
): "new" | "contacted" | "qualified" | "negotiation" | "won" | "lost" {
  switch (stage) {
    case "new":
      return "new";
    case "contacted":
      return "contacted";
    case "site_visit_scheduled":
    case "site_visit_done":
      return "qualified";
    case "negotiation":
      return "negotiation";
    case "closed_won":
      return "won";
    case "closed_lost":
      return "lost";
  }
}

export function clampDailyLimit(value: number): number {
  if (!Number.isFinite(value)) return HARD_DAILY_CONTACT_CAP;
  return Math.max(1, Math.min(HARD_DAILY_CONTACT_CAP, Math.floor(value)));
}

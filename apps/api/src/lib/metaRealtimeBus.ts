/**
 * In-process fan-out for Meta live lead events (SSE subscribers).
 * Complements webhooks: clients get sub-second UI updates without polling Graph.
 */
import { EventEmitter } from "node:events";

export type MetaLiveLeadEvent = {
  type: "meta_lead_ingested";
  at: string;
  leadId: string;
  leadgenId: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  assignedTo: string | null;
  assignedName: string | null;
  projectName: string | null;
  campaignName: string | null;
  adName: string | null;
  adsetName: string | null;
  formName: string | null;
  pageName: string | null;
  source: string;
  leadStatus: string;
  createdTime: string | null;
  ingestedAt: string;
  via: "webhook" | "reconciliation" | "manual_pull";
};

const bus = new EventEmitter();
bus.setMaxListeners(100);

export function publishMetaLiveLead(event: MetaLiveLeadEvent) {
  bus.emit("lead", event);
}

export function subscribeMetaLiveLeads(listener: (event: MetaLiveLeadEvent) => void): () => void {
  bus.on("lead", listener);
  return () => {
    bus.off("lead", listener);
  };
}

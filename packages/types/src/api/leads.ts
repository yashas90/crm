import type { LeadId, UserId } from "../brands.js";
import type { Lead, LeadActivity } from "../entities/index.js";
import type { LeadStatus, LeadTemperature } from "../enums/index.js";
import type { LeadListFilter } from "../filters/index.js";
import type { ApiResponse } from "./common.js";

export type ListLeadsRequest = LeadListFilter;

export type LeadDetail = Lead & {
  activities?: LeadActivity[];
};

export type CreateLeadRequest = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  secondaryPhone?: string | null;
  city?: string | null;
  state?: string | null;
  leadSource?: string | null;
  leadStatus?: LeadStatus;
  temperature?: LeadTemperature | null;
  notes?: string | null;
  tags?: string[] | null;
  customFields?: Record<string, unknown> | null;
  assignedTo?: UserId | null;
  lastContactedAt?: string | null;
  nextFollowupAt?: string | null;
};

export type UpdateLeadRequest = Partial<CreateLeadRequest>;

export type ListLeadsResponse = ApiResponse<Lead[]>;
export type GetLeadResponse = ApiResponse<LeadDetail>;
export type CreateLeadResponse = ApiResponse<Lead>;
export type UpdateLeadResponse = ApiResponse<Lead>;
export type DeleteLeadResponse = ApiResponse<{ id: LeadId }>;

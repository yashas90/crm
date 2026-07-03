import type { UnitStatus } from "../enums/index.js";

export type UnitSummary = {
  total: number;
  available: number;
  reserved: number;
  booked: number;
  sold: number;
};

export type BookingDocumentSummary = {
  id: string;
  bookingRef: string;
  fileKey: string;
  fileUrl: string;
  generatedAt: string;
};

export type BookingListItem = {
  id: string;
  bookingRef: string;
  generatedAt: string;
  unitId: string;
  unitNumber: string;
  floor: number;
  bedrooms: number;
  status: UnitStatus;
  priceListedRs: number;
  priceFinalRs: number | null;
  projectId: string;
  projectName: string;
  leadId: string | null;
  leadName: string;
  agentId: string | null;
  agentName: string;
};

export type LeadLinkedUnit = {
  id: string;
  unitNumber: string;
  floor: number;
  bedrooms: number;
  areaSqFt: string;
  status: UnitStatus;
  priceListedRs: number;
  priceFinalRs: number | null;
  projectId: string;
  projectName: string;
  bookingDocument?: BookingDocumentSummary | null;
};

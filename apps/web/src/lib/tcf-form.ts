export const TCF_SEGMENTS = ["Primary"] as const;
export const TCF_CHANNELS = ["Direct"] as const;
export const TCF_CURRENCIES = ["INR"] as const;
export const INVOICE_STATUSES = ["not_raised", "raised", "collected"] as const;
export const QUARTER_CODES = ["JFM", "AMJ", "JAS", "OND"] as const;

export const DESIGNATIONS = [
  "Senior Sales Manager",
  "Sales Manager",
  "Associate Sales Manager",
  "Senior Investment Manager",
  "Investment Manager",
  "Associate Investment Manager",
  "Senior Portfolio Manager",
  "Portfolio Manager",
  "Associate Portfolio Manager",
  "Senior Real Estate Consultant",
  "Real Estate Consultant",
  "Associate Real Estate Consultant",
] as const;

export const INCENTIVE_BANDS = ["NE", "N0", "N1", "N2", "N3"] as const;

export const TCF_FLAGS = [
  "PMR / application form not received",
  "Document sent to developer with payment proof",
  "Documents received with payment proof",
  "OCR 1",
  "OCR 2",
  "OCR 1 receipt",
  "OCR 2 complete",
  "OCR 3 receipt",
  "OCR receipts",
  "OCR complete",
  "Initial booking amount receipt",
  "Initial booking amount paid",
  "Mortgage",
  "BBA / MOU executed",
  "BBA / MOU pending with developer",
  "BBA pending with client",
  "Demand letter pending",
  "Demand letter sent",
  "PDA pending",
  "TPT pending with developer",
  "TPT pending with client",
  "TPT executed",
  "Eligible for full billing",
  "Eligible for partial billing",
  "OCR payment exceeded due date",
  "Self funding FDC not required",
  "Self funding FDC approved",
  "Self funding FDC not received",
  "SDR payment",
  "Registration",
  "Loan not eligible",
  "Loan document collected",
  "Self funding",
  "Third party loan",
  "Third party builder disbursed",
  "Third party builder sanctioned",
  "Third party sanctioned",
  "Deferred loan",
  "Loan disbursed",
  "Base slab collected",
  "Base slab invoiced",
  "Fully collected",
  "Fully invoiced",
  "Initial booking amount reconciled (DPO)",
  "Initial payment verified (DPO)",
  "Partially collected",
  "Partially invoiced",
] as const;

export type AddressFields = {
  country: string;
  state: string;
  city: string;
  address: string;
  zip: string;
};

export type TcfShare = {
  userId?: string | null;
  employeeName: string;
  sharePercent: string;
};

export type TcfForm = {
  segment: string;
  channel: string;
  currency: string;
  coolOffEndDate: string;
  productName: string;
  dealClosureDate: string;
  clientAccess: boolean;
  initialPaymentVerified: boolean;
  property: {
    property: string;
    projectAreaNumber: string;
    sizeSqm: string;
    actualSize: string;
    towerUnit: string;
    paymentPlan: string;
    parkings: string;
    floorNo: string;
    bspPerSft: string;
    espPerSft: string;
    purpose: string;
    grossValue: string;
    totalConsideration: string;
  };
  charges: { type: string; amount: string; unit: string; included: boolean; total: string }[];
  client: {
    crmLeadId: string;
    code: string;
    mobile: string;
    primaryApplicant: string;
    clientType: string;
    email: string;
    pan: string;
    dateOfBirth: string;
    alternateEmail: string;
    alternateMobile: string;
    homeLoanRequired: boolean;
    leadSource: string;
    googleReviewLink: string;
    sameAsPermanent: boolean;
    permanent: AddressFields;
    correspondence: AddressFields;
  };
  coApplicants: { name: string; mobile: string; email: string }[];
  payment: {
    bookingAmount: string;
    chequeDetails: string;
    bankName: string;
    chequeBanked: boolean;
    bankingDate: string;
    commissionSlabNotes: string;
    baseCommission: string;
    hstNotes: string;
    taxAmount: string;
    sspNotes: string;
    sspAdjustment: string;
    loyaltyNotes: string;
    loyaltyDiscount: string;
    discountNote: boolean;
    miscNotes: string;
    miscAdjustment: string;
    specialRemarks: string;
    netRevenue: string;
    taxPercent: string;
    managementShare: string;
    developerCollected: boolean;
    developerDisbursed: boolean;
    convertible: boolean;
    invoiceStatus: (typeof INVOICE_STATUSES)[number];
  };
  shares: TcfShare[];
  documents: { category: string; documentType: string; fileName: string }[];
  flags: Record<string, boolean>;
};

const blankAddress = (): AddressFields => ({
  country: "India",
  state: "",
  city: "",
  address: "",
  zip: "",
});

export function emptyTcfForm(): TcfForm {
  return {
    segment: "Primary",
    channel: "Direct",
    currency: "INR",
    coolOffEndDate: "",
    productName: "",
    dealClosureDate: "",
    clientAccess: false,
    initialPaymentVerified: false,
    property: {
      property: "",
      projectAreaNumber: "",
      sizeSqm: "",
      actualSize: "",
      towerUnit: "",
      paymentPlan: "",
      parkings: "",
      floorNo: "",
      bspPerSft: "",
      espPerSft: "",
      purpose: "",
      grossValue: "",
      totalConsideration: "",
    },
    charges: [],
    client: {
      crmLeadId: "",
      code: "",
      mobile: "",
      primaryApplicant: "",
      clientType: "Applicant",
      email: "",
      pan: "",
      dateOfBirth: "",
      alternateEmail: "",
      alternateMobile: "",
      homeLoanRequired: false,
      leadSource: "",
      googleReviewLink: "",
      sameAsPermanent: false,
      permanent: blankAddress(),
      correspondence: blankAddress(),
    },
    coApplicants: [],
    payment: {
      bookingAmount: "",
      chequeDetails: "",
      bankName: "",
      chequeBanked: false,
      bankingDate: "",
      commissionSlabNotes: "",
      baseCommission: "",
      hstNotes: "",
      taxAmount: "",
      sspNotes: "",
      sspAdjustment: "",
      loyaltyNotes: "",
      loyaltyDiscount: "",
      discountNote: false,
      miscNotes: "",
      miscAdjustment: "",
      specialRemarks: "",
      netRevenue: "",
      taxPercent: "",
      managementShare: "",
      developerCollected: false,
      developerDisbursed: false,
      convertible: false,
      invoiceStatus: "not_raised",
    },
    shares: [],
    documents: [],
    flags: {},
  };
}

export function asTcfForm(value: unknown): TcfForm {
  const base = emptyTcfForm();
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<TcfForm>;
  return {
    ...base,
    ...raw,
    property: { ...base.property, ...raw.property },
    client: {
      ...base.client,
      ...raw.client,
      permanent: { ...base.client.permanent, ...raw.client?.permanent },
      correspondence: { ...base.client.correspondence, ...raw.client?.correspondence },
    },
    payment: { ...base.payment, ...raw.payment },
    charges: raw.charges ?? [],
    coApplicants: raw.coApplicants ?? [],
    shares: (raw.shares ?? []).map((share) => ({
      userId: share.userId,
      employeeName: share.employeeName,
      sharePercent: String(share.sharePercent ?? ""),
    })),
    documents: raw.documents ?? [],
    flags: raw.flags ?? {},
  };
}

export function currentQuarterKey(now = new Date()) {
  const month = now.getMonth();
  const code = month < 3 ? "JFM" : month < 6 ? "AMJ" : month < 9 ? "JAS" : "OND";
  return `${now.getFullYear()}-${code}`;
}

export function inr(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

import { z } from "zod";

export const invoiceStatusSchema = z.enum(["not_raised", "raised", "collected"]);

const addressSchema = z.object({
  country: z.string().default(""),
  state: z.string().default(""),
  city: z.string().default(""),
  address: z.string().default(""),
  zip: z.string().default(""),
});

export const tcfFormSchema = z.object({
  segment: z.string().default(""),
  channel: z.string().default(""),
  currency: z.string().default("INR"),
  coolOffEndDate: z.string().default(""),
  productName: z.string().default(""),
  dealClosureDate: z.string().default(""),
  clientAccess: z.boolean().default(false),
  initialPaymentVerified: z.boolean().default(false),
  property: z
    .object({
      property: z.string().default(""),
      projectAreaNumber: z.string().default(""),
      sizeSqm: z.string().default(""),
      actualSize: z.string().default(""),
      towerUnit: z.string().default(""),
      paymentPlan: z.string().default(""),
      parkings: z.string().default(""),
      floorNo: z.string().default(""),
      bspPerSft: z.string().default(""),
      espPerSft: z.string().default(""),
      purpose: z.string().default(""),
      grossValue: z.string().default(""),
      totalConsideration: z.string().default(""),
    })
    .default({}),
  charges: z
    .array(
      z.object({
        type: z.string().default(""),
        amount: z.string().default(""),
        unit: z.string().default(""),
        included: z.boolean().default(false),
        total: z.string().default(""),
      }),
    )
    .default([]),
  client: z
    .object({
      crmLeadId: z.string().default(""),
      code: z.string().default(""),
      mobile: z.string().default(""),
      primaryApplicant: z.string().default(""),
      clientType: z.string().default("Applicant"),
      email: z.string().default(""),
      pan: z.string().default(""),
      dateOfBirth: z.string().default(""),
      alternateEmail: z.string().default(""),
      alternateMobile: z.string().default(""),
      homeLoanRequired: z.boolean().default(false),
      leadSource: z.string().default(""),
      googleReviewLink: z.string().default(""),
      sameAsPermanent: z.boolean().default(false),
      permanent: addressSchema.default({}),
      correspondence: addressSchema.default({}),
    })
    .default({}),
  coApplicants: z
    .array(
      z.object({
        name: z.string().default(""),
        mobile: z.string().default(""),
        email: z.string().default(""),
      }),
    )
    .default([]),
  payment: z
    .object({
      bookingAmount: z.string().default(""),
      chequeDetails: z.string().default(""),
      bankName: z.string().default(""),
      chequeBanked: z.boolean().default(false),
      bankingDate: z.string().default(""),
      commissionSlabNotes: z.string().default(""),
      baseCommission: z.string().default(""),
      hstNotes: z.string().default(""),
      taxAmount: z.string().default(""),
      sspNotes: z.string().default(""),
      sspAdjustment: z.string().default(""),
      loyaltyNotes: z.string().default(""),
      loyaltyDiscount: z.string().default(""),
      discountNote: z.boolean().default(false),
      miscNotes: z.string().default(""),
      miscAdjustment: z.string().default(""),
      specialRemarks: z.string().default(""),
      netRevenue: z.string().default(""),
      taxPercent: z.string().default(""),
      managementShare: z.string().default(""),
      developerCollected: z.boolean().default(false),
      developerDisbursed: z.boolean().default(false),
      convertible: z.boolean().default(false),
      invoiceStatus: invoiceStatusSchema.default("not_raised"),
    })
    .default({}),
  shares: z
    .array(
      z.object({
        userId: z.string().uuid().nullable().optional(),
        employeeName: z.string().default(""),
        sharePercent: z.union([z.string(), z.number()]).default(""),
      }),
    )
    .default([]),
  documents: z
    .array(
      z.object({
        category: z.string().default("booking"),
        documentType: z.string().default(""),
        fileName: z.string().default(""),
      }),
    )
    .default([]),
  flags: z.record(z.boolean()).default({}),
});

export type TcfFormInput = z.infer<typeof tcfFormSchema>;

export function readTcfForm(value: unknown): TcfFormInput {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const client =
    raw.client && typeof raw.client === "object"
      ? (raw.client as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  return tcfFormSchema.parse({
    ...raw,
    property: raw.property ?? {},
    client: {
      ...client,
      permanent: client.permanent ?? {},
      correspondence: client.correspondence ?? {},
    },
    payment: raw.payment ?? {},
    charges: raw.charges ?? [],
    coApplicants: raw.coApplicants ?? [],
    shares: raw.shares ?? [],
    documents: raw.documents ?? [],
    flags: raw.flags ?? {},
  });
}

export const listTcfQuerySchema = z.object({
  status: z.enum(["draft", "pending_approval", "approved", "rejected"]).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const rejectTcfSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

export const invoicePatchSchema = z.object({
  invoiceStatus: invoiceStatusSchema,
});

export const incentiveProfileSchema = z.object({
  userId: z.string().uuid(),
  band: z.enum(["NE", "N0", "N1", "N2", "N3"]).nullable().optional(),
  designation: z.string().trim().max(120).nullable().optional(),
  monthlyBasic: z.coerce.number().min(0).optional(),
});

export const disburseSchema = z.object({
  userId: z.string().uuid(),
  quarter: z.string().regex(/^\d{4}-(JFM|AMJ|JAS|OND)$/),
});

export const quarterQuerySchema = z.object({
  quarter: z
    .string()
    .regex(/^\d{4}-(JFM|AMJ|JAS|OND)$/)
    .optional(),
});

export function submitErrors(form: TcfFormInput): string[] {
  const errors: string[] = [];
  const required: [string, string][] = [
    [form.segment, "Segment"],
    [form.channel, "Channel"],
    [form.currency, "Currency"],
    [form.productName, "Product name"],
    [form.dealClosureDate, "Deal closure date"],
    [form.coolOffEndDate, "Cool off end date"],
    [form.property.property, "Property"],
    [form.property.sizeSqm, "Size (SQM)"],
    [form.property.towerUnit, "Tower / unit number"],
    [form.property.floorNo, "Floor number"],
    [form.property.purpose, "Purpose of purchase"],
    [form.client.primaryApplicant, "Primary applicant"],
    [form.client.mobile, "Client mobile"],
    [form.client.email, "Client email"],
    [form.client.permanent.address, "Permanent address"],
    [form.payment.bookingAmount, "Booking amount"],
    [form.payment.chequeDetails, "Booking cheque / RTGS details"],
    [form.payment.bankName, "Bank name"],
    [form.payment.bankingDate, "Banking date"],
    [form.payment.netRevenue, "Net revenue"],
  ];
  for (const [value, label] of required) {
    if (!value.trim()) errors.push(`${label} is required`);
  }
  const net = Number(form.payment.netRevenue);
  if (form.payment.netRevenue.trim() && (!Number.isFinite(net) || net < 0)) {
    errors.push("Net revenue must be a zero or positive number");
  }
  const shares = form.shares.filter((share) => share.employeeName.trim());
  const total = shares.reduce((sum, share) => sum + Number(share.sharePercent || 0), 0);
  if (total > 100.001) errors.push("Share percentages cannot exceed 100");
  return errors;
}

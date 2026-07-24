import type { AuthUser } from "../middleware/auth.js";

type LeadContact = {
  phone?: string | null;
  secondaryPhone?: string | null;
  email?: string | null;
  assignedTo?: string | null;
};

/** Mask Indian-style phone: 9876543210 → 98XXXXX210 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 5) return "XXXXX";
  const head = digits.slice(0, 2);
  const tail = digits.slice(-3);
  const maskedLen = Math.max(0, digits.length - 5);
  return `${head}${"X".repeat(maskedLen)}${tail}`;
}

/** Mask email: rahul@gmail.com → r***@gmail.com */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

/** Only admins see full contact. Assigned agents see full contact on their own leads (for dialing). */
export function shouldMaskLeadContact(user: AuthUser, lead: LeadContact): boolean {
  if (user.role === "admin") return false;
  if (user.role === "agent" && lead.assignedTo === user.id) return false;
  return true;
}

/** True when the viewer may download/export unmasked phone numbers (admin only). */
export function canDownloadLeadPhones(user: AuthUser): boolean {
  return user.role === "admin";
}

export function maskLeadContactFields<T extends LeadContact>(user: AuthUser, lead: T): T {
  if (!shouldMaskLeadContact(user, lead)) return lead;
  return {
    ...lead,
    phone: lead.phone ? maskPhone(lead.phone) : lead.phone,
    secondaryPhone: lead.secondaryPhone ? maskPhone(lead.secondaryPhone) : lead.secondaryPhone,
    email: lead.email ? maskEmail(lead.email) : lead.email,
  };
}

export function maskLeadList<T extends LeadContact>(user: AuthUser, leads: T[]): T[] {
  return leads.map((lead) => maskLeadContactFields(user, lead));
}

/** Mask dialed numbers for non-admins (agents keep full numbers on their own call logs). */
export function maskCallPhoneFields<
  T extends { phoneNumber?: string | null; lead?: { phone?: string | null } | null },
>(user: AuthUser, call: T): T {
  if (user.role === "admin" || user.role === "agent") return call;
  return {
    ...call,
    phoneNumber: call.phoneNumber ? maskPhone(call.phoneNumber) : call.phoneNumber,
    lead: call.lead
      ? {
          ...call.lead,
          phone: call.lead.phone ? maskPhone(call.lead.phone) : call.lead.phone,
        }
      : call.lead,
  };
}

/** Drop contact fields that look like masked display values so edits cannot corrupt PII. */
export function stripMaskedContactUpdates<T extends LeadContact>(payload: T): T {
  const next = { ...payload };
  if (typeof next.phone === "string" && /x/i.test(next.phone)) {
    (next as { phone?: string | null }).phone = undefined;
  }
  if (typeof next.secondaryPhone === "string" && /x/i.test(next.secondaryPhone)) {
    (next as { secondaryPhone?: string | null }).secondaryPhone = undefined;
  }
  if (typeof next.email === "string" && next.email.includes("***")) {
    (next as { email?: string | null }).email = undefined;
  }
  return next;
}

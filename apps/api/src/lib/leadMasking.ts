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

/** Agents see masked contact unless they are the assigned agent. Managers/admins see full data. */
export function shouldMaskLeadContact(user: AuthUser, lead: LeadContact): boolean {
  if (user.role === "admin" || user.role === "manager") return false;
  return lead.assignedTo !== user.id;
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

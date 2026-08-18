const LEAD_PHONE_DIGITS = "8697666260";

export function isRahulVermaniLead(lead: {
  phone: string | null;
  firstName: string;
  lastName: string;
}): boolean {
  const digits = (lead.phone ?? "").replace(/\D/g, "");
  if (digits.endsWith(LEAD_PHONE_DIGITS)) return true;
  const fullName = `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.toLowerCase();
  return fullName.includes("rahul") && fullName.includes("vermani");
}

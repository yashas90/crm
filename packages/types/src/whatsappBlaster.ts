export const WHATSAPP_CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "running",
  "paused",
  "completed",
] as const;

export type WhatsAppCampaignStatus = (typeof WHATSAPP_CAMPAIGN_STATUSES)[number];

export const WHATSAPP_CONTACT_STATUSES = [
  "pending",
  "queued",
  "sent",
  "delivered",
  "read",
  "replied",
  "interested",
  "not_interested",
  "invalid",
] as const;

export type WhatsAppContactStatus = (typeof WHATSAPP_CONTACT_STATUSES)[number];

export const WHATSAPP_BLAST_LEAD_STATUSES = ["new", "contacted", "converted", "lost"] as const;

export type WhatsAppBlastLeadStatus = (typeof WHATSAPP_BLAST_LEAD_STATUSES)[number];

export const WHATSAPP_MESSAGE_DIRECTIONS = ["outbound", "inbound"] as const;

export type WhatsAppMessageDirection = (typeof WHATSAPP_MESSAGE_DIRECTIONS)[number];

export const WHATSAPP_MESSAGE_TYPES = ["template", "text", "button_reply", "media"] as const;

export type WhatsAppMessageType = (typeof WHATSAPP_MESSAGE_TYPES)[number];

export const WHATSAPP_MESSAGE_STATUSES = ["queued", "sent", "delivered", "read", "failed"] as const;

export type WhatsAppBlastMessageStatus = (typeof WHATSAPP_MESSAGE_STATUSES)[number];

export const WHATSAPP_SENDING_SPEEDS = ["safe", "normal", "fast"] as const;

export type WhatsAppSendingSpeed = (typeof WHATSAPP_SENDING_SPEEDS)[number];

export const WHATSAPP_SENDING_SPEED_MS: Record<WhatsAppSendingSpeed, number> = {
  safe: 3000,
  normal: 1000,
  fast: 100,
};

export const WHATSAPP_MEDIA_TYPES = ["image", "pdf", "video"] as const;

export type WhatsAppMediaType = (typeof WHATSAPP_MEDIA_TYPES)[number];

export const WHATSAPP_BUTTON_ACTIONS = ["interested", "not_interested", "call_me_back"] as const;

export type WhatsAppButtonAction = (typeof WHATSAPP_BUTTON_ACTIONS)[number];

export const WHATSAPP_ANSWER_FIELDS = ["budget", "location", "timeline"] as const;

export type WhatsAppAnswerField = (typeof WHATSAPP_ANSWER_FIELDS)[number];

export const WHATSAPP_BLAST_LEAD_SOURCE = "WhatsApp Blaster";

export const WHATSAPP_TEMPLATE_VARIABLES = [
  "{{name}}",
  "{{city}}",
  "{{budget}}",
  "{{property_name}}",
] as const;

export const WHATSAPP_MESSAGE_MAX_CHARS = 4096;

export type WhatsAppTemplateButton = {
  id: string;
  label: string;
  action: WhatsAppButtonAction;
};

export type WhatsAppQuestionOption = {
  id: string;
  label: string;
  /** Next question id, or null to end the flow. */
  nextQuestionId: string | null;
  mapsTo?: WhatsAppAnswerField;
};

export type WhatsAppQualificationQuestion = {
  id: string;
  text: string;
  options: WhatsAppQuestionOption[];
};

export type WhatsAppQuestionFlow = {
  questions: WhatsAppQualificationQuestion[];
  startQuestionId: string;
  thankYouMessage: string;
};

export const DEFAULT_WHATSAPP_BUTTONS: WhatsAppTemplateButton[] = [
  { id: "interested", label: "✅ I'm Interested", action: "interested" },
  { id: "not_interested", label: "❌ Not Interested", action: "not_interested" },
  { id: "call_me_back", label: "📞 Call Me Back", action: "call_me_back" },
];

export const DEFAULT_WHATSAPP_QUESTION_FLOW: WhatsAppQuestionFlow = {
  startQuestionId: "q_budget",
  thankYouMessage:
    "Thank you! 🙌 An advisor from our team will contact you shortly with matching properties.",
  questions: [
    {
      id: "q_budget",
      text: "Great! 🏠 What is your budget range?",
      options: [
        {
          id: "budget_under_50",
          label: "Under ₹50 Lakhs",
          nextQuestionId: "q_location",
          mapsTo: "budget",
        },
        {
          id: "budget_50_1cr",
          label: "₹50L - ₹1 Crore",
          nextQuestionId: "q_location",
          mapsTo: "budget",
        },
        {
          id: "budget_1_2cr",
          label: "₹1Cr - ₹2 Crore",
          nextQuestionId: "q_location",
          mapsTo: "budget",
        },
        {
          id: "budget_above_2cr",
          label: "Above ₹2 Crore",
          nextQuestionId: "q_location",
          mapsTo: "budget",
        },
      ],
    },
    {
      id: "q_location",
      text: "Which location do you prefer?",
      options: [
        {
          id: "loc_whitefield",
          label: "Whitefield",
          nextQuestionId: "q_timeline",
          mapsTo: "location",
        },
        {
          id: "loc_electronic_city",
          label: "Electronic City",
          nextQuestionId: "q_timeline",
          mapsTo: "location",
        },
        {
          id: "loc_sarjapur",
          label: "Sarjapur Road",
          nextQuestionId: "q_timeline",
          mapsTo: "location",
        },
        { id: "loc_other", label: "Other", nextQuestionId: "q_timeline", mapsTo: "location" },
      ],
    },
    {
      id: "q_timeline",
      text: "When are you planning to buy?",
      options: [
        {
          id: "time_3m",
          label: "Within 3 months",
          nextQuestionId: null,
          mapsTo: "timeline",
        },
        { id: "time_3_6m", label: "3-6 months", nextQuestionId: null, mapsTo: "timeline" },
        { id: "time_6_12m", label: "6-12 months", nextQuestionId: null, mapsTo: "timeline" },
        {
          id: "time_exploring",
          label: "Just exploring",
          nextQuestionId: null,
          mapsTo: "timeline",
        },
      ],
    },
  ],
};

export const DEFAULT_BLAST_MESSAGE_BODY =
  "Hi {{name}} 👋\n\nWe have an exclusive update for a property in {{city}} that matches a budget around {{budget}}.\n\n🏡 {{property_name}}\n\nTap a button below to tell us how you'd like to proceed.";

export type WhatsAppColumnMapping = {
  name?: string;
  phone: string;
  city?: string;
  budget?: string;
};

export type ParsedWhatsAppContact = {
  row: number;
  name: string;
  phone: string;
  formattedPhone: string | null;
  city: string;
  budget: string;
  valid: boolean;
  duplicate: boolean;
  invalidReason: string | null;
};

export type ParsedWhatsAppContactList = {
  headers: string[];
  contacts: ParsedWhatsAppContact[];
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
};

export type WhatsAppCampaignStats = {
  sent: number;
  failed: number;
  delivered: number;
  read: number;
  replied: number;
  interested: number;
  notInterested: number;
  total: number;
};

export function formatWhatsAppCampaignCode(sequence: number): string {
  return `WC-${String(sequence).padStart(4, "0")}`;
}

export function formatWhatsAppLeadCode(sequence: number): string {
  return `WA-${String(sequence).padStart(4, "0")}`;
}

export function renderWhatsAppTemplate(
  body: string,
  vars: {
    name?: string | null;
    city?: string | null;
    budget?: string | null;
    property_name?: string | null;
  },
): string {
  return body
    .replaceAll("{{name}}", vars.name?.trim() || "there")
    .replaceAll("{{city}}", vars.city?.trim() || "your city")
    .replaceAll("{{budget}}", vars.budget?.trim() || "your budget")
    .replaceAll("{{property_name}}", vars.property_name?.trim() || "our project");
}

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/** Format to +91XXXXXXXXXX. Returns null when the number is not a valid Indian mobile. */
export function formatIndianWhatsAppPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let local = digits;
  if (digits.length === 12 && digits.startsWith("91")) {
    local = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    local = digits.slice(1);
  } else if (digits.length === 13 && digits.startsWith("091")) {
    local = digits.slice(3);
  }
  if (!INDIAN_MOBILE.test(local)) return null;
  return `+91${local}`;
}

export function guessWhatsAppColumn(
  headers: string[],
  kind: keyof WhatsAppColumnMapping,
): string | undefined {
  const normalized = headers.map((h) => ({ raw: h, key: h.trim().toLowerCase() }));
  const match = (aliases: string[]) => normalized.find((h) => aliases.includes(h.key))?.raw;

  if (kind === "phone") {
    return match([
      "phone",
      "phone number",
      "phonenumber",
      "mobile",
      "mobile number",
      "contact",
      "whatsapp",
    ]);
  }
  if (kind === "name") {
    return match(["name", "full name", "fullname", "customer", "contact name"]);
  }
  if (kind === "city") {
    return match(["city", "location", "area", "locality"]);
  }
  return match(["budget", "max budget", "min budget", "price"]);
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === "," || ch === "\t") {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseDelimitedTable(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]!);
  const rows = lines.slice(1).map(parseCsvLine);
  return { headers, rows };
}

export function mapWhatsAppContacts(
  headers: string[],
  rows: string[][],
  mapping: WhatsAppColumnMapping,
): ParsedWhatsAppContactList {
  const indexOf = (name: string | undefined) => (name ? headers.findIndex((h) => h === name) : -1);
  const phoneIdx = indexOf(mapping.phone);
  const nameIdx = indexOf(mapping.name);
  const cityIdx = indexOf(mapping.city);
  const budgetIdx = indexOf(mapping.budget);

  const seen = new Map<string, number>();
  const contacts: ParsedWhatsAppContact[] = [];

  rows.forEach((row, i) => {
    const rawPhone = phoneIdx >= 0 ? (row[phoneIdx] ?? "") : "";
    const name = nameIdx >= 0 ? (row[nameIdx] ?? "").trim() : "";
    const city = cityIdx >= 0 ? (row[cityIdx] ?? "").trim() : "";
    const budget = budgetIdx >= 0 ? (row[budgetIdx] ?? "").trim() : "";
    const formattedPhone = formatIndianWhatsAppPhone(rawPhone);
    let duplicate = false;
    let invalidReason: string | null = null;
    if (!rawPhone.trim()) {
      invalidReason = "Missing phone number";
    } else if (!formattedPhone) {
      invalidReason = "Invalid Indian mobile number";
    } else {
      const prior = seen.get(formattedPhone);
      if (prior !== undefined) {
        duplicate = true;
        invalidReason = `Duplicate of row ${prior}`;
      } else {
        seen.set(formattedPhone, i + 2);
      }
    }

    contacts.push({
      row: i + 2,
      name: name || "Unknown",
      phone: rawPhone.trim(),
      formattedPhone: duplicate ? formattedPhone : formattedPhone,
      city,
      budget,
      valid: Boolean(formattedPhone) && !duplicate,
      duplicate,
      invalidReason,
    });
  });

  const valid = contacts.filter((c) => c.valid).length;
  const duplicates = contacts.filter((c) => c.duplicate).length;
  const invalid = contacts.filter((c) => !c.valid && !c.duplicate).length;

  return {
    headers,
    contacts,
    total: contacts.length,
    valid,
    invalid,
    duplicates,
  };
}

export function detectInterestedIntent(text: string): boolean {
  const value = text.trim().toLowerCase();
  return (
    value === "yes" ||
    value === "y" ||
    value.includes("interested") ||
    value === "✅" ||
    value.includes("i'm interested") ||
    value.includes("im interested")
  );
}

export function detectNotInterestedIntent(text: string): boolean {
  const value = text.trim().toLowerCase();
  return (
    value === "no" ||
    value === "n" ||
    value === "stop" ||
    value === "unsubscribe" ||
    value.includes("not interested") ||
    value === "❌"
  );
}

export function detectCallBackIntent(text: string): boolean {
  const value = text.trim().toLowerCase();
  return (
    value === "call" ||
    value.includes("call me") ||
    value.includes("callback") ||
    value.includes("call back") ||
    value === "📞"
  );
}

export function findQuestion(flow: WhatsAppQuestionFlow, questionId: string | null | undefined) {
  if (!questionId) return null;
  return flow.questions.find((q) => q.id === questionId) ?? null;
}

export function findOption(
  question: WhatsAppQualificationQuestion,
  optionIdOrLabel: string,
): WhatsAppQuestionOption | null {
  const needle = optionIdOrLabel.trim().toLowerCase();
  return (
    question.options.find(
      (opt) => opt.id.toLowerCase() === needle || opt.label.trim().toLowerCase() === needle,
    ) ?? null
  );
}

export function nextQuestionAfterAnswer(
  flow: WhatsAppQuestionFlow,
  currentQuestionId: string,
  optionIdOrLabel: string,
): {
  option: WhatsAppQuestionOption | null;
  nextQuestion: WhatsAppQualificationQuestion | null;
  completed: boolean;
} {
  const current = findQuestion(flow, currentQuestionId);
  if (!current) return { option: null, nextQuestion: null, completed: true };
  const option = findOption(current, optionIdOrLabel);
  if (!option) return { option: null, nextQuestion: null, completed: false };
  if (!option.nextQuestionId) {
    return { option, nextQuestion: null, completed: true };
  }
  return {
    option,
    nextQuestion: findQuestion(flow, option.nextQuestionId),
    completed: false,
  };
}

export function matchButtonAction(
  buttons: WhatsAppTemplateButton[],
  payloadOrLabel: string,
): WhatsAppButtonAction | null {
  const needle = payloadOrLabel.trim().toLowerCase();
  const button = buttons.find(
    (b) =>
      b.id.toLowerCase() === needle ||
      b.action.toLowerCase() === needle ||
      b.label.trim().toLowerCase() === needle ||
      b.label
        .replace(/^[^\w]+/, "")
        .trim()
        .toLowerCase() === needle,
  );
  return button?.action ?? null;
}

export type TimeOfDayBucket = {
  hour: number;
  replies: number;
};

export type QuestionBreakdown = {
  questionId: string;
  questionText: string;
  answers: Array<{ label: string; count: number; percent: number }>;
};

export type WhatsAppProviderInfo = {
  provider: "meta" | "twilio" | "gupshup" | "wati" | "aisensy" | "none";
  configured: boolean;
  label: string;
};

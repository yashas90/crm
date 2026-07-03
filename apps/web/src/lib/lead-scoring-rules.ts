/** Mirror of API default rules for settings UI fallback. */
export const DEFAULT_LEAD_SCORING_RULES = {
  answeredCall: 20,
  whatsappReplied: 15,
  siteVisitScheduled: 10,
  siteVisitCompleted: 20,
  recentNote: 5,
  reEnquired: 10,
  createdLast24h: 15,
  created1to3Days: 10,
  created4to7Days: 5,
  noContact5Days: -10,
  noContact10Days: -20,
  doNotCall: -15,
  noAnswerStreak3: -10,
  sourcePaidAds: 10,
  sourceReferral: 5,
} as const;

export const LEAD_SCORING_RULE_LABELS: {
  key: keyof typeof DEFAULT_LEAD_SCORING_RULES;
  label: string;
}[] = [
  { key: "answeredCall", label: "Called and answered at least once" },
  { key: "whatsappReplied", label: "Replied to WhatsApp" },
  { key: "siteVisitScheduled", label: "Site visit scheduled" },
  { key: "siteVisitCompleted", label: "Site visit completed" },
  { key: "recentNote", label: "Note added in last 3 days" },
  { key: "reEnquired", label: "Re-enquired after lost" },
  { key: "createdLast24h", label: "Lead created in last 24 hours" },
  { key: "created1to3Days", label: "Created 1–3 days ago" },
  { key: "created4to7Days", label: "Created 4–7 days ago" },
  { key: "noContact5Days", label: "No contact in 5+ days" },
  { key: "noContact10Days", label: "No contact in 10+ days" },
  { key: "doNotCall", label: "Marked Do Not Call (TCF)" },
  { key: "noAnswerStreak3", label: "No answer 3+ times in a row" },
  { key: "sourcePaidAds", label: "Source: Meta Ads or Google Ads" },
  { key: "sourceReferral", label: "Source: Referral" },
];

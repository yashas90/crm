import LeadDetailPage from "@/app/(dashboard)/leads/[id]/page";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockLead = {
  id: "lead-hero-1",
  firstName: "Vikram",
  lastName: "Reddy",
  email: "vikram@example.com",
  phone: "+919900000001",
  city: "Hyderabad",
  state: "TS",
  leadStatus: "qualified",
  temperature: "hot",
  leadSource: "walk-in",
  projectName: "Skyline Residency",
  estimatedValue: "8500000",
  lastContactedAt: "2025-06-01T12:00:00.000Z",
  nextFollowupAt: "2025-06-10T10:00:00.000Z",
  notes: null,
  tags: ["investor"],
  createdAt: "2025-05-01T00:00:00.000Z",
  assignedUser: { id: "u1", name: "Demo Agent", email: "demo@propninja.local" },
  activities: [],
  leadSummary: {
    totalCalls: 4,
    firstSeenAt: "2025-05-01T00:00:00.000Z",
    firstCallAt: null,
    completedCalls: 2,
    missedCalls: 0,
  },
};

vi.mock("@/hooks/use-leads", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-leads")>();
  return {
    ...actual,
    useLead: () => ({ data: mockLead, isLoading: false, isError: false, refetch: vi.fn() }),
    useLeadAssignments: () => ({ data: { items: [] }, isLoading: false }),
    useCalls: () => ({ data: { total: 4, items: [] }, refetch: vi.fn() }),
    useAddLeadNote: () => ({ mutate: vi.fn(), isPending: false }),
    useUpdateLead: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ ready: true, canDeleteLead: true }),
}));

vi.mock("@/hooks/use-users", () => ({
  useUsers: () => ({ data: [] }),
}));

vi.mock("@/hooks/use-tcf", () => ({
  useTcfConsent: () => ({
    data: { lead_id: "lead-hero-1", consents: { call: null, sms: null, email: null } },
    isLoading: false,
  }),
  useUpsertTcfConsent: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({
    ready: true,
    isAdmin: true,
    session: { id: "u1", role: "admin", email: "admin@test", name: "Admin" },
  }),
}));

vi.mock("@/lib/apiClient", () => ({
  apiPost: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: "lead-hero-1" }),
}));

vi.mock("@/components/leads/lead-delete-dialog", () => ({
  LeadDeleteDialog: () => null,
}));

vi.mock("@/components/leads/lead-follow-up-panel", () => ({
  LeadFollowUpPanel: () => null,
}));

vi.mock("@/hooks/use-message-templates", () => ({
  useMessageTemplates: () => ({ data: { items: [] }, isLoading: false }),
  useLeadLinkedUnit: () => ({ data: null }),
}));

vi.mock("@/components/leads/whatsapp-message-picker-dialog", () => ({
  WhatsAppMessagePickerDialog: () => null,
}));

vi.mock("@/components/leads/send-whatsapp-template-dialog", () => ({
  SendWhatsAppTemplateDialog: () => null,
}));

vi.mock("@/components/leads/lead-site-visits-panel", () => ({
  LeadSiteVisitsPanel: () => null,
}));

vi.mock("@/components/leads/lead-shared-documents-panel", () => ({
  LeadSharedDocumentsPanel: () => null,
}));

vi.mock("@/components/leads/lead-whatsapp-panel", () => ({
  LeadWhatsAppPanel: () => null,
}));

vi.mock("@/components/leads/lead-ownership-history", () => ({
  LeadOwnershipHistory: () => null,
}));

describe("LeadDetailPage", () => {
  it("renders hero section with lead name and status chips", () => {
    render(<LeadDetailPage />);

    expect(screen.getByRole("heading", { name: "Vikram Reddy" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Compliance" })).toBeInTheDocument();
    expect(screen.getByText("qualified")).toBeInTheDocument();
    expect(screen.getByText("hot")).toBeInTheDocument();
    expect(screen.getByText("Skyline Residency")).toBeInTheDocument();
    expect(screen.getByText("Total calls")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });
});

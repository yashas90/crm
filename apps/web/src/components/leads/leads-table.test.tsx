import { LeadsTable } from "@/components/leads/leads-table";
import type { LeadRow } from "@/hooks/use-leads";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  getSession: () => ({ id: "u1", role: "admin", email: "admin@test", name: "Admin" }),
}));

const mockLeads: LeadRow[] = [
  {
    id: "lead-1",
    firstName: "Aarav",
    lastName: "Sharma",
    email: "aarav@example.com",
    phone: "+919876543210",
    city: "Mumbai",
    leadStatus: "new",
    temperature: "hot",
    leadSource: "website",
    lastContactedAt: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    assignedUser: { id: "u1", name: "Demo Agent", email: "demo@propninja.local" },
  },
  {
    id: "lead-2",
    firstName: "Priya",
    lastName: "Patel",
    email: null,
    phone: "+919876543211",
    city: "Pune",
    leadStatus: "contacted",
    temperature: "warm",
    leadSource: "referral",
    lastContactedAt: "2025-06-01T10:00:00.000Z",
    createdAt: "2025-01-02T00:00:00.000Z",
    assignedUser: null,
  },
];

describe("LeadsTable", () => {
  it("renders lead rows from mocked data", () => {
    render(<LeadsTable leads={mockLeads} onEdit={vi.fn()} />);

    expect(screen.getByText("Aarav Sharma")).toBeInTheDocument();
    expect(screen.getByText("Priya Patel")).toBeInTheDocument();
    expect(screen.getByText("+919876543210")).toBeInTheDocument();
    expect(screen.getByText("Mumbai")).toBeInTheDocument();
    expect(screen.getByText("Pune")).toBeInTheDocument();
  });
});

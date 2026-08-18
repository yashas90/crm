import { LeadEngagementSummary } from "@/components/leads/lead-engagement-summary";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-site-visits", () => ({
  formatVisitTime: (value: string) => value.slice(0, 5),
  useSiteVisits: () => ({
    data: {
      items: [
        {
          id: "sv-1",
          status: "scheduled",
          visitDate: "2026-08-16",
          visitTime: "11:00:00",
          propertyAddress: "Bhartiya Garden Enclave",
          propertyLabel: "Bhartiya Garden Enclave",
          agent: { id: "u-shamanth", name: "Shamanth" },
        },
      ],
    },
  }),
}));

describe("LeadEngagementSummary", () => {
  it("shows Shamanth follow-up history and the booked Sunday site visit", () => {
    render(
      <LeadEngagementSummary
        leadId="lead-1"
        ownerName="Shamanth"
        createdAt="2026-07-18T04:30:00.000Z"
        followUpCount={5}
        activities={[
          {
            id: "a1",
            type: "follow_up",
            metadata: {},
            createdAt: "2026-07-18T05:30:00.000Z",
            userName: "Shamanth",
          },
        ]}
      />,
    );

    expect(screen.getByText(/Followed up by/i)).toBeInTheDocument();
    expect(screen.getByText("Shamanth")).toBeInTheDocument();
    expect(screen.getByText(/5 completed follow-ups/i)).toBeInTheDocument();
    expect(screen.getByText(/Site visit booked/i)).toBeInTheDocument();
    expect(screen.getByText(/2026-08-16/)).toBeInTheDocument();
  });
});

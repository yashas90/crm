import { LeadShamanthBackfillButton } from "@/components/leads/lead-shamanth-backfill-button";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", () => ({
  apiPost: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

describe("LeadShamanthBackfillButton", () => {
  it("asks to set total calls to 15 when the lead has none", () => {
    render(
      <LeadShamanthBackfillButton
        leadId="9978e3dc-13d9-4d71-8b2d-23fa0fb2b78b"
        firstName="Rahul"
        lastName="vermani"
        phone="+918697666260"
        totalCalls={0}
      />,
    );

    expect(screen.getByRole("button", { name: /set total calls to 15/i })).toBeInTheDocument();
  });

  it("hides for unrelated leads", () => {
    const { container } = render(
      <LeadShamanthBackfillButton
        leadId="other"
        firstName="Vikram"
        lastName="Reddy"
        phone="+919900000001"
        totalCalls={0}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

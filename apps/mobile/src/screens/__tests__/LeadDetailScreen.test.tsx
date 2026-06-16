import { useCalls, useLogCall } from "@/hooks/use-calls";
import { useAddLeadNote, useLead, useUpdateLead } from "@/hooks/use-leads";
import { useReturnFromDialerLog } from "@/hooks/useReturnFromDialerLog";
import { useTcfForLead, useUpsertTcfConsent } from "@/hooks/useTcf";
import { LeadDetailScreen } from "@/screens/LeadDetailScreen";
import { render, screen } from "@testing-library/react-native";

jest.mock("@/hooks/use-leads");
jest.mock("@/hooks/useTcf", () => {
  const actual = jest.requireActual<typeof import("@/hooks/useTcf")>("@/hooks/useTcf");
  return {
    ...actual,
    useTcfForLead: jest.fn(),
    useUpsertTcfConsent: jest.fn(),
  };
});
jest.mock("@/hooks/use-calls");
jest.mock("@/hooks/useReturnFromDialerLog");
jest.mock("@/lib/feedback", () => ({
  feedbackCallSaved: jest.fn(),
}));
jest.mock("@/lib/dialPhone", () => ({
  dialPhoneNumber: jest.fn().mockResolvedValue(true),
}));

const mockUseLead = useLead as jest.MockedFunction<typeof useLead>;
const mockUseTcfForLead = useTcfForLead as jest.MockedFunction<typeof useTcfForLead>;
const mockUseUpsertTcfConsent = useUpsertTcfConsent as jest.MockedFunction<
  typeof useUpsertTcfConsent
>;
const mockUseCalls = useCalls as jest.MockedFunction<typeof useCalls>;
const mockUseLogCall = useLogCall as jest.MockedFunction<typeof useLogCall>;
const mockUseUpdateLead = useUpdateLead as jest.MockedFunction<typeof useUpdateLead>;
const mockUseAddLeadNote = useAddLeadNote as jest.MockedFunction<typeof useAddLeadNote>;
const mockUseReturnFromDialerLog = useReturnFromDialerLog as jest.MockedFunction<
  typeof useReturnFromDialerLog
>;

const leadId = "11111111-1111-4111-8111-111111111111";

describe("LeadDetailScreen consent section", () => {
  beforeEach(() => {
    mockUseReturnFromDialerLog.mockReturnValue({ beginCall: jest.fn() });
    mockUseLogCall.mockReturnValue({ mutate: jest.fn(), isPending: false } as never);
    mockUseUpdateLead.mockReturnValue({ mutate: jest.fn(), isPending: false } as never);
    mockUseAddLeadNote.mockReturnValue({ mutate: jest.fn(), isPending: false } as never);
    mockUseUpsertTcfConsent.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as never);
    mockUseCalls.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 20 },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as never);

    mockUseLead.mockReturnValue({
      data: {
        id: leadId,
        firstName: "Jane",
        lastName: "Doe",
        phone: "+919999999999",
        leadStatus: "contacted",
        temperature: "warm",
        email: null,
        city: null,
        state: null,
        leadSource: "website",
        notes: null,
        nextFollowupAt: null,
        lastContactedAt: null,
        leadSummary: {
          totalCalls: 2,
          completedCalls: 1,
          missedCalls: 1,
          firstCallAt: null,
          firstSeenAt: "2026-06-01T08:00:00.000Z",
          currentStage: "contacted",
        },
      },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as never);

    mockUseTcfForLead.mockReturnValue({
      data: {
        lead_id: leadId,
        consents: {
          call: {
            id: "c-1",
            consent_type: "call",
            consented: true,
            consented_at: "2026-06-01T08:00:00.000Z",
            revoked_at: null,
            source: "mobile_app",
            ip_address: null,
          },
          sms: {
            id: "c-2",
            consent_type: "sms",
            consented: false,
            consented_at: "2026-06-01T08:00:00.000Z",
            revoked_at: null,
            source: "web",
            ip_address: null,
          },
          email: null,
        },
      },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as never);
  });

  it("renders consent controls with mocked API state", () => {
    render(
      <LeadDetailScreen
        route={{ key: "LeadDetail", name: "LeadDetailScreen", params: { leadId } }}
        navigation={{ setOptions: jest.fn() } as never}
      />,
    );

    expect(screen.getByText("Jane Doe")).toBeTruthy();
    expect(screen.getByText("Consent")).toBeTruthy();
    expect(screen.getAllByText("OK to call").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Do not call")).toBeTruthy();
    expect(screen.getByText("SMS")).toBeTruthy();
    expect(screen.getByText("Not allowed")).toBeTruthy();
    expect(screen.getByText("Email")).toBeTruthy();
    expect(screen.getAllByText("Unknown").length).toBeGreaterThanOrEqual(1);
  });
});

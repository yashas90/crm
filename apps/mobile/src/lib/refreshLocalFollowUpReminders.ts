import { apiGet } from "@/lib/apiClient";
import { syncFollowUpReminders } from "@/lib/followUpLocalReminders";

type UpcomingFollowup = {
  id: string;
  leadName: string;
  nextFollowupAt: string;
};

/** Pull upcoming follow-ups from the API and schedule local T-5min ringtone alerts. */
export async function refreshLocalFollowUpReminders() {
  try {
    const items = await apiGet<UpcomingFollowup[]>("/api/leads/followups/upcoming?days=14", {
      skipSessionLogout: true,
    });
    await syncFollowUpReminders(
      items.map((item) => ({
        id: item.id,
        leadName: item.leadName,
        nextFollowupAt: item.nextFollowupAt,
      })),
    );
  } catch {
    // Best-effort — offline / permission issues must not block the app
  }
}

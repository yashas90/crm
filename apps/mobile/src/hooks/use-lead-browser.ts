import type { LeadBrowserParams } from "@/lib/lead-browser";
import {
  nextLeadInBrowser,
  previousLeadInBrowser,
  resolveLeadBrowser,
} from "@/lib/lead-browser";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { LeadsStackParamList } from "@/navigation/types";

type LeadDetailRoute = RouteProp<LeadsStackParamList, "LeadDetailScreen">;
type LeadDetailNavigation = NativeStackNavigationProp<LeadsStackParamList, "LeadDetailScreen">;

export function useLeadBrowser(route: LeadDetailRoute, navigation: LeadDetailNavigation) {
  const { leadIds, leadIndex } = resolveLeadBrowser(route.params);

  function navigateToLead(target: { leadId: string; leadIndex: number }) {
    navigation.replace("LeadDetailScreen", {
      leadId: target.leadId,
      leadIds,
      leadIndex: target.leadIndex,
    } satisfies LeadBrowserParams);
  }

  function goToNextLead(): boolean {
    if (leadIndex < 0 || leadIds.length === 0) return false;
    const next = nextLeadInBrowser(leadIds, leadIndex);
    if (!next) return false;
    navigateToLead(next);
    return true;
  }

  function goToPreviousLead(): boolean {
    if (leadIndex < 0 || leadIds.length === 0) return false;
    const prev = previousLeadInBrowser(leadIds, leadIndex);
    if (!prev) return false;
    navigateToLead(prev);
    return true;
  }

  return {
    leadIds,
    leadIndex,
    hasNext: leadIndex >= 0 && leadIndex < leadIds.length - 1,
    hasPrevious: leadIndex > 0,
    goToNextLead,
    goToPreviousLead,
  };
}

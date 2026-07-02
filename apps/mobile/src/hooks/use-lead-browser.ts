import type { LeadBrowserParams } from "@/lib/lead-browser";
import {
  collectLeadIdsFromCache,
  leadIdsWithout,
  nextLeadAfterExit,
  nextLeadInBrowser,
  previousLeadInBrowser,
  resolveLeadQueue,
} from "@/lib/lead-browser";
import type { LeadsStackParamList } from "@/navigation/types";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

type LeadDetailRoute = RouteProp<LeadsStackParamList, "LeadDetailScreen">;
type LeadDetailNavigation = NativeStackNavigationProp<LeadsStackParamList, "LeadDetailScreen">;

export function useLeadBrowser(route: LeadDetailRoute, navigation: LeadDetailNavigation) {
  const queryClient = useQueryClient();

  const { leadIds, leadIndex } = useMemo(() => {
    const cachedIds = collectLeadIdsFromCache(queryClient.getQueriesData({ queryKey: ["leads"] }));
    return resolveLeadQueue(route.params, cachedIds);
  }, [queryClient, route.params]);

  const navigateToLead = useCallback(
    (target: { leadId: string; leadIds: string[]; leadIndex: number }) => {
      navigation.replace("LeadDetailScreen", {
        leadId: target.leadId,
        leadIds: target.leadIds,
        leadIndex: target.leadIndex,
      } satisfies LeadBrowserParams);
    },
    [navigation],
  );

  const goToNextLead = useCallback((): boolean => {
    if (leadIndex < 0 || leadIds.length === 0) return false;
    const next = nextLeadInBrowser(leadIds, leadIndex);
    if (!next) return false;
    navigateToLead({ ...next, leadIds });
    return true;
  }, [leadIds, leadIndex, navigateToLead]);

  const goToPreviousLead = useCallback((): boolean => {
    if (leadIndex < 0 || leadIds.length === 0) return false;
    const prev = previousLeadInBrowser(leadIds, leadIndex);
    if (!prev) return false;
    navigateToLead({ ...prev, leadIds });
    return true;
  }, [leadIds, leadIndex, navigateToLead]);

  const exitAfterNaStatus = useCallback(
    (closedLeadId: string): boolean => {
      const next = nextLeadAfterExit(leadIds, closedLeadId, leadIndex);
      if (next) {
        const remaining = leadIdsWithout(leadIds, closedLeadId);
        navigateToLead({
          leadId: next.leadId,
          leadIds: remaining,
          leadIndex: remaining.indexOf(next.leadId),
        });
        return true;
      }

      if (navigation.canGoBack()) {
        navigation.goBack();
        return true;
      }

      navigation.navigate("LeadsScreen");
      return true;
    },
    [leadIds, leadIndex, navigateToLead, navigation],
  );

  const exitToLeadsList = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("LeadsScreen");
  }, [navigation]);

  return {
    leadIds,
    leadIndex,
    hasNext: leadIndex >= 0 && leadIndex < leadIds.length - 1,
    hasPrevious: leadIndex > 0,
    canSwipe: leadIds.length > 1,
    goToNextLead,
    goToPreviousLead,
    exitAfterNaStatus,
    exitToLeadsList,
  };
}

import type { MainTabParamList } from "@/navigation/types";
import type { NavigationContainerRefWithCurrent } from "@react-navigation/native";

export function navigateToVisitsTab(navRef: NavigationContainerRefWithCurrent<MainTabParamList>) {
  if (!navRef.isReady()) return;
  navRef.navigate("VisitsTab", { screen: "SiteVisitsHomeScreen" });
}

export function navigateToLeadFromPush(
  navRef: NavigationContainerRefWithCurrent<MainTabParamList>,
  leadId: string,
) {
  if (!navRef.isReady()) return;

  navRef.navigate("LeadsTab", {
    screen: "LeadDetailScreen",
    params: { leadId },
    initial: false,
  });
}

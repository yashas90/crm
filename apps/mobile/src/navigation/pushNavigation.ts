import type { MainTabParamList } from "@/navigation/types";
import type { NavigationContainerRefWithCurrent } from "@react-navigation/native";

export function navigateToLeadFromPush(
  navRef: NavigationContainerRefWithCurrent<MainTabParamList>,
  leadId: string,
) {
  if (!navRef.isReady()) return;

  navRef.navigate("LeadsTab", {
    screen: "LeadDetailScreen",
    params: { leadId },
  });
}

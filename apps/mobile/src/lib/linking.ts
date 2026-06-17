import type { MainTabParamList } from "@/navigation/types";
import type { LinkingOptions } from "@react-navigation/native";
import * as Linking from "expo-linking";

const prefix = Linking.createURL("/");

export const appLinking: LinkingOptions<MainTabParamList> = {
  prefixes: [prefix, "propninja://"],
  config: {
    screens: {
      LeadsTab: {
        screens: {
          LeadDetailScreen: "leads/:leadId",
        },
      },
    },
  },
};

export function parseLeadDeepLink(url: string): string | null {
  const match = url.match(/leads\/([^/?#]+)/i);
  return match?.[1] ?? null;
}
